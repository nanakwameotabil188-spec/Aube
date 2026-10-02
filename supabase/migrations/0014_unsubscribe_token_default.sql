-- =============================================================================
-- 0014_unsubscribe_token_default.sql
--
-- Fixes an insert failure introduced by 0013.
--
-- 0013 backfilled tokens onto the rows that existed at the time and then set the
-- column NOT NULL, but it set no default. Every subsequent `insert into
-- newsletter_subscribers` therefore failed with a not-null violation, which
-- means the newsletter signup form had been broken since that migration landed.
--
-- Caught by verifying the unsubscribe path end to end rather than by reading the
-- migration: the SQL applied cleanly and the backfill reported success, and
-- neither of those says anything about whether a *new* row gets a token.
--
-- The default is the generator itself, so a token exists from the moment the row
-- does and there is no window in which a subscriber has no way to unsubscribe.
-- =============================================================================

alter table newsletter_subscribers
  alter column unsubscribe_token
  set default encode(gen_random_bytes(24), 'hex');

-- Backstop for rows that somehow slipped in without one.
update newsletter_subscribers
   set unsubscribe_token = encode(gen_random_bytes(24), 'hex')
 where unsubscribe_token is null;