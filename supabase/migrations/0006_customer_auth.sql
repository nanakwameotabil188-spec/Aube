-- =============================================================================
-- 0006_customer_auth.sql
--
-- Makes customer sign-in possible. Before this, the schema described customers
-- and had RLS policies for them, but nothing could ever satisfy those policies:
-- `current_customer_id()` read a custom `app_metadata.customer_id` claim that
-- no code, trigger or dashboard step ever set. A shopper who signed up would
-- have gotten a Supabase session and still seen zero rows for their own orders.
--
-- Design notes that matter:
--
--  * `customers.id` stays `text`. Three foreign keys already point at it
--    (`addresses.customer_id`, `orders.customer_id`, `reviews.customer_id`) and
--    one of them is documented in 0002 as being text *because* of that. Changing
--    the type would mean rewriting all three plus every policy, for no gain.
--    The auth link is a separate uuid column instead.
--
--  * The link is `user_id`, not a claim. A claim has to be written by a
--    privileged server after signup, which means the account exists in Auth
--    but has no customer row until some later manual step — the exact failure
--    this migration replaces. A row is created by a trigger at signup instead,
--    so there is no window where a real session owns nothing.
--
--  * The trigger reuses an existing customer row with the same email rather
--    than inserting a second one. A guest who checked out before creating an
--    account already has a `customers` row, and their order history is keyed on
--    it; a duplicate would orphan those orders and leave the shopper with an
--    empty account immediately after signing up.
--
--  * Orders gain an `access_token`. Order numbers are a business prefix plus a
--    short sequence, so they are enumerable, and the confirmation page read
--    orders by number alone. Anyone could walk `AUBE-10430`, `AUBE-10431`, …
--    and read a stranger's address and order. The token is in the confirmation
--    URL, is unguessable, and is not a session — it is the second factor for a
--    guest order, so the page can keep working for someone who checked out
--    without an account.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auth link
-- -----------------------------------------------------------------------------

alter table customers
  add column user_id uuid unique references auth.users (id) on delete cascade;

-- One profile per user, enforced by the unique constraint above. This index
-- backs the owner lookup in `current_customer_id()`, which runs on every read
-- of a customer-owned table and would otherwise be a sequential scan.
create index customers_user_id_idx on customers (user_id) where user_id is not null;

-- -----------------------------------------------------------------------------
-- Owner resolution
--
-- `security definer` is required: this function reads `customers`, which has
-- RLS enabled, so calling it from inside a policy on `customers` would recurse.
-- `search_path` is pinned so a caller cannot shadow `customers` with their own
-- temporary table and make this resolve to something else.
-- -----------------------------------------------------------------------------

create or replace function current_customer_id() returns text
language sql stable security definer set search_path = public as $$
  select (select c.id from customers c where c.user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Signup
--
-- Runs inside the Auth insert transaction, so the customer row is committed
-- with the user or not at all.
-- -----------------------------------------------------------------------------

create or replace function handle_new_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  existing_id text;
begin
  -- Staff already have an admin identity. Giving them a customer profile too
  -- would let a member of staff shop as themselves, which muddies both the
  -- admin list and the customer list with the same person.
  if exists (select 1 from admin_users where user_id = new.id) then
    return new;
  end if;

  -- Reuse a guest profile created by checkout. `customers.email` is citext and
  -- unique, so at most one row can match.
  select c.id into existing_id
  from customers c
  where c.email = new.email;

  if existing_id is not null then
    update customers
       set user_id = new.id,
           -- Only fill a name we were not given; do not overwrite one the
           -- shopper already typed at checkout.
           full_name = case
             when full_name = '' then coalesce(new.raw_user_meta_data ->> 'full_name', '')
             else full_name
           end
     where id = existing_id;
    return new;
  end if;

  insert into customers (id, email, full_name, user_id)
  values (
    'cus-' || substr(replace(new.id::text, '-', ''), 1, 12),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_customer();

-- -----------------------------------------------------------------------------
-- Guest order access token
--
-- `gen_random_bytes` needs no extension: it ships with pgcrypto, which is
-- already enabled for `gen_random_uuid()`.
-- -----------------------------------------------------------------------------

alter table orders
  add column access_token text not null
    default encode(gen_random_bytes(24), 'hex');

-- Unique, so the confirmation lookup can filter on it rather than trusting a
-- scan. The existing unique index on `number` still does its job for lookups
-- that are already scoped by ownership.
create unique index orders_access_token_idx on orders (access_token);

-- -----------------------------------------------------------------------------
-- Policies
--
-- Rewritten to use the new function. The previous versions compared with `=`,
-- which yields NULL rather than false for a signed-out visitor, and NULL is not
-- true, so an anonymous reader was correctly refused — but it relied on that
-- subtlety rather than stating it. `is not distinct from` on a not-null
-- primary key is equivalent and reads as the deny it is.
-- -----------------------------------------------------------------------------

drop policy if exists "customers read own" on customers;
drop policy if exists "customers update own" on customers;

create policy "customers read own"
  on customers for select
  using (id is not distinct from current_customer_id());

-- No insert policy: rows are created by the signup trigger. A self-service
-- insert would let a signed-in visitor fabricate a profile for a different
-- `user_id` or `email`, since `with check` cannot compare against the value the
-- trigger would have chosen.
create policy "customers update own"
  on customers for update
  using (id is not distinct from current_customer_id())
  with check (id is not distinct from current_customer_id() and user_id = auth.uid());

-- `user_id` is not writable through this policy even though the row is: the
-- `with check` above pins it to the caller's own auth id, so re-pointing a
-- profile at another account fails.
