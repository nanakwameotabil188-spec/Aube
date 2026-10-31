import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { loadEnvFile } from '../scripts/lib/env.mjs';

/**
 * Newsletter signup, end to end.
 *
 * ## The bug this exists for
 *
 * The form reported success for the whole time the welcome automation was dead.
 *
 * `renderEmailTemplate` read `data.bodyHtml` / `data.bodyText` off a row whose
 * columns are `body_html` / `body_text`. Supabase returns exactly the names the
 * select asked for and never camel-cases, so both were `undefined`, and
 * `renderTemplate` called `.split` on `undefined`. That threw inside the
 * automation, which was awaited nowhere and caught by a `.catch()` that logged
 * one line and moved on:
 *
 *     [newsletter] welcome send failed TypeError: Cannot read properties of undefined (reading 'split')
 *
 * Every template-backed send died the same way — welcome, signup verification,
 * password reset, and all three order events. The type checker agreed with the
 * code the whole time, because the generic on `.maybeSingle<EmailTemplate>()` was
 * asserting a shape Postgres does not return.
 *
 * The failure was invisible from the storefront: the insert succeeds, so the
 * visitor sees "You are on the list", the admin sees the address on the list, and
 * only `email_log` stays empty. Nothing told an operator the mail had not merely
 * failed to arrive — it had never been attempted.
 *
 * ## What is asserted
 *
 * The signup *and* the automation it triggers. The row in `newsletter_subscribers`
 * is the half that already worked, so on its own it proves nothing about this
 * bug. The assertion that matters is a row in `email_log` for
 * `subscriber.subscribed`:
 *
 *  - `renderEmailTemplate` runs before `sendMail`, so a row at all means
 *    template lookup and rendering completed.
 *  - Rendering now refuses to run unless both bodies are strings, so a row means
 *    the snake_case mapping produced real bodies rather than `undefined`.
 *  - No mail provider is configured here, so the row is `skipped` rather than
 *    `sent`. That is the correct outcome and is exactly what makes this
 *    diagnosable: `skipped` records that the automation ran and declined, which
 *    is different information from no row at all.
 */

/*
 * Next.js loads `.env.local` itself, but a Playwright test file is Node running
 * outside any Next process — the same gap `scripts/lib/env.mjs` exists to close.
 * Loaded before the constants below read it.
 */
loadEnvFile();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

for (const [name, value] of Object.entries({ URL, SERVICE })) {
  if (!value) throw new Error(`${name} is not set. This spec needs a configured Supabase project.`);
}

const RESERVED_ADDRESS = 'shopaurai@gmail.com';

function admin() {
  return createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Unique per run so the per-address rate limiter never reaches this path. */
function address(label: string) {
  return `newsletter-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * The first-visit onboarding dialog opens 700ms after load and covers the page,
 * so its dismissal flag is seeded before navigation rather than raced after.
 */
async function openHomepage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('aube.onboarding.v1', 'seen');
  });
  await page.goto('/');
  return page.locator('form:has(input[name="email"])').first();
}

const created: string[] = [];

test.afterAll(async () => {
  if (created.length === 0) return;
  const db = admin();
  await db.from('email_log').delete().in('recipient', created);
  await db.from('newsletter_subscribers').delete().in('email', created);
});

test('subscribing stores the address and fires the welcome automation', async ({ page }) => {
  const email = address('welcome');
  created.push(email);

  const form = await openHomepage(page);
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();

  // The success state replaces the form, so its absence means nothing rendered.
  await expect(form).toHaveCount(0);
  await expect(page.getByText('You are on the list. We will be in touch.')).toBeVisible();

  // The half that already worked: the address is on the list.
  await expect
    .poll(
      async () => {
        const { data } = await admin().from('newsletter_subscribers').select('email').eq('email', email);
        return data?.length ?? 0;
      },
      { timeout: 20_000 },
    )
    .toBe(1);

  /*
   * The half that was broken. Before the fix this polled to zero and the run
   * failed here with no row and no hint why — which was the shape of the bug.
   */
  const logged = await expect
    .poll(
      async () => {
        const { data } = await admin()
          .from('email_log')
          .select('event, status, subject, provider')
          .eq('recipient', email)
          .eq('event', 'subscriber.subscribed');
        return data ?? [];
      },
      { timeout: 20_000 },
    )
    .not.toHaveLength(0)
    .then(() => true)
    .catch(() => false);

  expect(
    logged,
    'no email_log row for subscriber.subscribed — the automation threw before sendMail',
  ).toBe(true);

  const { data: rows } = await admin()
    .from('email_log')
    .select('event, status, subject, provider, detail')
    .eq('recipient', email)
    .eq('event', 'subscriber.subscribed')
    .limit(1);

  const row = rows?.[0];

  // A subject proves the template row was read; a rendering step that produced an
  // empty one would mean the same class of bug moved somewhere else.
  expect(row!.subject, 'the rendered subject was empty').not.toBe('');

  // 'sent' once a provider is configured, 'skipped' until then. 'failed' would
  // mean it ran and hit a real error, which is a different problem.
  expect(['sent', 'skipped'], `unexpected status "${row!.status}" (${row!.detail ?? ''})`).toContain(
    row!.status,
  );
});

test('a second signup with the same address still reports success', async ({ page }) => {
  const email = address('repeat');
  created.push(email);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const form = await openHomepage(page);
    await form.locator('input[name="email"]').fill(email);
    await form.locator('input[name="consent"]').check();
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText('You are on the list. We will be in touch.')).toBeVisible();
  }

  // A duplicate is not an error the visitor should be shown: they are on the
  // list either way, and 23505 is reported as success rather than refused.
  await expect
    .poll(
      async () => {
        const { data } = await admin().from('newsletter_subscribers').select('email').eq('email', email);
        return data?.length ?? 0;
      },
      { timeout: 20_000 },
    )
    .toBe(1);
});

test('a bot filling the honeypot reaches neither the database nor the network', async ({ page }) => {
  const email = address('honeypot');

  const form = await openHomepage(page);

  // The honeypot is hidden from people, so it is filled the way a bot would:
  // through the form's own fields, with the visibility rules bypassed.
  await form.locator('input[name="company"]').fill('Definitely A Robot Ltd', { force: true });
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();

  // The component returns early, so there is no state change of any kind: no
  // success banner, no error, and the form is still there to submit again.
  //
  // Asserted on the banner text rather than on `role="status"`, which the toast
  // container always occupies, so a count would be 1 whether or not the submit
  // had done anything.
  await page.waitForTimeout(4000);
  await expect(page.getByText('You are on the list. We will be in touch.')).toHaveCount(0);
  await expect(form).toHaveCount(1);

  const { data } = await admin().from('newsletter_subscribers').select('email').eq('email', email);
  expect(data ?? []).toHaveLength(0);
});

test('the reserved address routes to the admin login and is not stored', async ({ page }) => {
  const form = await openHomepage(page);
  await form.locator('input[name="email"]').fill(RESERVED_ADDRESS);
  await form.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();

  // Routing only. The login page still requires a password for a real
  // `admin_users` row, so arriving here grants nothing.
  await expect(page).toHaveURL(/\/admin\/login/);

  const { data } = await admin()
    .from('newsletter_subscribers')
    .select('email')
    .eq('email', RESERVED_ADDRESS);
  expect(data ?? []).toHaveLength(0);
});

test('a malformed address is refused before it reaches the database', async ({ page }) => {
  const form = await openHomepage(page);
  await form.locator('input[name="email"]').fill('not-an-address');
  await form.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();

  await expect(page.getByRole('alert').first()).toContainText('does not look like an email address');

  const { data } = await admin()
    .from('newsletter_subscribers')
    .select('email')
    .eq('email', 'not-an-address');
  expect(data ?? []).toHaveLength(0);
});