import 'server-only';
import { createAdminSupabaseClient } from './admin';
import { randomToken, sha256 } from './crypto';

/**
 * Email verification.
 *
 * ## Why this app mints its own link
 *
 * The obvious implementation is to let Supabase send the confirmation email:
 * `signUp({ emailRedirectTo })` does it in one line, and the user clicks a link
 * Supabase generates. That was the original design and it is deliberately
 * abandoned, for three reasons that each matter on their own.
 *
 * 1. **The shop's own mailer never runs.** Order confirmations go through
 *    `src/lib/mail`, the admin can rewrite the copy under Admin → Email, and the
 *    provider is a setting rather than a dashboard trip. A signup confirmation
 *    sent by Supabase is the one email in the shop that no operator can edit,
 *    cannot turn off, and cannot see a delivery log for.
 * 2. **Supabase's built-in SMTP is rate-limited to a few messages an hour** and
 *    is documented as being for a project's own team. The previous
 *    implementation's own error branch admitted this: registration failed with
 *    "this shop needs an email provider configured" while an email provider
 *    setting sat unused in the admin panel.
 * 3. **Nothing is verified by the provider's redirect.** `admin.createUser`
 *    followed by our own token keeps the flow on this domain, so the link works
 *    in local development without adding a redirect URL to a dashboard.
 *
 * ## The password is never held
 *
 * The user is created immediately, unconfirmed, and the password goes straight
 * from the form to `createUser` and is never written anywhere this app
 * controls. Verification confirms the *user*, it does not create one. So there is
 * no pending-signup table holding a password between the form and the click,
 * which is the failure mode that makes "verify before signup" designs
 * unattractive.
 *
 * "Verified before signing in" is enforced in the sign-in action rather than here,
 * because that is the only place it is load-bearing: an unconfirmed user cannot
 * obtain a session, so the check is a message, not a lock.
 *
 * ## Only the hash of the token is stored
 *
 * `token_hash` is a SHA-256 of the emailed token. A leaked dump therefore cannot
 * be walked to confirm arbitrary addresses or to forge a valid link, because the
 * token in the URL was never recoverable from the row.
 */

/** How long a confirmation link stays usable. Mirrors the template's wording. */
const TOKEN_TTL_HOURS = 24;

/** At most a few live tokens per address, so a link can be re-sent. */
const MAX_LIVE_PER_EMAIL = 5;

export interface IssueResult {
  /** The confirmation URL, containing the plaintext token. Never stored. */
  url: string;
  expiresInHours: number;
}

/**
 * Mints a token, stores its hash, and returns the link to email.
 *
 * The plaintext token exists only in this return value. It is never written to
 * the database and never logged, so a lost link can only be replaced by issuing
 * another one rather than recovered.
 *
 * Earlier live tokens are consumed rather than deleted, so a link that was
 * already sent stops working the moment a newer one is issued. That is the
 * behaviour somebody expects after asking for a resend, and it bounds the table
 * without needing a cleanup job to stay correct.
 */
export async function issueVerificationToken(input: {
  email: string;
  userId: string | null;
  origin: string;
  path: string;
}): Promise<IssueResult> {
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error('Supabase is not configured.');

  const email = input.email.trim().toLowerCase();

  // Supersede anything already outstanding for this address.
  await admin
    .from('email_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', email)
    .is('consumed_at', null);

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3_600_000).toISOString();

  const { error } = await admin.from('email_verifications').insert({
    email,
    token_hash: sha256(token),
    user_id: input.userId,
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);

  return {
    url: `${input.origin.replace(/\/+$/, '')}${input.path}?token=${encodeURIComponent(token)}`,
    expiresInHours: TOKEN_TTL_HOURS,
  };
}

/** Prunes old consumed rows so the table does not grow without bound. */
export async function pruneVerificationHistory(): Promise<void> {
  const admin = createAdminSupabaseClient();
  if (!admin) return;

  await admin
    .from('email_verifications')
    .delete()
    .lt('created_at', new Date(Date.now() - 30 * 24 * 3_600_000).toISOString());
}

export type ConsumeResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'used' | 'error'; message: string };

/**
 * Consumes a token and confirms the account it belongs to.
 *
 * The three refusal reasons are distinguished because they need different copy:
 * "already used" sends somebody who clicked twice back to the login page, and
 * "expired" tells them to ask for a new link. A single vague message for both
 * strands people who did nothing wrong.
 *
 * The confirmation itself is done with the service role, since the person
 * clicking the link is by definition not signed in yet.
 */
export async function consumeVerificationToken(token: string): Promise<ConsumeResult> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false, reason: 'error', message: 'Supabase is not configured.' };
  }

  if (!token || token.length > 200) {
    return { ok: false, reason: 'unknown', message: 'That link is not valid.' };
  }

  const { data, error } = await admin
    .from('email_verifications')
    .select('id, email, user_id, expires_at, consumed_at')
    .eq('token_hash', sha256(token))
    .maybeSingle<{
      id: string;
      email: string;
      user_id: string | null;
      expires_at: string;
      consumed_at: string | null;
    }>();

  if (error) return { ok: false, reason: 'error', message: error.message };
  if (!data) return { ok: false, reason: 'unknown', message: 'That link is not valid.' };

  if (data.consumed_at) {
    return {
      ok: false,
      reason: 'used',
      message: 'That link has already been used. Your account may already be confirmed — try signing in.',
    };
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    // Marked consumed so the row cannot be probed repeatedly, and so the
    // "request a new one" path is the only thing left to try.
    await admin
      .from('email_verifications')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', data.id);

    return {
      ok: false,
      reason: 'expired',
      message: 'That link has expired. Request a new confirmation email.',
    };
  }

  if (data.user_id) {
    const { error: confirmError } = await admin.auth.admin.updateUserById(data.user_id, {
      email_confirm: true,
    });

    if (confirmError) {
      return { ok: false, reason: 'error', message: confirmError.message };
    }
  }

  await admin
    .from('email_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', data.id);

  return { ok: true, email: data.email };
}

/** How many unused, unexpired tokens exist for an address. Used by the resend action. */
export async function hasLiveVerification(email: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  if (!admin) return false;

  const { data } = await admin
    .from('email_verifications')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(Math.max(1, MAX_LIVE_PER_EMAIL));

  return (data ?? []).length > 0;
}