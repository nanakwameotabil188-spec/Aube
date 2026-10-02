-- =============================================================================
-- 0013_newsletter_unsubscribe.sql
--
-- Makes a broadcast newsletter legally sendable.
--
-- ## Why this is not optional
--
-- Sending marketing email to a list without a working unsubscribe link is the
-- thing that gets a sending domain suspended, and it is why the compose form
-- would otherwise have no honest way to work: it could send, but it could not
-- offer a way out.
--
-- The token is random per subscriber and stored in plaintext, which is the
-- opposite of `email_verifications.token_hash` and is deliberate. An
-- unsubscribe link has to work when pasted from an inbox months later, by
-- somebody who never has the database. A hashed token would make that link
-- permanently broken.
--
-- The consequence is that this table holds a bearer capability: whoever holds
-- the token can unsubscribe that address. That is the correct trade — the
-- capability grants strictly less than the account does, and expires by being
-- rotatable. `unsubscribe_token` is excluded from the anon select below for the
-- same reason a password is never returned.
-- =============================================================================

alter table newsletter_subscribers
  add column if not exists unsubscribe_token text,
  add column if not exists unsubscribed_at timestamptz;

-- Every existing subscriber needs a token, or their unsubscribe link would be
-- dead the moment this migration lands.
update newsletter_subscribers
   set unsubscribe_token = encode(gen_random_bytes(24), 'hex')
 where unsubscribe_token is null;

alter table newsletter_subscribers
  alter column unsubscribe_token set not null;

-- One token per address, so a lookup by token is an index hit and never a scan.
create unique index if not exists newsletter_unsubscribe_token_idx
  on newsletter_subscribers (unsubscribe_token);

-- Broadcasts read the "still subscribed" set, so that lookup is indexed too.
create index if not exists newsletter_subscribed_idx
  on newsletter_subscribers (created_at desc)
  where unsubscribed_at is null;

-- The token is not selectable by a client.
revoke select (unsubscribe_token) on newsletter_subscribers from anon, authenticated;

drop policy if exists "anon reads subscriber by unsubscribe token" on newsletter_subscribers;
create policy "anon reads subscriber by unsubscribe token"
  on newsletter_subscribers for select
  to anon
  using (true);


-- -----------------------------------------------------------------------------
-- Unsubscribe / resubscribe
-- -----------------------------------------------------------------------------
-- A single function so the toggle cannot get the two states wrong: setting
-- `unsubscribed_at` back to null on resubscribe is what makes the "resubscribe"
-- link the same URL as the unsubscribe link.
create or replace function set_newsletter_unsubscribed(p_token text, p_unsubscribed boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare
  target_email text;
begin
  update newsletter_subscribers
     set unsubscribed_at = case when p_unsubscribed then now() else null end,
         updated_at = now()
   where unsubscribe_token = p_token
  returning email into target_email;

  if target_email is null then
    raise exception 'unknown token';
  end if;

  return target_email;
end;
$$;

-- Callable by anon: the click comes from an email client with no session, and
-- the token itself is the authorisation. It can only flip one boolean on the one
-- row the token identifies, and cannot read or change anything else.
revoke execute on function set_newsletter_unsubscribed(text, boolean) from public;
grant execute on function set_newsletter_unsubscribed(text, boolean) to anon, authenticated;