import { expect, signIn, test } from './admin-helpers';

/**
 * Where the image uploader sits in the product form.
 *
 * An editor opening a product to add a photograph had to scroll past Identity,
 * Copy, Ingredients, Pricing and every size row to reach it. This asserts the
 * control is reachable near the top of the document — the thing that was wrong —
 * rather than pinning a brittle index that a later section could invalidate.
 */

test.describe('product image placement', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/products');

    // Any real product will do; the form is the same for all of them. The
    // "new product" link is skipped so the test does not depend on what happens
    // to be first in the catalogue.
    const first = page.locator('a[href^="/admin/products/"]').first();
    await expect(first, 'the catalogue lists at least one product').toBeVisible();
    await first.click();

    await expect(page.getByText('+ Upload a product image')).toBeAttached();
  });

  test('the image uploader is near the top of the form', async ({ page }) => {
    const summary = page.getByText('+ Upload a product image');

    /*
     * Measured against the viewport rather than a fixed pixel count: what
     * matters is that the control is not below the fold, and "the fold" is a
     * property of the screen the editor is using.
     */
    const position = await summary.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top + window.scrollY, viewport: window.innerHeight };
    });

    expect(
      position.top,
      `the upload control starts ${Math.round(position.top)}px down a ${position.viewport}px viewport`,
    ).toBeLessThan(position.viewport * 1.5);
  });

  test('images come before the long copy and variant sections', async ({ page }) => {
    // `Section` renders a <fieldset> with a <legend>, not a heading.
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('fieldset')]
        .map((el) => el.querySelector('legend')?.textContent?.trim() ?? '')
        .filter(Boolean),
    );

    const indexOf = (needle: RegExp) => order.findIndex((label) => needle.test(label));

    const images = indexOf(/^images$/i);
    expect(images, `an Images section exists (sections: ${order.join(' | ')})`).toBeGreaterThanOrEqual(0);

    for (const later of [/^copy$/i, /^ingredients$/i, /^sizes and variants$/i]) {
      const at = indexOf(later);
      if (at >= 0) {
        expect(images, `Images (${images}) should come before ${later.source} (${at})`).toBeLessThan(at);
      }
    }
  });

  test('the uploader still posts its own form, not the product form', async ({ page }) => {
    // The regression this layout is prone to: an uploader nested inside the
    // product form posts the product instead of uploading, appearing to work
    // while uploading nothing.
    const ownership = await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('input[type=file]');
      if (!input) return null;
      const form = input.form;
      return {
        hasFormOwner: Boolean(form),
        isProductForm: Boolean(form?.elements.namedItem('price')),
        inBody: form?.parentElement === document.body,
      };
    });

    expect(ownership).not.toBeNull();
    expect(ownership!.hasFormOwner, 'the file input belongs to a form').toBe(true);
    expect(
      ownership!.isProductForm,
      'the file input must not belong to the product form',
    ).toBe(false);
    expect(ownership!.inBody, 'the upload form is portalled to the body').toBe(true);
  });
});
