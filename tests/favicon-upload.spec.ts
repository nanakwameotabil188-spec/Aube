import {
  brandImageCard,
  deleteMediaByAlt,
  expect,
  readBrand,
  saveBrand,
  signIn,
  test,
  uploadThrough,
  writeBrand,
} from './admin-helpers';

/**
 * Does uploading a favicon in the admin panel actually do anything?
 *
 * The claim being tested is the one in the panel's own copy: that a favicon
 * chosen here is "the small icon in the browser tab". That was previously a
 * decorative field storing an id nothing ever read, so the test asserts on the
 * thing an operator would check â€” the icon the browser actually requests â€” and
 * not merely on the id landing in the database.
 */

const FIXTURE = 'tests/fixtures/favicon-test.png';

/**
 * Unique per run, so a leftover from an earlier run can never be mistaken for
 * this run's upload.
 */
const ALT = `Playwright favicon fixture ${Date.now()}`;

test.describe('favicon upload', () => {
  let original: Record<string, unknown>;

  test.beforeAll(async () => {
    original = await readBrand();
  });

  test.afterAll(async () => {
    // The favicon is site-wide: leaving a test icon in place would show up in
    // every browser tab and every page view until somebody noticed.
    await writeBrand(original);
    await deleteMediaByAlt(ALT);
  });

  test('an uploaded favicon becomes the icon the browser tab requests', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    const card = brandImageCard(page, 'faviconId');

    // Before anything is chosen the route must not be serving an icon, so a
    // later "it works" cannot be the pre-existing default.
    const before = await page.request.get('/branding/favicon', { maxRedirects: 0 });
    expect(before.status(), 'no favicon is set before this test').toBe(204);

    await uploadThrough(page, card, FIXTURE, ALT);

    /*
     * The upload puts the image in the library. It does not choose it — the
     * select is a separate, explicit step, and a test that skipped it would
     * pass while the favicon was still unset.
     */
    const select = page.locator('#brand-image-faviconId');
    await expect(select.locator('option', { hasText: ALT })).toHaveCount(1);
    await select.selectOption({ label: ALT });

    // The preview must switch too, or the operator is saving an id they cannot see.
    await expect(card.locator('img')).toBeVisible();

    await saveBrand(page);

    // The id is stored...
    const stored = (await readBrand()).faviconId;
    expect(stored, 'the favicon id is persisted').toBeTruthy();

    // ...and the icon the browser tab requests is now a real image.
    const after = await page.request.get('/branding/favicon', { maxRedirects: 0 });
    expect(after.status(), 'the favicon route redirects to the chosen image').toBe(302);

    const location = after.headers()['location'];
    expect(location).toBeTruthy();

    const image = await page.request.get(location!);
    expect(image.status(), 'the favicon image itself is reachable').toBe(200);
    expect(image.headers()['content-type'], 'it is served as an image').toMatch(/^image\//);
    expect((await image.body()).length, 'it is not an empty response').toBeGreaterThan(0);
  });

  test('the chosen favicon is referenced by the storefront head', async ({ page }) => {
    await signIn(page);

    const storefront = await page.context().newPage();
    await storefront.goto('/');

    const href = await storefront
      .locator('link[rel=icon]')
      .first()
      .getAttribute('href');

    expect(href, 'the storefront links a favicon').toBeTruthy();
    expect(href).toContain('/branding/favicon');
  });
});


