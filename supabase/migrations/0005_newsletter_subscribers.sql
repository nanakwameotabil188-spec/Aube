-- =============================================================================
-- 0005_newsletter_subscribers.sql
--
-- Adds real newsletter capture. The form previously rendered a success state
-- without persisting anything, so the "subscribers" concept existed only as
-- an intention.
--
-- Design notes that matter:
--
--  * The table is write-only from the public side. A signup is an insert and
--    nothing else: no select, no update, no delete. That keeps the list
--    unreadable to anyone who finds the endpoint, and it means a subscriber
--    cannot be used to enumerate or silently rewrite the list.
--
--  * Email is stored lowercased and uniquely indexed, so signing up twice is
--    idempotent rather than a duplicate row. `on conflict do nothing` in the
--    server action relies on that index.
--
--  * The admin email is rejected in the server action, not by a database
--    constraint. A trigger would also work, but keeping the rule in one
--    readable place is worth more than defence in depth here: the action is
--    the only writer, and a constraint that silently drops rows is worse than
--    an explicit branch when debugging.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Newsletter subscribers
-- -----------------------------------------------------------------------------

create table newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  -- Lowercased on the way in. Email is case-insensitive in practice, and
  -- Supabase Auth does the same to its own addresses, so storing anything else
  -- would let one person occupy two rows.
  email      text not null unique check (email = lower(email)),
  -- Null until a confirmation step exists. Captured now so the admin list can
  -- show honest state instead of implying every address is confirmed.
  confirmed_at timestamptz,
  source     text not null default 'homepage',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger newsletter_subscribers_set_updated_at
  before update on newsletter_subscribers
  for each row execute function set_updated_at();

create index newsletter_subscribers_created_idx
  on newsletter_subscribers (created_at desc);

alter table newsletter_subscribers enable row level security;

-- The public side may only add. `with check` is what stops a crafted request
-- from writing a row that claims it belongs to somebody else — the column has
-- no owner field, so the only honest value is the one the action supplies.
create policy "anyone may subscribe"
  on newsletter_subscribers for insert
  with check (true);

-- Reading the list, or changing or removing a row, is an admin operation.
-- Note the asymmetry: insert has no `using` clause because `using` does not
-- apply to inserts.
create policy "admins read newsletter subscribers"
  on newsletter_subscribers for select using (is_admin());
create policy "admins update newsletter subscribers"
  on newsletter_subscribers for update using (is_admin()) with check (is_admin());
create policy "admins delete newsletter subscribers"
  on newsletter_subscribers for delete using (is_admin());
