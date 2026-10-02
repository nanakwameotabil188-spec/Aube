-- =============================================================================
-- 0011_notifications.sql
--
-- In-app notifications.
--
-- ## One row per recipient, not one row with a read flag
--
-- The obvious design is a single row with `read_at`, which only works if there
-- is exactly one reader. A campaign sent to every subscriber has thousands, and
-- a single shared `read_at` would mean the first person to open it marks it
-- read for everybody.
--
-- So a send is fanned out into one row per recipient at write time. The table
-- grows faster than a broadcast table would, but "has this person seen it" is
-- then a plain indexed lookup with no join and no clever query, which is the
-- only question the badge actually asks.
--
-- The fan-out happens in `create_notification`, which is `security definer`, so
-- a campaign to twenty thousand subscribers is one statement rather than twenty
-- thousand round trips from the request handler.
-- =============================================================================

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  -- The recipient. A shopper's own id from `customers`.
  customer_id text        not null references customers (id) on delete cascade,
  -- 'info' | 'success' | 'warning' renders as a tone on the badge and the card.
  tone        text        not null default 'info'
                check (tone in ('info', 'success', 'warning')),
  title       text        not null check (char_length(title) between 1 and 160),
  body        text        not null default '' check (char_length(body) <= 2000),
  -- Optional image, so a notification can carry the campaign artwork the same
  -- email does.
  image_id    text references images (id) on delete set null,
  -- An in-app link. Deliberately a path rather than a full URL, so a stored
  -- value cannot become an open redirect when it is rendered as an href.
  link        text check (link is null or link ~ '^/[A-Za-z0-9/_.~-]{0,200}$'),
  -- Null until this recipient opens it. One row, so this is genuinely per-person.
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- The badge query is "my unread notifications, newest first".
create index if not exists notifications_customer_unread_idx
  on notifications (customer_id, created_at desc)
  where read_at is null;

create index if not exists notifications_customer_idx
  on notifications (customer_id, created_at desc);

alter table notifications enable row level security;

-- A shopper reads and marks their own. Enforced by `customer_id`, which is
-- resolved through `current_customer_id()` rather than from a client-supplied
-- id, so this cannot be pointed at somebody else's row.
drop policy if exists "customers read own notifications" on notifications;
create policy "customers read own notifications"
  on notifications for select
  using (customer_id = current_customer_id());

drop policy if exists "customers mark own notifications read" on notifications;
create policy "customers mark own notifications read"
  on notifications for update
  using (customer_id = current_customer_id())
  with check (customer_id = current_customer_id());

-- No insert or delete policy for `authenticated`. Nobody may hand themselves a
-- notification, and nobody may delete one they were sent. Delivery is the
-- service role's job alone.


-- -----------------------------------------------------------------------------
-- Fan-out helper
-- -----------------------------------------------------------------------------
-- `p_customer_ids is null` means "every customer", which is how a campaign
-- reaches the whole list without the caller enumerating it first.
create or replace function create_notification(
  p_customer_ids text[],
  p_title        text,
  p_body         text default '',
  p_tone         text default 'info',
  p_image_id     text default null,
  p_link         text default null
)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  inserted integer;
begin
  if p_title is null or char_length(trim(p_title)) = 0 then
    raise exception 'a notification needs a title';
  end if;

  if p_tone is not null and p_tone not in ('info', 'success', 'warning') then
    raise exception 'unknown notification tone: %', p_tone;
  end if;

  insert into notifications (customer_id, tone, title, body, image_id, link)
  select c.id, p_tone, trim(p_title), coalesce(p_body, ''), p_image_id, p_link
    from customers c
   where p_customer_ids is null or c.id = any (p_customer_ids);

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- Service role only, like every other writer in this schema. An admin creates
-- notifications through a Server Action that has already checked authorisation;
-- there is no path by which a signed-in user can call this directly.
revoke execute on function create_notification(text[], text, text, text, text, text) from public;
grant execute on function create_notification(text[], text, text, text, text, text) to service_role;


-- =============================================================================
-- Outbound email log
--
-- Every send is recorded, including the ones that failed and the ones that were
-- suppressed. Without it, "did the confirmation go out?" can only be answered by
-- reading the provider's dashboard, and a silent failure is invisible.
-- =============================================================================
create table if not exists email_log (
  id           uuid primary key default gen_random_uuid(),
  -- The automation that fired, or 'admin.broadcast' for a manual send.
  event        text        not null,
  template_key text,
  recipient    text        not null,
  subject      text        not null default '',
  provider     text        not null default '',
  -- 'sent' | 'failed' | 'skipped'. `skipped` is the interesting one: it records
  -- that an automation was disabled or the provider is not configured, so a
  -- missing confirmation email is diagnosable without guessing.
  status       text        not null default 'sent'
                 check (status in ('sent', 'failed', 'skipped')),
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists email_log_recipient_idx on email_log (recipient, created_at desc);
create index if not exists email_log_event_idx on email_log (event, created_at desc);

alter table email_log enable row level security;

-- Admins read the log. Shoppers do not: it would let one address confirm another
-- address has an account, which is the enumeration the auth code goes out of its
-- way to avoid.
drop policy if exists "admins read email log" on email_log;
create policy "admins read email log"
  on email_log for select
  using (is_admin());

drop policy if exists "admins delete email log" on email_log;
create policy "admins delete email log"
  on email_log for delete
  using (is_admin('admin'));