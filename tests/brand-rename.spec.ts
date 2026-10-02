import { expect, readBrand, saveBrand, signIn, test } from './admin-helpers';

/**
 * Does renaming the brand actually rename the brand?
 *
 * The panel says a rename "propagates site-wide without a deploy", so that is
 * the claim under test. A rename that updates the settings row and nothing else
 * is the single most misleading thing this panel could do: it looks correct in
 * the form while the site still says the old name.
 *
 * A deliberately distinctive token is used rather than a plausible name, so a
 * page still showing the old brand cannot accidentally match.
 */

const PROBE = 'Verity Test Brand';
const FINAL = 'Aube';

test.describe('brand rename', () => {
  test('a rename reaches the storefront chrome, titles and structured data', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    const original = String((await readBrand()).brandName ?? 'AUBE');

    await page.getByLabel('Website name').fill(PROBE);
    await saveBrand(page);

    // The write itself.
    expect((await readBrand()).brandName, 'the settings row is updated').toBe(PROBE);

    /*
     * The storefront, fetched as a plain request.
     *
     * Reading the HTML rather than the rendered page is deliberate: a
     * client-side transition can show a new wordmark while `<title>` and the
     * JSON-LD are still the old ones, and it is that metadata which search
     * engines and link previews consume.
     */
    const homeHtml = await (await page.request.get('/')).text();

    expect(homeHtml, 'the header wordmark is renamed').toContain(`${PROBE} — home`);
    expect(homeHtml, 'the structured data site name is renamed').toContain(`"${PROBE}"`);
    expect(homeHtml, 'the home page title is renamed').toContain(`<title>${PROBE}`);

    const shopHtml = await (await page.request.get('/shop')).text();
    expect(shopHtml, 'the shop page title is renamed').toContain(PROBE);

    // Put it back before the next test so the two never race.
    await page.getByLabel('Website name').fill(original);
    await saveBrand(page);
    expect((await readBrand()).brandName).toBe(original);
  });

  test('no page keeps the old brand after a rename', async ({ page }) => {
    /*
     * A known gap, measured rather than assumed.
     *
     * `saveBrandSettings` calls `revalidatePath('/', 'layout')`, which is what
     * updates the header and footer. It does not revalidate individual routes,
     * so a statically generated page whose metadata embeds `settings.brandName`
     * can keep the old name until the next build — a rename that looks done in
     * the panel and is half-done on the site.
     *
     * This walks the routes that reference the brand and reports the ones that
     * did not pick it up. If any are listed, the fix belongs in the action.
     */
    await signIn(page);
    await page.goto('/admin/settings');

    const original = String((await readBrand()).brandName ?? 'AUBE');

    const routes = ['/', '/shop', '/cart', '/checkout', '/search', '/about', '/faq', '/journal'];

    await page.getByLabel('Website name').fill(PROBE);
    await saveBrand(page);

    const stale: string[] = [];
    for (const route of routes) {
      const response = await page.request.get(route);
      if (response.status() !== 200) continue;
      const html = await response.text();
      // Stale means it neither shows the new name nor simply omits the brand.
      if (!html.includes(PROBE) && html.includes(original)) stale.push(route);
    }

    await page.getByLabel('Website name').fill(original);
    await saveBrand(page);
    expect((await readBrand()).brandName, 'the original name is restored').toBe(original);

    expect(
      stale,
      `pages still showing "${original}" after a rename to "${PROBE}"`,
    ).toEqual([]);
  });

  test('the brand name is set to Aube', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    await page.getByLabel('Website name').fill(FINAL);
    await saveBrand(page);

    expect((await readBrand()).brandName, 'the stored brand name').toBe(FINAL);

    const home = await (await page.request.get('/')).text();
    expect(home, 'the storefront chrome shows the new name').toContain(`${FINAL} — home`);
    expect(home, 'the home page title shows the new name').toContain(`<title>${FINAL}`);
  });

  test('the wordmark still uppercases the name for display', async ({ page }) => {
    /*
     * Recorded rather than fixed.
     *
     * `Wordmark` applies `text-transform: uppercase` in CSS, so the stored name
     * "Aube" renders as "AUBE" in the header and footer. The data is correct and
     * the aria-label, title and structured data all read "Aube"; only the
     * visible wordmark is affected. This is a typographic choice rather than a
     * data bug, and it is asserted here so the difference is on the record
     * instead of surprising somebody who typed "Aube" and still sees capitals.
     */
    await signIn(page);
    const home = await (await page.request.get('/')).text();

    expect(home, 'the wordmark applies uppercase').toContain('uppercase');
    expect(home, 'the accessible name keeps the stored casing').toContain('Aube — home');
  });
});
