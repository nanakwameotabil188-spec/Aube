-- =============================================================================
-- 0009_signup_name_fallback.sql
--
-- Widens what the signup trigger accepts as a name.
--
-- 0006 read only `raw_user_meta_data ->> 'full_name'`. The registration form
-- happens to send that, so the storefront path worked — but a signup from any
-- other client that supplies the two obvious parts recorded an empty
-- `full_name`, and the shopper's profile page then showed blank name fields
-- with no indication of why.
--
-- Found by `audit:account-e2e`, which creates its test user through the admin
-- API with only `first_name` and `last_name` and then asserts the profile page
-- shows them.
--
-- The two branches are the same in both places the name is written, and both
-- still refuse to overwrite a name the shopper already gave at checkout.
-- =============================================================================

create or replace function handle_new_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  existing_id text;
  submitted_name text;
begin
  -- Staff already have an admin identity. Giving them a customer profile too
  -- would let a member of staff shop as themselves, which muddies both the
  -- admin list and the customer list with the same person.
  if exists (select 1 from admin_users where user_id = new.id) then
    return new;
  end if;

  /*
   * The name as submitted, accepting either shape.
   *
   * `full_name` wins because it is what the form sends. The two parts are the
   * fallback, and `trim(both ' ' from ...)` matters: a caller that sends only a
   * first name would otherwise produce a trailing space that survives into the
   * database and reads as a typo in the admin customer list.
   *
   * `nullif(..., '')` keeps an all-whitespace submission as the column default
   * rather than storing whitespace, so "has no name" stays distinguishable from
   * "has a name".
   */
  submitted_name := nullif(
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      trim(both ' ' from coalesce(new.raw_user_meta_data ->> 'first_name', '')
                              || ' '
                              || coalesce(new.raw_user_meta_data ->> 'last_name', ''))
    ),
    ''
  );

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
           full_name = case when full_name = '' then submitted_name else full_name end
     where id = existing_id;
    return new;
  end if;

  insert into customers (id, email, full_name, user_id)
  values (
    'cus-' || substr(replace(new.id::text, '-', ''), 1, 12),
    new.email,
    coalesce(submitted_name, ''),
    new.id
  );

  return new;
end;
$$;
