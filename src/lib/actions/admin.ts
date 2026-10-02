'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAuth } from '@/lib/supabase/admin-auth';
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProduct,
  replaceProductRelations,
  updateAdminProduct,
  type AdminProductDetail,
  type ProductRelationsWrite,
  type ProductWrite,
  type VariantWrite,
} from '@/lib/supabase/admin-data';
import {
  createOnboardingSlide,
  deleteOnboardingSlide,
  moderateReview,
  reorderHomeSections,
  reorderOnboardingSlides,
  setSectionEnabled,
  updateHomeSection,
  updateHomeSectionPayload,
  createHomeSection,
  updateMediaAlt,
  updateOnboardingSlide,
  writeBrandSettings,
  type BrandSettings,
  type SectionWrite,
  type SlideWrite,
} from '@/lib/supabase/admin-content';
import { deleteMedia, uploadImage } from '@/lib/supabase/storage';
import { setOrderStatus } from '@/lib/supabase/order-fulfilment';

/**
 * Admin mutations.
 *
 * Server-only by construction: the modules these import have
 * `import 'server-only'`, so a client component cannot reach them.
 *
 * Every action returns a discriminated `AdminActionResult` rather than
 * throwing, because these are called from `<form>` submissions where an
 * exception would land the user on the error boundary with no way back to the
 * field they got wrong.
 *
 * Every action re-checks authorisation. The admin pages gate rendering on
 * `getAdminAuth`, but a server action is its own endpoint and can be called
 * directly by anything that can reach the site, so the page guard is a
 * rendering concern, not a security boundary. The check here is.
 */

export type AdminActionResult =
  | { ok: true; id: string; message: string }
  | { ok: false; message: string };

/**
 * Resolve the caller, or produce the refusal to return.
 *
 * `no_session` and `not_configured` deliberately produce the same message: the
 * panel explains both on the page, and an action response should not tell a
 * prober which one it hit.
 */
async function authorise(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const auth = await getAdminAuth();
  if (!auth.authenticated) {
    return { ok: false, message: 'You are not authorised to perform this action.' };
  }
  return { ok: true, userId: auth.userId };
}

/** Submits come from untrusted input even on an authenticated page. */
function asString(value: FormDataEntryValue | null, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function asInt(value: FormDataEntryValue | null, min = 0, max = 100_000_000): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

function asBool(value: FormDataEntryValue | null): boolean {
  return value === 'on' || value === 'true' || value === '1';
}

function asOptionalString(value: FormDataEntryValue | null, max = 500): string | null {
  const trimmed = asString(value, max);
  return trimmed === '' ? null : trimmed;
}

/** Slugs are the storefront's URL contract, so they stay conservative. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** One item per line, blank lines dropped. */
function asLineList(value: FormDataEntryValue | null, maxItems = 40, maxLength = 400): string[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((line) => line.slice(0, maxLength));
}

/** Every value of a repeated field, which is how multi-checkbox groups post. */
function asStringList(form: FormData, name: string, maxItems = 60, maxLength = 64): string[] {
  return form
    .getAll(name)
    .map((value) => asString(value, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Dollars as typed in the form, to integer cents. Null when left blank. */
function asCents(value: FormDataEntryValue | null): number | null {
  const trimmed = asString(value, 20);
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

const PRODUCT_TYPE_VALUES = new Set([
  'cleanser',
  'moisturiser',
  'serum',
  'toner',
  'mask',
  'spf',
]);

const BADGE_TONE_VALUES = new Set(['neutral', 'moss', 'clay', 'ink', 'danger']);

function readProductFields(form: FormData): ProductWrite {
  const name = asString(form.get('name'), 120);
  const rawSlug = asString(form.get('slug'), 80);
  const price = asCents(form.get('price')) ?? 0;
  const productType = asString(form.get('product_type'), 20);

  return {
    name,
    // A blank slug field falls back to the name, so creating a product does not
    // require the operator to also think about URLs.
    slug: slugify(rawSlug || name),
    subtitle: asString(form.get('subtitle'), 200),
    brand: asString(form.get('brand'), 80),
    short_description: asString(form.get('short_description'), 400),
    description: asString(form.get('description'), 8000),
    highlights: asLineList(form.get('highlights')),
    benefits: asLineList(form.get('benefits')),
    usage: asLineList(form.get('usage')),
    ingredients_text: asString(form.get('ingredients_text'), 4000),
    warnings: asLineList(form.get('warnings'), 10, 200),
    // Prices are posted in dollars for operator sanity and stored in cents,
    // matching `Money.amount` and the `products.price` column.
    price,
    compare_at_price: asCents(form.get('compare_at_price')),
    category_id: asString(form.get('category_id'), 64),
    product_type: (PRODUCT_TYPE_VALUES.has(productType) ? productType : 'serum') as ProductWrite['product_type'],
    stock_quantity: asInt(form.get('stock_quantity'), 0, 1_000_000),
    low_stock_threshold: asInt(form.get('low_stock_threshold'), 0, 1000),
    dispatch_estimate: asOptionalString(form.get('dispatch_estimate'), 120),
    available_for_sale: asBool(form.get('available_for_sale')),
    visible: asBool(form.get('visible')),
    is_featured: asBool(form.get('is_featured')),
    is_best_seller: asBool(form.get('is_best_seller')),
    is_new_arrival: asBool(form.get('is_new_arrival')),
    seo_title: asOptionalString(form.get('seo_title'), 200),
    seo_description: asOptionalString(form.get('seo_description'), 400),
  };
}

/**
 * Read the relation rows that accompany a product save.
 *
 * Variants are indexed by position rather than sent as JSON, so the form can
 * keep the row state it needs for reordering and still post a plain form.
 */
function readProductRelations(
  form: FormData,
  existing: AdminProductDetail | null,
): ProductRelationsWrite {
  const variantCount = Math.min(asInt(form.get('variant_count'), 0, 30), 30);

  const variants: VariantWrite[] = [];
  const seenSkus = new Set<string>();

  for (let index = 0; index < variantCount; index += 1) {
    const size = asString(form.get(`variant_size_${index}`), 40);
    const name = asString(form.get(`variant_name_${index}`), 60);
    const price = asCents(form.get(`variant_price_${index}`));

    // A row with nothing in it is a half-typed row, not a size to save.
    if (price === null && !size && !name) continue;

    let sku = asString(form.get(`variant_sku_${index}`), 60);
    if (!sku) {
      // SKUs are unique across the catalogue, so a missing one is composed from
      // the product slug and the size rather than left blank.
      const base = `${existing?.slug ?? 'product'}-${slugify(size || name || String(index + 1))}`;
      sku = base;
      let suffix = 2;
      while (seenSkus.has(sku) || (existing?.variants.some((v) => v.sku === sku) ?? false)) {
        sku = `${base}-${suffix++}`;
      }
    }
    seenSkus.add(sku);

    const previous = existing?.variants[index];

    variants.push({
      id: previous?.id,
      sku,
      name: name || 'Standard',
      size,
      price: price ?? 0,
      compareAtPrice: asCents(form.get(`variant_compare_${index}`)),
      stockQuantity: asInt(form.get(`variant_stock_${index}`), 0, 1_000_000),
      imageId: previous?.image_id ?? null,
      isDefault: asBool(form.get(`variant_default_${index}`)),
    });
  }

  const keyIngredientCount = Math.min(asInt(form.get('key_ingredient_count'), 0, 20), 20);
  const keyIngredients = [];
  for (let index = 0; index < keyIngredientCount; index += 1) {
    const ingredientId = asString(form.get(`key_ingredient_${index}`), 64);
    if (!ingredientId) continue;
    keyIngredients.push({
      ingredientId,
      note: asString(form.get(`key_ingredient_note_${index}`), 200),
      position: keyIngredients.length,
    });
  }

  const badgeCount = Math.min(asInt(form.get('badge_count'), 0, 6), 6);
  const badges = [];
  for (let index = 0; index < badgeCount; index += 1) {
    const label = asString(form.get(`badge_label_${index}`), 40);
    if (!label) continue;
    const tone = asString(form.get(`badge_tone_${index}`), 20);
    badges.push({
      label,
      tone: BADGE_TONE_VALUES.has(tone) ? tone : 'neutral',
      position: badges.length,
    });
  }

  const imageIds = asStringList(form, 'image_ids', 12);
  const primaryImageId = asOptionalString(form.get('primary_image_id'), 64);

  return {
    variants,
    imageIds,
    // A primary that is not in the selection would render nothing, so it falls
    // back to the first chosen image.
    primaryImageId:
      primaryImageId && imageIds.includes(primaryImageId) ? primaryImageId : (imageIds[0] ?? null),
    badges,
    keyIngredients,
    collectionIds: asStringList(form, 'collection_ids'),
    skinTypeIds: asStringList(form, 'skin_type_ids'),
    skinConcernIds: asStringList(form, 'skin_concern_ids'),
    ingredientIds: asStringList(form, 'ingredient_ids'),
    heroIngredientIds: asStringList(form, 'hero_ingredient_ids'),
  };
}

export async function saveProduct(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const id = asString(formData.get('id'), 64);
  const values = readProductFields(formData);

  const auth = await authorise();
  if (!auth.ok) return auth;

  if (!values.name) {
    return { ok: false, message: 'A product needs a name.' };
  }
  if (!values.slug) {
    return { ok: false, message: 'That name does not produce a usable slug.' };
  }
  if (!values.category_id) {
    return { ok: false, message: 'Choose a category so the product can be browsed and filtered.' };
  }

  try {
    if (id) {
      const existing = await getAdminProduct(id);
      if (!existing) return { ok: false, message: 'That product no longer exists.' };

      await updateAdminProduct(id, values);
      await replaceProductRelations(id, readProductRelations(formData, existing));

      revalidatePath(`/admin/products/${id}`);
      revalidatePath('/admin/products');
      revalidatePath('/shop');
      revalidatePath(`/products/${values.slug}`);
      return { ok: true, id, message: `Saved ${values.name}.` };
    }

    // Ids are supplied rather than generated so the storefront's existing
    // `prd-…` convention carries over unchanged.
    const newId = asString(formData.get('new_id'), 64) || `prd-${Date.now().toString(36)}`;
    const created = await createAdminProduct(newId, values);
    if (!created) return { ok: false, message: 'Supabase is not configured.' };

    await replaceProductRelations(newId, readProductRelations(formData, null));

    revalidatePath('/admin/products');
    revalidatePath('/shop');
    return { ok: true, id: created, message: `Created ${values.name}.` };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function removeProduct(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const id = asString(formData.get('id'), 64);
  if (!id) return { ok: false, message: 'Missing product id.' };

  const auth = await authorise();
  if (!auth.ok) return auth;

  try {
    await deleteAdminProduct(id);
    revalidatePath('/admin/products');
    revalidatePath('/shop');
    return { ok: true, id, message: 'Product deleted.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function setProductVisibility(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const id = asString(formData.get('id'), 64);
  const visible = asBool(formData.get('visible'));
  if (!id) return { ok: false, message: 'Missing product id.' };

  const auth = await authorise();
  if (!auth.ok) return auth;

  try {
    await updateAdminProduct(id, { visible });
    revalidatePath('/admin/products');
    revalidatePath('/shop');
    return { ok: true, id, message: visible ? 'Product is visible.' : 'Product hidden.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/** Surfaces a Postgres constraint message instead of a generic failure. */
function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/duplicate key|unique/i.test(raw)) {
    return 'That slug is already taken by another product.';
  }
  if (/foreign key/i.test(raw)) {
    return 'That product is still referenced elsewhere and cannot be changed.';
  }
  return raw;
}

/* ------------------------------------------------------------------ */
/* Homepage sections                                                   */
/* ------------------------------------------------------------------ */

function readSectionFields(formData: FormData): Partial<SectionWrite> {
  const ctaLabel = asString(formData.get('cta_label'), 60);
  const ctaHref = asString(formData.get('cta_href'), 300);
  const style = asString(formData.get('cta_style'), 20);

  return {
    eyebrow: asString(formData.get('eyebrow'), 80) || null,
    title: asString(formData.get('title'), 200) || null,
    subtitle: asString(formData.get('subtitle'), 400) || null,
    body: asString(formData.get('body'), 4000) || null,
    // A label with no destination is a dead link; both or neither.
    ctaLabel: ctaLabel || null,
    ctaHref: ctaHref || null,
    ctaStyle: (['primary', 'secondary', 'text'] as const).includes(style as never)
      ? (style as SectionWrite['ctaStyle'])
      : null,
    imageId: asString(formData.get('image_id'), 64) || null,
    enabled: asBool(formData.get('enabled')),
  };
}

export async function addHomeSection(formData: FormData): Promise<void> {
  const auth = await authorise();
  if (!auth.ok) return;

  const kind = asString(formData.get('kind'), 40);
  try {
    await createHomeSection(kind);
    revalidatePath('/admin/homepage');
  } catch (error) {
    console.error('addHomeSection', messageFor(error));
  }
}

/**
 * Saves the category selection on a `category-showcase` section.
 *
 * Separate from `saveHomeSection` because the generic form only knows the
 * shared columns. The category list and the two counts live in the section's
 * payload, and merging them is what keeps the rest of the payload intact.
 */
export async function saveCategoryShowcase(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const id = asString(formData.get('id'), 64);
  if (!id) return { ok: false, message: 'Missing section id.' };

  const categoryIds = asStringList(formData, 'category_ids', 12, 64);

  const clamp = (value: FormDataEntryValue | null, fallback: number, min: number, max: number) => {
    const parsed = Number(asString(value, 4));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  };

  try {
    await updateHomeSectionPayload(id, {
      type: 'category-showcase',
      categoryIds,
      perCategory: clamp(formData.get('per_category'), 4, 2, 8),
      maxCategories: clamp(formData.get('max_categories'), 4, 1, 8),
    });
    revalidatePath('/admin/homepage');
    revalidatePath('/');
    return {
      ok: true,
      id,
      message: categoryIds.length
        ? `Saved. ${categoryIds.length} ${categoryIds.length === 1 ? 'category' : 'categories'} will show on the homepage.`
        : 'Saved. With no categories selected this section shows nothing — tick at least one to switch it on.',
    };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function saveHomeSection(  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const id = asString(formData.get('id'), 64);
  if (!id) return { ok: false, message: 'Missing section id.' };

  const values = readSectionFields(formData);
  if (values.ctaLabel && !values.ctaHref) {
    return { ok: false, message: 'A call to action needs a destination as well as a label.' };
  }

  try {
    await updateHomeSection(id, values);
    revalidatePath('/admin/homepage');
    revalidatePath('/');
    return { ok: true, id, message: 'Section saved.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function toggleSection(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const id = asString(formData.get('id'), 64);
  const enabled = asBool(formData.get('enabled'));
  if (!id) return { ok: false, message: 'Missing section id.' };

  try {
    await setSectionEnabled(id, enabled);
    revalidatePath('/admin/homepage');
    revalidatePath('/');
    return { ok: true, id, message: enabled ? 'Section is live.' : 'Section hidden.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function reorderHomepageSections(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const raw = asString(formData.get('order'), 4000);
  const order = raw.split(',').map((id) => id.trim()).filter(Boolean);
  if (order.length === 0) return { ok: false, message: 'Nothing to reorder.' };

  try {
    await reorderHomeSections(order);
    revalidatePath('/admin/homepage');
    revalidatePath('/');
    return { ok: true, id: 'homepage', message: 'Homepage order updated.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Onboarding slides                                                   */
/* ------------------------------------------------------------------ */

/** The glyphs `Icon` can actually render; anything else fails at write time. */
const ICONS = new Set([
  'cart', 'heart', 'search', 'user', 'menu', 'close', 'chevron-down', 'chevron-right',
  'chevron-left', 'arrow-right', 'arrow-left', 'plus', 'minus', 'check', 'star', 'filter',
  'truck', 'leaf', 'droplet', 'sun', 'sparkle', 'shield', 'flask', 'moon', 'wind', 'trash',
  'refresh', 'grid', 'rows', 'info', 'lock', 'package', 'gift',
]);

function readSlideFields(formData: FormData): SlideWrite {
  const icon = asString(formData.get('icon'), 30);
  const imageId = asString(formData.get('image_id'), 64);
  const ctaLabel = asString(formData.get('cta_label'), 60);
  const ctaHref = asString(formData.get('cta_href'), 300);

  return {
    eyebrow: asString(formData.get('eyebrow'), 80) || null,
    title: asString(formData.get('title'), 160),
    body: asString(formData.get('body'), 2000),
    imageId: imageId || null,
    icon: ICONS.has(icon) ? icon : null,
    ctaLabel: ctaLabel || null,
    ctaHref: ctaHref || null,
    position: asInt(formData.get('position'), 0, 999),
    enabled: asBool(formData.get('enabled')),
  };
}

function validateSlide(values: SlideWrite): string | null {
  if (!values.title) return 'A slide needs a title.';
  if (!values.body) return 'A slide needs a body.';
  if (!values.imageId && !values.icon) return 'A slide needs an image or an icon.';
  if ((values.ctaLabel && !values.ctaHref) || (!values.ctaLabel && values.ctaHref)) {
    return 'A call to action needs both a label and a destination.';
  }
  return null;
}

export async function saveOnboardingSlide(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const id = asString(formData.get('id'), 64);
  const values = readSlideFields(formData);

  const invalid = validateSlide(values);
  if (invalid) return { ok: false, message: invalid };

  try {
    if (id) {
      await updateOnboardingSlide(id, values);
      revalidatePath('/admin/onboarding');
      revalidatePath('/');
      return { ok: true, id, message: 'Slide saved.' };
    }

    const newId = asString(formData.get('new_id'), 64) || `ob-${Date.now().toString(36)}`;
    await createOnboardingSlide(newId, values);
    revalidatePath('/admin/onboarding');
    revalidatePath('/');
    return { ok: true, id: newId, message: 'Slide created.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function removeOnboardingSlide(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const id = asString(formData.get('id'), 64);
  if (!id) return { ok: false, message: 'Missing slide id.' };

  try {
    await deleteOnboardingSlide(id);
    revalidatePath('/admin/onboarding');
    revalidatePath('/');
    return { ok: true, id, message: 'Slide deleted.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function reorderOnboarding(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const raw = asString(formData.get('order'), 4000);
  const order = raw.split(',').map((id) => id.trim()).filter(Boolean);
  if (order.length === 0) return { ok: false, message: 'Nothing to reorder.' };

  try {
    await reorderOnboardingSlides(order);
    revalidatePath('/admin/onboarding');
    revalidatePath('/');
    return { ok: true, id: 'onboarding', message: 'Slide order updated.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Brand settings                                                      */
/* ------------------------------------------------------------------ */

function readBrandFields(formData: FormData): BrandSettings {
  return {
    brandName: asString(formData.get('brandName'), 60),
    legalName: asString(formData.get('legalName'), 120),
    brandCode: (asString(formData.get('brandCode'), 10) || 'WEB').toUpperCase(),
    tagline: asString(formData.get('tagline'), 160),
    description: asString(formData.get('description'), 500),
    supportEmail: asString(formData.get('supportEmail'), 120),
    supportPhone: asString(formData.get('supportPhone'), 40),
    address: asString(formData.get('address'), 300),
    logoId: asString(formData.get('logoId'), 64) || null,
    logoAlt: asString(formData.get('logoAlt'), 120),
    faviconId: asString(formData.get('faviconId'), 64) || null,
    shareImageId: asString(formData.get('shareImageId'), 64) || null,
    seoTitle: asString(formData.get('seoTitle'), 160),
    seoDescription: asString(formData.get('seoDescription'), 300),
  };
}

export async function saveBrandSettings(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const values = readBrandFields(formData);
  if (!values.brandName) return { ok: false, message: 'The business needs a name.' };
  if (!/^[A-Z0-9]{2,10}$/.test(values.brandCode)) {
    return { ok: false, message: 'The brand code must be 2–10 letters or digits, no spaces.' };
  }
  if (values.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.supportEmail)) {
    return { ok: false, message: 'That does not look like a valid email address.' };
  }

  try {
    await writeBrandSettings(values);
    revalidatePath('/admin/settings');
    // A brand change reaches the whole site, so every path that renders the
    // chrome has to be revalidated, not just the settings page.
    revalidatePath('/', 'layout');
    return { ok: true, id: 'brand', message: 'Brand settings saved.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

const MEDIA_FOLDERS = new Set([
  'products',
  'categories',
  'homepage',
  'onboarding',
  'branding',
  'reviews',
]);

export interface MediaActionResult {
  ok: boolean;
  message: string;
  /** Id to paste into an image field once the upload succeeds. */
  id?: string;
  url?: string;
}

export async function uploadMediaImage(
  _prev: MediaActionResult | null,
  formData: FormData,
): Promise<MediaActionResult> {
  const auth = await authorise();
  if (!auth.ok) return { ok: false, message: auth.message };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose a file to upload.' };
  }

  const folder = asString(formData.get('folder'), 40);
  const alt = asString(formData.get('alt'), 200);

  if (!MEDIA_FOLDERS.has(folder)) {
    return { ok: false, message: 'Unknown upload folder.' };
  }
  if (!alt) {
    // Alt text is not decoration: an image with no alt is unreadable to a
    // screen reader, and product photography is exactly where that matters.
    return { ok: false, message: 'Describe the image so it is accessible.' };
  }

  try {
    const result = await uploadImage(file, { folder, alt, uploadedBy: auth.userId });
    return {
      ok: result.ok,
      message: result.message,
      id: result.media?.id,
      url: result.media?.url,
    };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function renameMedia(
  _prev: MediaActionResult | null,
  formData: FormData,
): Promise<MediaActionResult> {
  const auth = await authorise();
  if (!auth.ok) return { ok: false, message: auth.message };

  const id = asString(formData.get('id'), 64);
  const alt = asString(formData.get('alt'), 200);
  if (!id) return { ok: false, message: 'Missing image id.' };
  if (!alt) return { ok: false, message: 'Alt text cannot be empty.' };

  try {
    await updateMediaAlt(id, alt);
    revalidatePath('/admin/media');
    return { ok: true, message: 'Alt text updated.', id };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function removeMedia(
  _prev: MediaActionResult | null,
  formData: FormData,
): Promise<MediaActionResult> {
  const auth = await authorise();
  if (!auth.ok) return { ok: false, message: auth.message };

  const id = asString(formData.get('id'), 64);
  const storagePath = asString(formData.get('storage_path'), 300);
  if (!id) return { ok: false, message: 'Missing image id.' };

  try {
    await deleteMedia({ id, storagePath: storagePath || null });
    revalidatePath('/admin/media');
    return { ok: true, message: 'Image deleted.', id };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Review moderation                                                   */
/* ------------------------------------------------------------------ */

export async function moderate(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const id = asString(formData.get('id'), 64);
  if (!id) return { ok: false, message: 'Missing review id.' };

  const status = asString(formData.get('moderation_status'), 20);
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return { ok: false, message: 'Unknown moderation status.' };
  }

  try {
    await moderateReview(
      id,
      {
        moderationStatus: status as 'pending' | 'approved' | 'rejected',
        published: asBool(formData.get('published')),
      },
      auth.userId,
    );
    revalidatePath('/admin/reviews');
    // Approving a review changes the product's public rating, so the product
    // page and its JSON-LD have to be rebuilt too.
    revalidatePath('/shop');
    return { ok: true, id, message: 'Review updated.' };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Order fulfilment                                                     */
/* ------------------------------------------------------------------ */

/**
 * Moves an order along and tells the shopper.
 *
 * Authorisation is the default editor check rather than the `admin` gate the
 * credential actions use. An editor who can mark an order shipped can also get
 * it shipped by hand, so the extra restriction buys nothing — and locking the
 * fulfilment queue to one role is how a backlog builds up with nothing anyone on
 * shift can clear.
 *
 * The transition itself is validated in `setOrderStatus`, not here: this action
 * is reachable by anyone who can reach the form endpoint, and the check has to
 * survive that.
 */
export async function updateOrderStatus(
  _prev: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await authorise();
  if (!auth.ok) return auth;

  const id = asString(formData.get('id'), 64);
  const status = asString(formData.get('status'), 20);

  if (!id) return { ok: false, message: 'Missing order id.' };
  if (!status) return { ok: false, message: 'Missing order status.' };

  try {
    const result = await setOrderStatus(id, status);

    if (!result.ok) return { ok: false, message: result.message };

    revalidatePath('/admin/orders');
    // The shopper's order page and their confirmation both render this status.
    revalidatePath('/account/orders');

    /*
     * A failed email is reported rather than hidden. The status change did
     * happen, so the message says so — otherwise an operator retries the whole
     * action and the order ends up with two "Dispatched" timeline rows.
     */
    const emailNote = result.emailed
      ? ' A confirmation email was sent.'
      : status === 'shipped' || status === 'delivered'
        ? ' The email was not sent — check Admin → Messaging.'
        : '';

    return { ok: true, id, message: `Order moved to ${result.status}.${emailNote}` };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}
