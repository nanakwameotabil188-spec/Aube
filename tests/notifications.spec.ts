import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { loadEnvFile } from '../scripts/lib/env.mjs';

/**
 * In-app notifications, end to end.
 *
 * ## What this actually tests
 *
 * Both halves of the feature, through the same code the app uses:
 *
 *  - **Delivery** — `create_notification`, the same RPC `notifyCustomers` calls
 *    when an operator ticks "Also create an in-app notification" in the compose
 *    form. Asserting against the database rather than the UI, because a fan-out
 *    that reported success while writing no rows is the failure this is for.
 *  - **Consumption** — the real bell, signed in as a real shopper through the
 *    real form: badge count, the panel rendering, and mark-read persisting.
 *
 * ## Why it creates its own account
 *
 * The admin suite needs `ADMIN_PASSWORD`, which is deliberately not in the
 * repository. Rather than skip the only feature here that has no admin
 * dependency, this spec mints a throwaway shopper through the service role and
 * deletes it afterwards. It needs the service role only to *set up*; every
 * assertion about permissions runs as the anon key or as the signed-in shopper.
 *
 * ## CSP is deliberately not bypassed
 *
 * `playwright.config.ts` sets `bypassCSP: true` for the admin suite, because
 * those specs inject their own page content. This one overrides it to `false`:
 * if a Content-Security-Policy change breaks hydration, a bell that only works
 * with CSP disabled is not a working bell.
 */

/*
 * Next.js loads `.env.local` itself, but a Playwright test file is Node running
 * outside any Next process — the same gap `scripts/lib/env.mjs` exists to close.
 * Loaded before the constants below read it.
 */
loadEnvFile();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

for (const [name, value] of Object.entries({ URL, SERVICE, ANON })) {
  if (!value) throw new Error(`${name} is not set. This spec needs a configured Supabase project.`);
}

/** Long enough that the rate limiter on registration never touches this path. */
const PASSWORD = 'notif-test-password-9134';
const ADDRESS = `notif-tester-${Date.now()}@example.com`;

let customerId: string | null = null;
let notificationId: string | null = null;

function admin() {
  return createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test.describe.configure({ mode: 'serial' });

/*
 * `playwright.config.ts` sets `bypassCSP: true` for the admin suite, because
 * those specs inject their own page content. This one turns it off: if a
 * Content-Security-Policy change breaks hydration, a bell that only works with
 * CSP disabled is not a working bell.
 */
test.use({ bypassCSP: false });

test.beforeAll(async () => {
  const db = admin();

  // The `handle_new_customer` trigger writes the `customers` row, so creating the
  // auth user is enough to produce a shopper with a real `customer_id`.
  const { data, error } = await db.auth.admin.createUser({
    email: ADDRESS,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: 'Notification', last_name: 'Tester' },
  });

  if (error) throw new Error(`could not create the test shopper: ${error.message}`);

  const { data: customer, error: lookupError } = await db
    .from('customers')
    .select('id')
    .eq('user_id', data.user!.id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  customerId = customer?.id ?? null;

  if (!customerId) throw new Error('the signup trigger did not create a customers row');

  // A real image, so the notification exercises the bell's image branch rather
  // than only the tone-colour fallback.
  const { data: image } = await db.from('images').select('id, url').limit(1).maybeSingle();

  const { data: rows, error: notifyError } = await db.rpc('create_notification', {
    p_customer_ids: [customerId],
    p_title: 'Your winter routine is ready',
    p_body: 'Three steps, no new products — pick up where you left off.',
    p_tone: 'success',
    p_image_id: image?.id ?? null,
    p_link: '/shop',
  });

  if (notifyError) throw notifyError;
  if (rows !== 1) throw new Error(`fan-out created ${rows} rows, expected 1`);

  const { data: created } = await db
    .from('notifications')
    .select('id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  notificationId = created?.id ?? null;
  if (!notificationId) throw new Error('no notification row to assert against');
});

test.afterAll(async () => {
  if (!customerId) return;
  // Cascades to `notifications` via the foreign key, so the store is left clean.
  await admin().from('customers').delete().eq('id', customerId);
});

test('the fan-out wrote one row per recipient and nothing for anyone else', async () => {
  const db = admin();

  const { data: mine } = await db
    .from('notifications')
    .select('id, title, read_at')
    .eq('customer_id', customerId!);

  expect(mine).toHaveLength(1);
  expect(mine![0]!.id).toBe(notificationId);
  // Unread until the shopper opens it. A fan-out that pre-marks its own rows
  // would make the badge permanently zero and the feature invisible.
  expect(mine![0]!.read_at).toBeNull();

  const { count: total } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true });

  expect(total).toBe(1);
});

test('an anonymous reader cannot read any notification', async () => {
  // The anon key, not the service role. This is the check that matters: the
  // bell reads through the public client, and RLS is what keeps one shopper's
  // mail out of another's panel.
  const anon = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await anon.from('notifications').select('id, title');

  // With no session the policies resolve `current_customer_id()` to null, so
  // this is an empty result rather than an error.
  expect(error).toBeNull();
  expect(data).toEqual([]);
});

test('an anonymous reader cannot mark a notification read', async () => {
  const anon = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /*
   * Asserted on the row rather than on an error.
   *
   * PostgREST does not report an RLS denial on an update as a failure — it
   * applies the policy, matches zero rows, and returns 200 with an empty body.
   * Asserting `error !== null` here would pass on a genuinely broken policy and
   * fail on a correctly locked-down one, which is the worst possible way round.
   * The thing that actually matters is that the row did not change.
   */
  const { error } = await anon
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId!);

  if (error) throw new Error(`the anonymous update should have been silently refused: ${error.message}`);

  const { data } = await admin()
    .from('notifications')
    .select('read_at')
    .eq('id', notificationId!)
    .maybeSingle();

  expect(data!.read_at).toBeNull();
});

test('a shopper cannot hand themselves a notification', async () => {
  const anon = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await anon.from('notifications').insert({
    customer_id: customerId,
    title: 'Injected',
    tone: 'info',
  });

  expect(error).not.toBeNull();

  const { count } = await admin()
    .from('notifications')
    .select('id', { count: 'exact', head: true });

  expect(count).toBe(1);
});

test('the bell shows the notification and marks it read', async ({ page }: { page: Page }) => {
  await signIn(page);

  const bell = page.getByRole('button', { name: /Notifications/ });

  // The badge is what proves the panel was fed from the database rather than
  // from anything local.
  await expect(bell).toHaveAttribute('aria-label', /1 unread/, { timeout: 20_000 });

  await bell.click();

  // Scoped to the entry itself. An unscoped `getByRole('link', { name: 'View' })`
  // also matches the account nav's "Overview", because accessible-name matching
  // is a substring test by default.
  const entry = page.getByRole('listitem').filter({ hasText: 'Your winter routine is ready' });

  await expect(entry.getByText('Your winter routine is ready')).toBeVisible();
  await expect(entry.getByText(/Three steps, no new products/)).toBeVisible();

  // The `link` the notification carried, not a fallback.
  await expect(entry.getByRole('link', { name: 'View', exact: true })).toHaveAttribute(
    'href',
    '/shop',
  );

  // The image branch, not the tone-colour fallback.
  await expect(entry.locator('img')).toBeVisible();

  await page.getByRole('button', { name: 'Mark all read' }).click();

  // The badge clears without a full page load.
  await expect(bell).toHaveAttribute('aria-label', /none unread/, { timeout: 20_000 });

  /*
   * And it actually persisted rather than only looking cleared.
   *
   * Polled, because the assertion above is satisfied by the *optimistic* update:
   * `markAll` repaints the list as read before the Server Action has even been
   * dispatched. Reading the row straight afterwards races that write, which is
   * how this spec failed intermittently while the feature itself was correct.
   *
   * `expect.poll` re-reads until the value settles, so it asserts the durable
   * outcome — which is the part that actually matters — without depending on how
   * fast the action round-trips.
   */
  await expect
    .poll(
      async () => {
        const { data } = await admin()
          .from('notifications')
          .select('read_at')
          .eq('id', notificationId!)
          .maybeSingle();
        return data?.read_at;
      },
      { timeout: 20_000, message: 'the row was never marked read in the database' },
    )
    .toBeTruthy();
});

test('the bell stays cleared after a reload', async ({ page }: { page: Page }) => {
  await signIn(page);

  const bell = page.getByRole('button', { name: /Notifications/ });

  // The re-sync that `router.refresh()` depends on. Before this was fixed the
  // component read its `initial` prop only on first render, so the panel kept
  // showing the previous server response forever.
  await expect(bell).toHaveAttribute('aria-label', /none unread/, { timeout: 20_000 });

  await bell.click();
  await expect(page.getByRole('button', { name: 'Mark all read' })).toHaveCount(0);
});

/**
 * Marks the first-visit introduction as seen.
 *
 * It is a fixed full-viewport overlay and it opens on a 700ms timer after mount,
 * so it appears *after* the page has finished loading and intercepts clicks on
 * whatever is underneath. Clicking its Skip button races that timer — on a slow
 * connection the modal is not there yet when the click is attempted, and then it
 * appears on the next page and blocks the bell.
 *
 * Seeding the flag through `addInitScript` runs before any page script on every
 * navigation, so the race does not exist. The key is the same one the component
 * reads, which is the only coupling; nothing else about the flow is changed.
 */
async function suppressIntroduction(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    try {
      window.localStorage.setItem(key, 'seen');
    } catch {
      /* blocked storage: the modal shows, and the waits below still pass */
    }
  }, 'aube.onboarding.v1');
}

/**
 * Signs in through the real form.
 */
async function signIn(page: Page): Promise<void> {
  await suppressIntroduction(page);

  await page.goto('/account/login');

  await page.getByLabel('Email address').fill(ADDRESS);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Sign-in makes several sequential network calls, so the redirect is not
  // instant on a cold connection.
  await page.waitForURL(/\/account(\?|$)/, { timeout: 45_000 });
}
