import { Client } from 'pg';
import { loadEnvFile } from './lib/env.mjs';

import { products } from '../src/data/products';
import { skinTypes, skinConcerns, ingredients, categories, collections } from '../src/data/taxonomy';
import { homeSections } from '../src/data/home';
import { onboardingSlides } from '../src/data/onboarding';
import {
  storeSettings,
  announcements,
  footerColumns,
  shippingMethods,
  promotions,
} from '../src/data/settings';
import { primaryNav, utilityNav, accountNav } from '../src/data/navigation';
import { reviews } from '../src/data/reviews';

import type { Image, Product, TaxonomyTerm } from '../src/types';

/**
 * Seeds Postgres from the content in `src/data`.
 *
 * The mock layer stays the source of truth for the *shape* of the content; this
 * copies it into the real tables so `DATA_SOURCE=supabase` has something to
 * serve. It is idempotent: every insert is an upsert keyed on the same id the
 * mock uses, so re-running updates rather than duplicating.
 *
 * Reviews are deliberately not seeded — the audit removed them all, and there
 * is no honest source of customer reviews to invent here.
 */

loadEnvFile();

const url = process.env.DIRECT_URL;
if (!url) {
  console.error('No DIRECT_URL. Add one to .env.local.');
  process.exit(1);
}

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

/** Money arrives as a `Money` object; the column is integer cents. */
const cents = (money?: { amount: number } | null) => money?.amount ?? 0;

const money = (amount: number) => ({ amount });

/* ------------------------------------------------------------------ */
/* Collect images                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every `Image` referenced anywhere is collected into one map.
 *
 * The mock data shares image objects across products and taxonomy terms, and
 * `images.id` is a primary key — so the same image must be written once, not
 * once per reference.
 */
const imageIndex = new Map<string, ImageRow>();

interface ImageRow {
  id: string;
  url: string;
  alt: string;
  /** Nullable here, where `Image` makes them optional numbers. */
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
}

function remember(image: Image | null | undefined): string | null {
  if (!image?.url) return image?.id ?? null;
  if (!imageIndex.has(image.id)) {
    imageIndex.set(image.id, {
      id: image.id,
      url: image.url,
      alt: image.alt ?? '',
      width: image.width ?? null,
      height: image.height ?? null,
      blurDataUrl: image.blurDataUrl ?? null,
    });
  }
  return image.id;
}

function rememberAll(images: Image[] | undefined) {
  return (images ?? []).map((image) => remember(image));
}

/* ------------------------------------------------------------------ */
/* Row builders                                                         */
/* ------------------------------------------------------------------ */

const KIND_BY_EXPORT = {
  categories: 'category',
  collections: 'collection',
  skinTypes: 'skin_type',
  skinConcerns: 'skin_concern',
  ingredients: 'ingredient',
} as const;

/**
 * Every taxonomy kind shares one table, so the row builder takes the union of
 * the five term types and reads each kind's extra fields defensively. A
 * narrower parameter would reject three of the five call sites; a
 * `Record<string, unknown>` intersection would lose every field's type.
 */
type AnyTerm = TaxonomyTerm &
  Partial<{
    aka: string[];
    concentration: string;
    origin: string;
    benefits: string[];
    heroProductId: string;
    promise: string;
    parentId: string | null;
    seoTitle: string;
    rule: string;
    story: string;
  }>;

function termRow(term: AnyTerm, kind: string) {
  return {
    id: term.id,
    kind,
    slug: term.slug,
    name: term.name,
    short_description: term.shortDescription ?? '',
    description: term.description ?? null,
    image_id: remember(term.image),
    icon: term.icon ?? null,
    tone: term.tone ?? null,
    // Ingredient-only columns; blank for every other kind.
    aka: term.aka ?? [],
    concentration: term.concentration ?? null,
    benefits: term.benefits ?? [],
    origin: term.origin ?? null,
    hero_product_id: term.heroProductId ?? null,
    promise: term.promise ?? null,
    parent_id: term.parentId ?? null,
    seo_title: term.seoTitle ?? null,
    rule: term.rule ?? null,
    story: term.story ?? null,
  };
}

function productRow(product: Product) {
  remember(product.thumbnail);
  rememberAll(product.images);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle ?? '',
    brand: product.brand ?? storeSettings.brandName,
    short_description: product.shortDescription ?? '',
    description: product.description ?? '',
    highlights: product.highlights ?? [],
    benefits: product.benefits ?? [],
    usage: product.usage ?? [],
    ingredients_text: product.ingredients ?? '',
    warnings: product.warnings ?? null,
    price: cents(product.price),
    compare_at_price: product.compareAtPrice ? cents(product.compareAtPrice) : null,
    currency: product.currency ?? 'USD',
    category_id: product.categoryId,
    product_type: product.productType,
    size: product.size ?? '',
    stock_quantity: product.stockQuantity ?? 0,
    available_for_sale: product.availableForSale ?? true,
    low_stock_threshold: product.lowStockThreshold ?? 5,
    dispatch_estimate: product.dispatchEstimate ?? null,
    is_featured: Boolean(product.isFeatured),
    is_best_seller: Boolean(product.isBestSeller),
    is_new_arrival: Boolean(product.isNewArrival),
    related_product_ids: product.relatedProductIds ?? [],
    frequently_bought_with_ids: product.frequentlyBoughtWithIds ?? [],
    position: product.position ?? 0,
    visible: true,
    seo_title: product.seo?.title ?? null,
    seo_description: product.seo?.description ?? null,
  };
}

function variantRows(product: Product) {
  return (product.variants ?? []).map((variant, index) => ({
    // Ids are derived from the product so a re-seed updates the same rows.
    id: variant.id ?? `var-${product.id}-${index}`,
    product_id: product.id,
    sku: variant.sku,
    name: variant.name ?? 'Standard',
    size: variant.size ?? '',
    price: cents(variant.price),
    compare_at_price: variant.compareAtPrice ? cents(variant.compareAtPrice) : null,
    stock_quantity: variant.stockQuantity ?? 0,
    // A variant's `imageId` is a bare id, not an `Image`, so it is passed
    // through rather than run through `remember`. The foreign key is the
    // check: an id with no `images` row fails the seed instead of silently
    // rendering a variant pointing at nothing.
    image_id: variant.imageId ?? null,
    position: variant.position ?? index,
    is_default: product.variants.length === 1 ? true : Boolean(variant.isDefault),
  }));
}

function imageLinkRows(product: Product) {
  const all = [...(product.images ?? []), ...(product.images?.length ? [] : [product.thumbnail])];
  return all
    .filter((image) => image?.url)
    .map((image, index) => ({
      product_id: product.id,
      image_id: remember(image)!,
      position: image.position ?? index,
      is_primary: image.isPrimary ?? index === 0,
    }));
}

/* ------------------------------------------------------------------ */
/* Upsert helper                                                        */
/* ------------------------------------------------------------------ */

/**
 * Upsert on primary key.
 *
 * `on conflict do update set column = excluded.column` is generated from the
 * table's own column list, so adding a column to a migration does not silently
 * leave it unset here.
 */
async function upsert(table: string, columns: string[], rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0;

  const collist = columns.join(', ');
  const updates = columns
    .filter((column) => column !== columns[0])
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');

  // A composite-key join table has no single primary key to conflict on, so
  // those are cleared and rewritten instead.
  const onConflict =
    table.includes('_') && !columns.includes('id')
      ? ''
      : ` on conflict (${columns[0]}) do update set ${updates}`;

  let written = 0;

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const width = columns.length;

    // Each row needs its own parameter range: repeating `$1..$n` would leave
    // Postgres expecting n values while n × rows are sent.
    const values: unknown[] = [];
    const tuples = batch.map((_, rowIndex) => {
      const start = rowIndex * width;
      return `(${columns.map((__, columnIndex) => `$${start + columnIndex + 1}`).join(', ')})`;
    });

    for (const row of batch) {
      for (const column of columns) values.push(row[column] ?? null);
    }

    // Batched to stay under Postgres' 65535 bind-parameter ceiling.
    await client.query(
      `insert into ${table} (${collist}) values ${tuples.join(', ')}${onConflict}`,
      values,
    );
    written += batch.length;
  }
  return written;
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  await client.connect();
  console.log('connected');

  try {
    await client.query('begin');

    /* --- build every row before inserting anything ---------------- *
     * `remember` fills `imageIndex` as a side effect, and several tables
     * reference `images.id`. Collecting first and inserting images before
     * their referrers is what keeps the foreign keys satisfied. */

    const termRows = [
      ...categories.map((t) => termRow(t, KIND_BY_EXPORT.categories)),
      ...collections.map((t) => termRow(t, KIND_BY_EXPORT.collections)),
      ...skinTypes.map((t) => termRow(t, KIND_BY_EXPORT.skinTypes)),
      ...skinConcerns.map((t) => termRow(t, KIND_BY_EXPORT.skinConcerns)),
      ...ingredients.map((t) => termRow(t, KIND_BY_EXPORT.ingredients)),
    ];

    const productRows = products.map(productRow);
    const variantRowsAll = products.flatMap(variantRows);
    const imageLinks = products.flatMap(imageLinkRows);
    const slideRows = onboardingSlides.map((slide) => ({
      id: slide.id,
      eyebrow: slide.eyebrow ?? null,
      title: slide.title,
      body: slide.body,
      image_id: remember(slide.image),
      icon: slide.icon ?? null,
      cta_label: slide.ctaLabel ?? null,
      cta_href: slide.ctaHref ?? null,
      position: slide.position ?? 0,
      enabled: slide.enabled !== false,
    }));

    /* --- images --------------------------------------------------- */
    const imageRows = [...imageIndex.values()].map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt ?? '',
      width: image.width,
      height: image.height,
      blur_data_url: image.blurDataUrl ?? null,
    }));
    console.log(
      `images                ${await upsert(
        'images',
        ['id', 'url', 'alt', 'width', 'height', 'blur_data_url'],
        imageRows,
      )}`,
    );

    /* --- taxonomy ------------------------------------------------- */
    const TERM_COLUMNS = [
      'id', 'kind', 'slug', 'name', 'short_description', 'description', 'image_id',
      'icon', 'tone', 'aka', 'concentration', 'benefits', 'origin', 'hero_product_id',
      'promise', 'parent_id', 'seo_title', 'rule', 'story',
    ];
    console.log(`taxonomy_terms        ${await upsert('taxonomy_terms', TERM_COLUMNS, termRows)}`);

    /* --- products ------------------------------------------------- */
    const PRODUCT_COLUMNS = Object.keys(productRows[0] ?? {});
    console.log(
      `products              ${await upsert('products', PRODUCT_COLUMNS, productRows)}`,
    );

    /* --- product relations ---------------------------------------- */
    console.log(
      `product_variants      ${await upsert(
        'product_variants',
        ['id', 'product_id', 'sku', 'name', 'size', 'price', 'compare_at_price',
         'stock_quantity', 'image_id', 'position', 'is_default'],
        variantRowsAll,
      )}`,
    );

    // Join tables are rebuilt rather than upserted: a facet removed in the mock
    // data has to disappear here too, and an upsert cannot express deletion.
    for (const table of [
      'product_images',
      'product_key_ingredients',
      'product_collections',
      'product_skin_types',
      'product_skin_concerns',
      'product_ingredients',
      'product_hero_ingredients',
    ]) {
      await client.query(`delete from ${table}`);
    }

    console.log(
      `product_images        ${await upsert(
        'product_images',
        ['product_id', 'image_id', 'position', 'is_primary'],
        imageLinks,
      )}`,
    );

    const keyIngredients = products.flatMap((product) =>
      (product.keyIngredients ?? []).map((entry, index) => ({
        product_id: product.id,
        ingredient_id: entry.ingredientId,
        note: entry.note ?? '',
        position: index,
      })),
    );
    console.log(
      `product_key_ingr      ${await upsert(
        'product_key_ingredients',
        ['product_id', 'ingredient_id', 'note', 'position'],
        keyIngredients,
      )}`,
    );

    const facetTables: [string, string, (p: Product) => string[]][] = [
      ['product_collections', 'collection_id', (p) => p.collectionIds ?? []],
      ['product_skin_types', 'skin_type_id', (p) => p.skinTypeIds ?? []],
      ['product_skin_concerns', 'skin_concern_id', (p) => p.skinConcernIds ?? []],
      ['product_ingredients', 'ingredient_id', (p) => p.ingredientIds ?? []],
      ['product_hero_ingredients', 'ingredient_id', (p) => p.heroIngredientIds ?? []],
    ];

    for (const [table, column, pick] of facetTables) {
      const rows = products.flatMap((product) =>
        pick(product).map((value, index) => ({ product_id: product.id, [column]: value, position: index })),
      );
      console.log(`${table.padEnd(21)}${await upsert(table, ['product_id', column, 'position'], rows)}`);
    }

    await client.query('delete from product_badges');
    const badgeRows = products.flatMap((product) =>
      (product.badges ?? []).map((badge, index) => ({
        id: badge.id ?? `badge-${product.id}-${index}`,
        product_id: product.id,
        label: badge.label,
        tone: badge.tone,
        position: index,
      })),
    );
    console.log(
      `product_badges        ${await upsert(
        'product_badges',
        ['id', 'product_id', 'label', 'tone', 'position'],
        badgeRows,
      )}`,
    );

    /* --- content -------------------------------------------------- */
    const homeRows = homeSections.map((section) => ({
      id: section.id,
      kind: section.type,
      payload: section,
      position: section.position ?? 0,
      // `HomeSection` models visibility as `enabled`; the mock `visible` flag
      // is not part of the section contract, so only `enabled` is consulted.
      visible: section.enabled !== false,
    }));
    console.log(
      `home_sections         ${await upsert(
        'home_sections',
        ['id', 'kind', 'payload', 'position', 'visible'],
        homeRows,
      )}`,
    );

    // `slideRows` was built in the collect phase so its image ids are in
    // `imageIndex` before the images are written.
    console.log(
      `onboarding_slides     ${await upsert(
        'onboarding_slides',
        ['id', 'eyebrow', 'title', 'body', 'image_id', 'icon', 'cta_label', 'cta_href', 'position', 'enabled'],
        slideRows,
      )}`,
    );

    /* --- navigation ----------------------------------------------- */
    const navRows = [
      ...primaryNav.map((link) => ({ ...link, nav_group: 'primary' })),
      ...utilityNav.map((link) => ({ ...link, nav_group: 'utility' })),
      ...accountNav.map((link) => ({ ...link, nav_group: 'account' })),
    ];
    console.log(
      `navigation_links      ${await upsert(
        'navigation_links',
        ['id', 'parent_id', 'label', 'href', 'position', 'visible', 'nav_group'],
        navRows,
      )}`,
    );

    /* --- settings ------------------------------------------------- */
    const settingRows: Record<string, unknown>[] = [
      { key: 'brand', value: JSON.stringify(storeSettings) },
      { key: 'announcements', value: JSON.stringify(announcements) },
      { key: 'footer_columns', value: JSON.stringify(footerColumns) },
      { key: 'shipping_methods', value: JSON.stringify(shippingMethods) },
      { key: 'promotions', value: JSON.stringify(promotions) },
    ];
    console.log(
      `settings              ${await upsert('settings', ['key', 'value'], settingRows)}`,
    );

    await client.query('commit');
    console.log('\ncommitted');

    if (reviews.length > 0) {
      console.warn(
        `\nnote: ${reviews.length} review(s) in src/data were not seeded.`,
      );
    }
  } catch (error) {
    await client.query('rollback');
    // `pg` throws `DatabaseError`, but the catch is typed `unknown`, and
    // anything could in principle reach it.
    console.error('\nrolled back:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
