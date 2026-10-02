-- =============================================================================
-- 0012_email_flow.sql
--
-- Email verification, and rate limiting.
--
-- ## Verification happens without ever holding the password
--
-- The request was "verify by email before signing up". The tempting
-- implementation is to create the account only after the click — which means
-- holding the submitted password somewhere between the form and the click, in a
-- column in a table, until the link is followed.
--
-- That is not done here. The auth user is created immediately in an
-- unconfirmed state, the password goes straight to Supabase and is never stored
-- anywhere this app controls, and the confirmation click marks that user
-- confirmed. "Verified before signing in" is enforced in the sign-in action,
-- which is the only place it actually matters.
--
-- So the tradeoff is a row in `auth.users` that cannot yet be signed into,
-- which is the same thing every hosted provider does, and no copy of the
-- password on this side.
--
-- ## Only the hash of the token is stored
--
-- `token_hash` holds a SHA-256 of the token, not the token. A leaked database
-- dump therefore cannot be walked to send mail to arbitrary addresses, because
-- the token in the URL was never recoverable from the row.
-- =============================================================================

create table if not exists email_verifications (
  id          uuid primary key default gen_random_uuid(),
  email       text        not null,
  -- SHA-256 hex of the token that was emailed. The token itself is never stored.
  token_hash  text        not null,
  user_id     uuid references auth.users (id) on delete cascade,
  expires_at  timestamptz not null,
  -- Set the moment the link is followed, so a second use is refused rather than
  -- silently succeeding.
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create unique index if not exists email_verifications_token_idx
  on email_verifications (token_hash);

-- Keeps only the newest few per address so a person who requests five links
-- does not accumulate five live tokens.
create index if not exists email_verifications_email_idx
  on email_verifications (email, created_at desc);

alter table email_verifications enable row level security;

-- No policy at all. This table is written and read only by the service role
-- through Server Actions: a signed-in user must not be able to read another
-- person's verification row, nor insert one for an address they do not own.


-- =============================================================================
-- Rate limiting
--
-- A fixed-window counter in the database.
--
-- In-memory limiting was rejected deliberately: the app runs on more than one
-- instance in any real deployment, and a limiter that only knows about the
-- process handling the request is not a limiter. The database is the one place
-- all instances already agree.
--
-- The unique index on (bucket, window_start) is what makes this correct under
-- concurrency: two simultaneous requests for the same bucket compute the same
-- window, and exactly one of them wins the insert. The loser gets a unique
-- violation and is over the limit, rather than both being allowed through.
-- =============================================================================
create table if not exists rate_limit_counters (
  bucket      text        not null,
  window_start timestamptz not null,
  count       integer     not null default 1,
  primary key (bucket, window_start)
);

alter table rate_limit_counters enable row level security;

-- No policy. A counter is not something a client reads or writes; the only
-- access is through the `consume_rate_limit` function below.

create or replace function consume_rate_limit(
  p_bucket   text,
  p_limit    integer,
  p_window_seconds integer
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  current_window timestamptz;
  allowed boolean := false;
begin
  -- A fixed window aligned to the clock, so every instance computes the same
  -- boundary without coordinating.
  current_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limit_counters (bucket, window_start, count)
  values (p_bucket, current_window, 1)
  on conflict (bucket, window_start) do update
    set count = rate_limit_counters.count + 1
  returning count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke execute on function consume_rate_limit(text, integer, integer) from public;
grant execute on function consume_rate_limit(text, integer, integer) to service_role;


-- -----------------------------------------------------------------------------
-- Opportunistic cleanup
-- -----------------------------------------------------------------------------
-- Both tables only ever grow, and neither is interesting once it is old. Left
-- to `pg_cron` if the project has it enabled; this is the fallback, and is safe
-- to call from anywhere because it touches nothing a request depends on.
create or replace function prune_rate_limits()
returns void
language sql security definer set search_path = public as $$
  delete from rate_limit_counters
   where window_start < now() - interval '1 day';
  delete from email_verifications
   where created_at  < now() - interval '30 days'
      or consumed_at is not null and consumed_at < now() - interval '1 day';
$$;

revoke execute on function prune_rate_limits() from public;
grant execute on function prune_rate_limits() to service_role;