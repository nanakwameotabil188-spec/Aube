'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { checkRateLimit, rateLimitMessage } from '@/lib/supabase/rate-limit';
import { issueVerificationToken } from '@/lib/supabase/email-verification';
import { triggerAutomation, EMAIL_EVENTS } from '@/lib/mail/templates';
import { readIntegration } from '@/lib/supabase/integrations';
import { contentService } from '@/lib/services/content-service';
import { siteOrigin } from '@/lib/site-origin';
import { routes } from '@/lib/routes';

/**
 * Customer accounts: registration, sign-in, password reset.
 *
 * All of it runs server-side so the password goes straight to Supabase and the
 * session cookie is written by the Server Action's own request — the one request
 * in this app where cookies are writable.
 *
 * Errors are returned rather than thrown. A rejected password or a duplicate
 * address is an ordinary outcome of filling in a form, not an exception, and the
 * distinction that matters is that no message here reveals whether an account
 * exists.
 *
 * The admin sign-in in `auth.ts` is deliberately separate. Staff and shoppers
 * share a session but not a destination, and keeping them in one module is how a
 * shopper ends up redirected to `/admin` or a member of staff redirected to a
 * page that does not exist for them.
 */

export interface AuthResult {
  ok: boolean;
  message: string;
  /**
   * The submitted email address, echoed back on a failed sign-in.
   *
   * React resets an uncontrolled form after a Server Action runs, which is
   * right for a successful sign-in and wrong for a rejected one: a shopper who
   * mistypes their password should not also have to retype their address. The
   * form re-seeds the field from this, so the correction costs one field.
   *
   * Only ever the address the person typed themselves, so echoing it back
   * reveals nothing they did not know.
   */
  email?: string;
  /**
   * Set when the address exists but is not confirmed.
   *
   * The sign-in form uses it to offer a resend inline, which is the difference
   * between somebody recovering in one click and somebody giving up on an
   * account they cannot use.
   */
  needsVerification?: boolean;
  /**
   * The non-secret fields of a failed registration, so the form can re-seed
   * itself. A password is deliberately never included.
   */
  retry?: { firstName: string; lastName: string; email: string };
}

function asString(value: FormDataEntryValue | null, max = 200): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

/**
 * Password rules.
 *
 * Length is the only rule that actually resists guessing, so it is the only one
 * enforced here: 10 characters, because a generated pass phrase beats a short
 * one with character-class rules attached. Supabase has its own minimum, so this
 * is deliberately stricter rather than a replacement.
 */
const MIN_PASSWORD = 10;

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters. Length does more than symbols.`;
  }
  if (password.length > 200) {
    return 'That password is too long.';
  }
  return null;
}

/**
 * Where to send a shopper back to.
 *
 * Read from the query string so a link like `/account/login?next=/cart` returns
 * them to what they were doing, but validated against the app's own route table:
 * an unvalidated `next` is an open redirect, which is a phishing tool that
 * borrows this domain's credibility.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  const value = asString(raw, 300);
  const allowed = new Set<string>([
    routes.account.root,
    routes.account.orders,
    routes.account.profile,
    routes.cart,
    routes.checkout,
    routes.wishlist,
  ]);
  return allowed.has(value) ? value : routes.account.root;
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

/**
 * Create an account.
 *
 * `data` carries the name through to the `handle_new_customer` trigger, which
 * is the only writer of the `customers` row — the form never posts one itself.
 * That matters: an insert policy would have to trust a client-supplied
 * `user_id`, and a client-supplied `user_id` is exactly what a visitor forging
 * a profile for someone else would send.
 *
 * ## Which provider sends the confirmation
 *
 * When the shop has an email provider configured, the user is created through
 * the admin API and this app sends its own confirmation, so the mail goes through
 * the same template editor, provider setting and delivery log as every other
 * email the shop sends.
 *
 * When it does not, the code falls back to `signUp` and lets the auth provider
 * send its own message. That fallback is deliberate rather than a leftover: an
 * unconfigured shop that refuses to create accounts at all is a worse failure
 * than a rate-limited email, and the operator gets a message saying exactly that.
 */
export async function registerCustomer(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const email = asString(formData.get('email')).toLowerCase();
  const password = asString(formData.get('password'), 200);
  const confirm = asString(formData.get('confirm_password'), 200);
  const firstName = asString(formData.get('first_name'), 60);
  const lastName = asString(formData.get('last_name'), 60);
  const next = safeNext(formData.get('next'));

  /*
   * Re-fillable fields, echoed back on failure.
   *
   * React clears an uncontrolled form once an action returns, so a rejected
   * registration would otherwise wipe the name and address a shopper just typed
   * to go with a mistyped confirmation. These are the values they submitted, so
   * putting them back reveals nothing they did not already know.
   *
   * A password is never included: it must not travel back out of the server
   * into the DOM, where it would sit in the page source and in any password
   * manager's heuristics.
   */
  const retry: AuthResult['retry'] = { firstName, lastName, email };

  if (!email || !password) {
    return { ok: false, message: 'Enter your email address and a password.', retry };
  }

  // Deliberately not an exact-match check on the message. Saying "the passwords
  // do not match" is fine; the form already has both values in front of the
  // person filling it in.
  if (password !== confirm) {
    return { ok: false, message: 'Those two passwords do not match.', retry };
  }

  const invalid = validatePassword(password);
  if (invalid) return { ok: false, message: invalid, retry };

  const limit = await checkRateLimit('register', email);
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage('register'), retry };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Accounts are unavailable right now. Please try again later.' };
  }

  const origin = await siteOrigin();
  const { provider, enabled } = await readIntegration('email');
  const shopSendsMail = origin !== null && provider !== 'none' && provider !== 'console' && enabled;

  const metadata = {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
  };

  if (shopSendsMail) {
    return registerWithShopMailer(supabase, email, password, metadata, origin as string, firstName);
  }

  /*
   * No usable provider: fall back to the auth provider's own email.
   *
   * `createUser` is deliberately not used on this path — it would create an
   * unconfirmed account that nothing can ever confirm, because the confirmation
   * this app owns was never minted.
   */
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      // Sent by email. Without it, a typo in the address creates an account the
      // person can never sign in to, and a confirmation link they never receive.
      // Supabase falls back to its own configured site URL when this is absent,
      // which is a different domain in every local environment.
      ...(origin ? { emailRedirectTo: `${origin}${routes.account.login}` } : {}),
    },
  });

  if (error) return { ok: false, message: registrationError(error), retry };

  // No session means the project requires email confirmation, which is the
  // setup this should run in. Saying so plainly beats a form that appears to
  // succeed and then silently fails at the next sign-in.
  if (!data.session) {
    return {
      ok: true,
      message: 'Check your email for a link to confirm your address, then sign in.',
    };
  }

  redirect(next);
}

/**
 * The path where this shop sends its own confirmation.
 *
 * Split out because it is a different shape of answer: the account is created
 * unconfirmed, so the success message is the same, but every failure after the
 * insert has to account for a user that already exists and cannot yet sign in.
 */
async function registerWithShopMailer(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  email: string,
  password: string,
  metadata: { first_name: string; last_name: string; full_name: string },
  origin: string,
  firstName: string,
): Promise<AuthResult> {
  const retry: AuthResult['retry'] = {
    firstName,
    lastName: metadata.last_name,
    email,
  };

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false, message: 'Accounts are unavailable right now. Please try again later.' };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    // The whole point: unconfirmed until the emailed link is followed.
    email_confirm: false,
    user_metadata: metadata,
  });

  if (error) {
    return { ok: false, message: registrationError(error), retry };
  }

  /*
   * The send must not be able to lose the account.
   *
   * The user exists from here on. If the token cannot be minted or the mail
   * cannot go out, the correct outcome is a failed-looking form plus a resend
   * path — never a silent success and never a claim that an email is on its way
   * when nothing was sent.
   */
  try {
    const issued = await issueVerificationToken({
      email,
      userId: created.user?.id ?? null,
      origin,
      path: routes.account.verifyEmail,
    });

    const sent = await triggerAutomation(EMAIL_EVENTS.SIGNUP, email, {
      brand_name: await brandName(),
      first_name: firstName,
      confirm_url: issued.url,
      expires_in: issued.expiresInHours,
    });

    if (!sent.sent) {
      return {
        ok: false,
        message:
          'Your account was created but the confirmation email could not be sent. Use the resend link on the sign-in page to try again.',
        retry,
      };
    }
  } catch (error) {
    return {
      ok: false,
      message: `Your account was created but we could not send the confirmation email (${
        error instanceof Error ? error.message : 'unknown error'
      }). Use the resend link on the sign-in page.`,
      retry,
    };
  }

  return {
    ok: true,
    message: 'Check your email for a link to confirm your address, then sign in.',
  };
}

/**
 * The shop's name, for a template that says `{{brand_name}}`.
 *
 * Read through the content service rather than a second settings query so a
 * rename in the admin reaches the very next email, and so the name in a
 * confirmation cannot drift from the name in the footer.
 *
 * Falls back to a neutral word rather than throwing: an email that says "your
 * account at the shop" is better than an exception on the send path, which would
 * leave the account created and unsent with nothing to show for it.
 */
async function brandName(): Promise<string> {
  try {
    const settings = await contentService.getSettings();
    return settings.brandName || 'the shop';
  } catch {
    return 'the shop';
  }
}

/**
 * Turns an auth error into copy.
 *
 * The duplicate-address case points at sign-in rather than confirming the
 * address, so this form cannot be used to test whether somebody shops here. The
 * SMTP case names the actual problem, because the shopper cannot fix it by
 * waiting five minutes and only the owner can fix it.
 */
function registrationError(error: { message: string; code?: string }): string {
  if (/already registered|already exists|already been registered/i.test(error.message)) {
    return 'That address cannot be registered. If you already have an account, sign in instead.';
  }

  if (/rate limit|smtp|email.*(not|un).*configur/i.test(`${error.message} ${error.code ?? ''}`)) {
    return 'We could not send the confirmation email. This shop needs an email provider configured before accounts can be created.';
  }

  return 'We could not create that account. Please try again.';
}

/* ------------------------------------------------------------------ */
/* Sign in and out                                                     */
/* ------------------------------------------------------------------ */

export async function signInCustomer(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const email = asString(formData.get('email')).toLowerCase();
  const password = asString(formData.get('password'), 200);
  const next = safeNext(formData.get('next'));

  if (!email || !password) {
    return { ok: false, message: 'Enter your email address and password.' };
  }

  const limit = await checkRateLimit('signIn', email);
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage('signIn'), email };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Accounts are unavailable right now. Please try again later.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  /*
   * Unconfirmed is a distinct outcome, not a credential failure.
   *
   * This check sat *after* the `error || !data.user` early return, which made it
   * unreachable for the only case it exists to handle. Supabase does not issue a
   * session for an unconfirmed address — it returns an error and a null user — so
   * the branch could only ever have run for an account that was somehow
   * unconfirmed and had just been signed in, which does not happen.
   *
   * The visible consequence was the whole dead end an unconfirmed shopper hits:
   * register, no confirmation email arrives, sign in with the password that was
   * just chosen, and be told the address and password "do not match an account".
   * The password is correct; the account exists; and the resend button is gated
   * on `needsVerification`, so it was never offered either.
   *
   * Safe to distinguish: GoTrue verifies the password *before* it reports
   * `email_not_confirmed`, so this only ever appears to somebody who already
   * holds the right password. A wrong password still gets `invalid_credentials`
   * and still gets the identical generic sentence.
   */
  const unconfirmed =
    error?.code === 'email_not_confirmed' ||
    /email not confirmed/i.test(error?.message ?? '') ||
    (data?.user != null && data.user.email_confirmed_at === null);

  if (unconfirmed) {
    // A session should not exist here, but if one was issued it must not be left
    // behind for an account the app has just declined to sign in.
    if (data?.session) await supabase.auth.signOut();

    return {
      ok: false,
      message:
        'Your address is not confirmed yet. Check your email for the confirmation link, or request a new one.',
      email,
      // Lets the form offer the resend inline rather than making the shopper
      // remember which address they used.
      needsVerification: true,
    };
  }

  if (error || !data.user) {
    // Never distinguishes "no such account" from "wrong password".
    return {
      ok: false,
      message: 'That email address and password do not match an account.',
      email,
    };
  }

  redirect(next);
}

/**
 * Re-sends a confirmation email.
 *
 * ## Reports success for an address it did not send to
 *
 * The same reasoning as `requestPasswordReset`: the only way to know whether an
 * address has an unconfirmed account is to ask, and the answer is an enumeration.
 * So an address with no account, or no unconfirmed one, gets the neutral
 * "a new link is on its way".
 *
 * What it no longer does is claim success for an account it *did* find and then
 * failed to mail. `not-configured` is reported, because telling a shopper to wait
 * for a message that was never sent is the single most confusing thing this
 * action can do — and it is a shop-side misconfiguration, so the shopper is the
 * person who has to notice it and go and ask.
 *
 * Rate limited by address and by nothing else. The bucket is keyed on the
 * submitted address, so one person cannot lock everybody else out of their own
 * inbox — the failure mode of the obvious IP-keyed limiter here.
 */
export async function resendVerificationEmail(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const email = asString(formData.get('email')).toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: 'Enter the email address on your account.' };
  }

  const limit = await checkRateLimit('verificationResend', email);
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage('verificationResend'), email };
  }

  const admin = createAdminSupabaseClient();
  const origin = await siteOrigin();

  if (admin && origin) {
    try {
      /*
       * Found through `customers`, not `auth.admin.listUsers`.
       *
       * The obvious lookup is listing auth users and scanning for the address.
       * That is silently wrong past the first page — it works on a fresh project
       * and fails for every account once a real shop has more than a page of
       * them, which is exactly the sort of bug that only shows up in production.
       * `customers.email` is indexed and the signup trigger writes the row, so
       * this is a single indexed lookup returning one id.
       */
      const { data } = await admin
        .from('customers')
        .select('user_id, full_name')
        .eq('email', email)
        .not('user_id', 'is', null)
        .maybeSingle<{ user_id: string | null; full_name: string | null }>();

      // No customer row means the account was never created, or was created
      // without the trigger. Either way there is nothing to confirm, and the
      // caller cannot tell that from the outside.
      if (!data?.user_id) {
        return { ok: true, message: 'If that address needs confirming, a new link is on its way.', email };
      }

      const issued = await issueVerificationToken({
        email,
        userId: data.user_id,
        origin,
        path: routes.account.verifyEmail,
      });

      // The first name is not on `customers`, so it comes from the display name
      // the trigger stored. A blank token renders as an empty string rather than
      // leaving "Hello," with nothing after it.
      const firstName = (data.full_name ?? '').trim().split(/\s+/)[0] ?? '';

      const sent = await triggerAutomation(EMAIL_EVENTS.SIGNUP, email, {
        brand_name: await brandName(),
        first_name: firstName,
        confirm_url: issued.url,
        expires_in: issued.expiresInHours,
      });

      /*
       * The result is checked.
       *
       * This used to `await triggerAutomation(...)` and discard the return
       * value, then report "a new link is on its way" unconditionally. With no
       * email provider configured the send returns `not-configured`, the
       * `email_log` row says `skipped`, and the shopper was told a link was
       * coming. Nothing was coming. That is the whole trap: the shopper waits,
       * presses resend, is told the same thing again, and concludes the address
       * is rejected rather than that the shop has no mailer.
       *
       * The registration path above has always reported this correctly.
       */
      if (!sent.sent) return resendFailure(sent.reason, email);
    } catch (error) {
      console.warn(`[resend-verification] ${email} failed`, error);
      return resendFailure('rejected', email);
    }
  }

  return { ok: true, message: 'If that address needs confirming, a new link is on its way.', email };
}

/**
 * Turns a failed resend into copy the shopper can act on.
 *
 * `not-configured` is named explicitly rather than folded into a generic
 * failure: it is the one cause an operator can fix in a minute, and the shopper
 * is the person who has to decide to go and find them.
 *
 * This deliberately does not confirm whether the address exists. Only the
 * branch that actually reached a `customers` row reports a send failure, which
 * is the same information the sign-in response already gives via
 * `needsVerification`, so it widens nothing that was not already disclosed.
 */
function resendFailure(reason: string | undefined, email: string): AuthResult {
  if (reason === 'not-configured' || reason === 'no-automation') {
    return {
      ok: false,
      message:
        'That address needs confirming, but no email could be sent — this shop has no email provider configured yet.',
      email,
    };
  }

  return {
    ok: false,
    message: 'That confirmation email could not be sent just now. Please try again shortly.',
    email,
  };
}

export async function signOutCustomer(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  if (supabase) await supabase.auth.signOut();
  redirect(routes.home);
}

/* ------------------------------------------------------------------ */
/* Password reset                                                      */
/* ------------------------------------------------------------------ */

/**
 * Start a password reset.
 *
 * Always reports success, whether or not the address is known. Anything else is
 * a membership oracle: it tells an anonymous visitor which addresses have
 * accounts here, which is the first half of a credential-stuffing run.
 */
export async function requestPasswordReset(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const email = asString(formData.get('email')).toLowerCase();

  if (!email) {
    return { ok: false, message: 'Enter the email address on your account.' };
  }

  const limit = await checkRateLimit('passwordReset', email);
  if (!limit.allowed) {
    // The rate-limit message is the one place the bucket is named, and it
    // describes attempts rather than accounts, so it reveals nothing about
    // whether this address exists.
    return { ok: false, message: rateLimitMessage('passwordReset') };
  }

  const supabase = await createServerSupabaseClient();
  const origin = await siteOrigin();

  if (supabase && origin) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}${routes.account.resetPassword}`,
    });

    // A real failure is not reported. The only way to distinguish "that address
    // is unknown" from "Supabase is down" is to ask the server, and the answer
    // is not worth the enumeration it enables.
    if (error) {
      return {
        ok: true,
        message: 'If that address has an account, a reset link is on its way.',
      };
    }

    /*
     * The shop's own copy as well.
     *
     * `resetPasswordForEmail` sends through the auth provider, so the template
     * the operator edits under Admin → Email is not what arrives. Sending the
     * `user.password_reset` automation too means the branded message is the one
     * that lands, with a delivery log row either way.
     *
     * Failure here is swallowed. A person who received the provider's message is
     * not worse off than one who did not, and reporting the failure would leak
     * whether the address is known.
     */
    try {
      await triggerAutomation(EMAIL_EVENTS.PASSWORD_RESET, email, {
        brand_name: await brandName(),
        reset_url: `${origin}${routes.account.resetPassword}`,
        expires_in: 1,
      });
    } catch (sendError) {
      console.warn(`[password-reset] shop copy failed for ${email}`, sendError);
    }
  }

  return {
    ok: true,
    message: 'If that address has an account, a reset link is on its way.',
  };
}

/**
 * Complete a password reset.
 *
 * Supabase puts the recovery token in the URL fragment, which the browser sends
 * to this page but the server never sees. The client therefore has to hand it
 * back through an action; the token is single-use and short-lived, and it is
 * verified by Supabase rather than by anything here.
 */
export async function updatePassword(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const password = asString(formData.get('password'), 200);
  const confirm = asString(formData.get('confirm_password'), 200);

  // Two shapes, because Supabase sends the recovery material two ways and the
  // client hands over whichever it actually received.
  const tokenHash = asString(formData.get('token_hash'), 400);
  const accessToken = asString(formData.get('access_token'), 400);
  const refreshToken = asString(formData.get('refresh_token'), 400);

  if (password !== confirm) {
    return { ok: false, message: 'Those two passwords do not match.' };
  }

  const invalid = validatePassword(password);
  if (invalid) return { ok: false, message: invalid };

  if (!tokenHash && !accessToken) {
    return {
      ok: false,
      message: 'That reset link is incomplete. Request a new one from the sign-in page.',
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Accounts are unavailable right now. Please try again later.' };
  }

  /*
   * Establish a session from the recovery material, then change the password.
   *
   * `verifyOtp` for the PKCE link, `setSession` for the implicit one. Either way
   * Supabase validates the token — nothing here decides whether a link is
   * genuine, and neither call can be pointed at another account because the
   * token is single-use, short-lived, and already bound to one user.
   */
  const { error: sessionError } = tokenHash
    ? await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    : await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

  if (sessionError) {
    return {
      ok: false,
      message: 'That reset link has expired or already been used. Request a new one.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, message: 'We could not change that password. Request a new link.' };
  }

  return { ok: true, message: 'Your password is changed. You are signed in.' };
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

/**
 * Save the shopper's own details.
 *
 * Authorisation is RLS, not a check here: the update targets the signed-in
 * shopper's row, and the `customers update own` policy permits it only when
 * `user_id = auth.uid()`. Sending a different id is refused by the database.
 */
export async function updateProfile(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const firstName = asString(formData.get('first_name'), 60);
  const lastName = asString(formData.get('last_name'), 60);
  const phone = asString(formData.get('phone'), 40);

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Accounts are unavailable right now. Please try again later.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'You are not signed in.' };

  const { error } = await supabase
    .from('customers')
    .update({ full_name: `${firstName} ${lastName}`.trim(), phone: phone || null })
    .eq('user_id', user.id);

  if (error) return { ok: false, message: 'We could not save those details. Please try again.' };

  return { ok: true, message: 'Your details are saved.' };
}
