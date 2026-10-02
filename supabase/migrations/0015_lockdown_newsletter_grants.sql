-- =============================================================================
-- 0015_lockdown_newsletter_grants.sql
--
-- Closes a leak introduced by 0013.
--
-- ## What was wrong
--
-- 0013 added `unsubscribe_token` and tried to protect it with a column-level
-- `revoke select (unsubscribe_token) from anon`. That revoke did nothing.
--
-- Column privileges in PostgreSQL are only consulted when there is no
-- table-level grant for the same privilege. Supabase's default privileges give
-- `anon` a blanket `grant select on <every table>`, so the table-level SELECT
-- applied and the column revoke was silently inert. Verified directly:
--
--   column privileges on unsubscribe_token: anon SELECT
--   table-level privileges:                anon SELECT
--
-- Worse, 0013 added a SELECT policy with `using (true)`, which combined with
-- that grant to let an anonymous caller read *every* subscriber row including
-- every unsubscribe token. That is the entire mailing list handed to anyone who
-- loads a URL.
--
-- ## The fix
--
-- Revoke the table-level privileges rather than trying to subtract a column from
-- them, and drop the over-broad policy. `anon` needs exactly one thing here: the
-- right to insert a row when somebody signs up on the storefront.
--
-- Unsubscribing needs no read access at all, because `set_newsletter_unsubscribed`
-- is `security definer` and returns only the address. That is the reason it was
-- written as a function rather than as a client-side update.
-- =============================================================================

-- The over-broad policy from 0013. It existed only so the unsubscribe click
-- could work, which the function already handles.
drop policy if exists "anon reads subscriber by unsubscribe token" on newsletter_subscribers;

-- Table-level, so these actually take effect. A column-level revoke cannot
-- subtract from a table-level grant.
revoke select, update, delete, truncate, trigger, references
  on newsletter_subscribers
  from anon, authenticated;

-- `insert` is deliberately kept: the storefront newsletter form writes with the
-- anon client, and the "anyone may subscribe" policy is what makes it work.
--
-- Note that this grants the ability to insert an *arbitrary* `source`, which is
-- cosmetic attribution data and nothing more.

-- The admin policies from 0005 remain, and they are gated on `is_admin()`, so
-- the revoked table-level privileges only remove the ability for a *non-admin
-- signed-in user* to read the list — which was never intended.

-- Service role keeps everything it had: it bypasses RLS and is the only writer
-- the application uses.
grant select, update, delete
  on newsletter_subscribers
  to service_role;