import { expect, test, type Page } from '@playwright/test';

/**
 * Shared helpers for the admin Playwright suite.
 *
 * These tests drive the real admin panel against the real database, so they
 * change real rows. Two rules follow from that, and both are enforced here
 * rather than left to each spec:
 *
 *  1. Never fall back to a default password. If the credentials are missing the
 *     suite must fail loudly, because a silent default either signs in as
 *     nothing (confusing) or, worse, against a credential somebody left in the
 *     repository.
 *  2. Every spec that writes must put back what it found, in `afterAll`. The
 *     brand name and the favicon are site-wide settings, not test fixtures.
 */

export function adminCredentials(): { email: string; password: string } {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set to run the admin Playwright suite. ' +
        'They are read from the environment and never stored in the repository.',
    );
  }

  return { email, password };
}

export async function signIn(page: Page): Promise<void> {
  const { email, password } = adminCredentials();

  await page.goto('/admin/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  /*
   * Wait on the redirect rather than on a heading.
   *
   * The dashboard's <h1> is a stats widget whose text moves as orders come in,
   * so matching it would make this helper fail for reasons that have nothing to
   * do with signing in. Leaving the login page is the actual contract: the
   * action either establishes a session and redirects, or it stays put and
   * renders the error.
   */
  await page.waitForURL((url) => !url.pathname.startsWith('/admin/login'), { timeout: 30_000 });

  /*
   * Confirm the session by an admin-only control.
   *
   * Deliberately not a `role="alert"` check: the dashboard itself renders a
   * live region labelled "Overview", so "no alert on the page" fails on a
   * perfectly good sign-in. The nav only renders for a signed-in admin, and its
   * absence after leaving the login page means the redirect happened without a
   * session.
   */
  await expect(page.getByRole('navigation', { name: 'Admin sections' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

/**
 * The card wrapping one brand image field (Logo, Favicon, Share image).
 *
 * Located by the field's own label rather than by position, so adding a fourth
 * brand image does not silently retarget the favicon tests.
 */
export function brandImageCard(page: Page, name: 'logoId' | 'faviconId' | 'shareImageId') {
  return page.locator('div.rounded-md', {
    has: page.locator(`label[for="brand-image-${name}"]`),
  });
}

/** Uploads a file through a `MediaUploader` that lives inside `card`. */
export async function uploadThrough(
  page: Page,
  card: ReturnType<typeof brandImageCard>,
  file: string,
  alt: string,
): Promise<void> {
  await card.locator('input[type=file]').setInputFiles(file);
  await card.locator('input[name=alt]').fill(alt);
  // The submit button is owned by the form the uploader portals into
  // `document.body`, so it is matched by its own visible label, not by
  // containment within this card.
  await card.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(card.getByText('Added to your media library')).toBeVisible();
}

/**
 * Saves the brand form and waits for *its* confirmation.
 *
 * The confirmation is scoped to the status element beside the save button.
 * `getByRole('status')` on its own is ambiguous: all three brand image fields
 * embed a `MediaUploader`, and each one keeps its own live region alive
 * reporting "Uploaded." A bare role lookup therefore matches four elements and
 * can be satisfied by a message from an unrelated uploader.
 */
export async function saveBrand(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Save brand settings' });
  const status = button.locator('xpath=..').locator('p[role=status]');

  await button.click();
  await expect(status).toContainText(/saved/i);
}

/**
 * Deletes every media row whose alt text matches, along with its stored file.
 *
 * The favicon test uploads a real image on every run. Restoring the brand
 * settings does not remove that image, so without this the library grows a row
 * per run — and the test's own "exactly one option" assertion starts failing
 * for a reason that has nothing to do with the code under test.
 */
export async function deleteMediaByAlt(alt: string): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const { loadEnvFile } = await import('../scripts/lib/env.mjs');

  loadEnvFile();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.from('images').select('id, storage_path').eq('alt', alt);
  if (error) throw new Error(error.message);
  if (!data?.length) return;

  for (const row of data) {
    if (row.storage_path) {
      // A failure here is not worth failing the test over: the database row is
      // the part that shows up in the library and in the picker.
      await supabase.storage.from('media').remove([row.storage_path]).catch(() => undefined);
    }
    await supabase.from('images').delete().eq('id', row.id);
  }
}

/** Reads the current brand record straight from the database. */
export async function readBrand(): Promise<Record<string, unknown>> {
  const { createClient } = await import('@supabase/supabase-js');
  const { loadEnvFile } = await import('../scripts/lib/env.mjs');

  loadEnvFile();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'brand')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.value ?? {}) as Record<string, unknown>;
}

/** Writes the brand record back, used only to restore state. */
export async function writeBrand(value: Record<string, unknown>): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const { loadEnvFile } = await import('../scripts/lib/env.mjs');

  loadEnvFile();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error } = await supabase
    .from('settings')
    .update({ value })
    .eq('key', 'brand');

  if (error) throw new Error(error.message);
}

export { test, expect };
