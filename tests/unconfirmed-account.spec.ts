import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { loadEnvFile } from '../scripts/lib/env.mjs';

/**
 * Sign-in and the unconfirmed-account path.
 *
 * ## Why this exists
 *
 * `resendVerificationEmail` used to `await triggerAutomation(...)` and discard
 * the return value, then answer "If that address needs confirming, a new link is
 * on its way" no matter what happened. With no email provider configured the send
 * returns `not-configured` and `email_log` records `skipped` — so the shopper
 * was told a link was on its way when nothing had been sent, and pressing the
 * button again produced the identical reassurance.
 *
 * That is the failure this pins down: a shopper whose confirmation email never
 * arrives has no way to tell a shop misconfiguration from an address that was
 * rejected, so they wait rather than asking.
 *
 * ## Why it is deterministic
 *
 * Resend goes through the shop's own mailer, not Supabase's, so it is not subject
 * to the built-in SMTP rate limit that makes the registration path awkward to
 * test. With no provider configured the outcome is always `not-configured`, which
 * is exactly the branch being asserted.
 *
 * Note this suite does not attempt a full registration. Supabase rejects
 * `example.com` on the public `signUp` path outright (`email_address_invalid`)
 * and rate-limits the built-in mailer to a handful of confirmations an hour, so
 * registering here would assert the state of Supabase's mail quota rather than
 * anything about this app. The account is created directly instead.
 */

loadEnvFile();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

for (const [name, value] of Object.entries({ URL, SERVICE })) {
  if (!value) throw new Error(`${name} is not set. This spec needs a configured Supabase project.`);
}

function admin() {
  return createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
}

const EMAIL = `unconfirmed-${Date.now()}@example.com`;
const PASSWORD = 'unconfirmed-test-password-4471';

let userId: string | null = null;

/** The first-visit dialog covers the page; it has no part in these assertions. */
test.use({ storageState: undefined });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('aube.onboarding.v1', 'seen');
  });
});

test.beforeAll(async () => {
  const db = admin();

  /*
   * `email_confirm: false` is the state the registration action creates on the
   * shop-mailer path: the account exists but cannot obtain a session, which is
   * what makes the sign-in form offer the resend.
   */
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: false,
    user_metadata: { first_name: 'Unconfirmed', last_name: 'Tester' },
  });

  if (error) throw new Error(`could not create the unconfirmed test account: ${error.message}`);
  userId = data.user!.id;

  // `resendVerificationEmail` finds the account through `customers`, not through
  // auth, so the row has to exist for the send to be attempted at all.
  const { data: customer } = await db
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!customer?.id) throw new Error('the signup trigger did not create a customers row');
});

test.afterAll(async () => {
  if (!userId) return;
  await admin().from('email_log').delete().eq('recipient', EMAIL);
  await admin().auth.admin.deleteUser(userId);
});

test('an unconfirmed account is offered a resend rather than a plain rejection', async ({ page }) => {
  await page.goto('/account/login');

  await page.locator('form [name="email"]').fill(EMAIL);
  await page.locator('form [name="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();

  // The password is correct, so this is not a failure state: it is the one case
  // that can safely confirm an account exists, because the caller proved they
  // already hold its password.
  await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
});

test('resending says so when nothing was sent, instead of claiming a link is on its way', async ({
  page,
}) => {
  await page.goto('/account/login');

  await page.locator('form [name="email"]').fill(EMAIL);
  await page.locator('form [name="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();

  await page.getByRole('button', { name: /resend/i }).click();

  /*
   * The assertion is the absence of the old lie as much as the presence of the
   * new message: a fix that silently changed nothing would pass a check for the
   * new copy alone if the button had also stopped working.
   */
  await expect(page.getByText('no email provider configured yet')).toBeVisible();
  await expect(page.getByText('a new link is on its way')).toHaveCount(0);

  // The attempt is still recorded, so "nothing arrived" stays diagnosable.
  const { data } = await admin()
    .from('email_log')
    .select('event, status')
    .eq('recipient', EMAIL)
    .eq('event', 'user.signup');

  expect(data ?? []).not.toHaveLength(0);
});