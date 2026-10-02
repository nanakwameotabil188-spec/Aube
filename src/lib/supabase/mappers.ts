import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import type {
  Category,
  Collection,
  Image,
  Ingredient,
  Product,
  ProductBadge,
  ProductVariant,
  SkinConcern,
  TaxonomyTerm,
} from '@/types';

/**
 * Row → domain mappers.
 *
 * The point of this file: Supabase rows are flat and snake_case, the domain
 * contracts are nested and camelCase. Mapping happens once, here, so the rest of
 * the app keeps working against the same `Product` shape whether the data came
 * from Postgres or from `src/data`.
 *
 * Every mapper is defensive about optional relations. A product with no images,
 * no variants or no reviews is normal — a new draft, or a partially imported
 * catalog — and must not throw while rendering a grid.
 */

export type Db = SupabaseClient<Database>;

/** A taxonomy term row, as selected by the catalog queries. */
export interface TermRow {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string | null;
  image_id: string | null;
  icon: string | null;
  tone: string | null;
  position: number;
  status: string;
  visible: boolean;
  seo_title: string | null;
  seo_description: string | null;
  seo_canonical_path: string | null;
  seo_no_index: boolean;
  created_at: string;
  updated_at: string;
  aka: string[] | null;
  concentration: string | null;
  benefits: string[] | null;
  origin: string | null;
  hero_product_id: string | null;
  // Concern-only
  promise: string | null;
  // Category-only
  parent_id: string | null;
  product_type: string | null;
  // Collection-only
  rule: string | null;
  product_ids: string[] | null;
  featured_product_id: string | null;
  story: string | null;
}

export function mapImage(row: { id: string; url: string; alt: string; width: number | null; height: number | null; blur_data_url: string | null } | null, position = 0, isPrimary = false): Image | null {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    alt: row.alt,
    position,
    isPrimary,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    blurDataUrl: row.blur_data_url ?? undefined,
  };
}

/**
 * Base term mapping.
 *
 * `seo` is only attached when the row actually carries metadata, so a term with
 * no SEO fields does not render an empty object that overrides the page default.
 */
export function mapTerm(row: TermRow): TaxonomyTerm {
  const hasSeo = Boolean(row.seo_title || row.seo_description || row.seo_canonical_path || row.seo_no_index);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description ?? undefined,
    icon: (row.icon as TaxonomyTerm['icon']) ?? undefined,
    tone: (row.tone as TaxonomyTerm['tone']) ?? undefined,
    position: row.position,
    status: (row.status as TaxonomyTerm['status']) ?? 'active',
    visible: row.visible,
    seo: hasSeo
      ? {
          title: row.seo_title ?? row.name,
          description: row.seo_description ?? row.short_description,
          canonicalPath: row.seo_canonical_path ?? undefined,
          noIndex: row.seo_no_index || undefined,
        }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCategory(row: TermRow): Category {
  return {
    ...mapTerm(row),
    parentId: row.parent_id ?? null,
    productType: (row.product_type as Category['productType']) ?? 'serum',
  };
}

export function mapCollection(row: TermRow): Collection {
  return {
    ...mapTerm(row),
    rule: (row.rule as Collection['rule']) ?? 'auto',
    productIds: row.product_ids ?? [],
    featuredProductId: row.featured_product_id ?? undefined,
    story: row.story ?? undefined,
  };
}

export function mapIngredient(row: TermRow): Ingredient {
  return {
    ...mapTerm(row),
    aka: row.aka ?? [],
    concentration: row.concentration ?? undefined,
    benefits: row.benefits ?? [],
    origin: row.origin ?? undefined,
    heroProductId: row.hero_product_id ?? undefined,
  };
}

export function mapSkinConcern(row: TermRow): SkinConcern {
  return { ...mapTerm(row), promise: row.promise ?? '' };
}

export function mapVariant(
  row: {
    id: string;
    sku: string;
    name: string;
    size: string;
    price: number;
    compare_at_price: number | null;
    stock_quantity: number;
    position: number;
    is_default: boolean;
    image_id: string | null;
  },
  currency: string,
): ProductVariant {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    size: row.size,
    price: { amount: row.price, currency: currency as Product['currency'] },
    compareAtPrice:
      row.compare_at_price == null
        ? undefined
        : { amount: row.compare_at_price, currency: currency as Product['currency'] },
    stockQuantity: row.stock_quantity,
    position: row.position,
    isDefault: row.is_default,
    imageId: row.image_id ?? undefined,
  };
}

export function mapBadge(row: { id: string; label: string; tone: string; position: number }): ProductBadge {
  return {
    id: row.id,
    label: row.label,
    tone: row.tone as ProductBadge['tone'],
    position: row.position,
  };
}

/** The nested shape the catalog queries request for a product. */
export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  brand: string;
  short_description: string;
  description: string;
  highlights: string[] | null;
  benefits: string[] | null;
  usage: string[] | null;
  ingredients_text: string;
  warnings: string[] | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  category_id: string;
  product_type: string;
  size: string;
  stock_quantity: number;
  available_for_sale: boolean;
  low_stock_threshold: number;
  dispatch_estimate: string | null;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  related_product_ids: string[] | null;
  frequently_bought_with_ids: string[] | null;
  position: number;
  visible: boolean;
  created_at: string;
  updated_at: string;

  product_images?: {
    position: number;
    is_primary: boolean;
    images: { id: string; url: string; alt: string; width: number | null; height: number | null; blur_data_url: string | null } | null;
  }[] | null;

  product_variants?: {
    id: string;
    sku: string;
    name: string;
    size: string;
    price: number;
    compare_at_price: number | null;
    stock_quantity: number;
    position: number;
    is_default: boolean;
    image_id: string | null;
  }[] | null;

  product_badges?: {
    id: string;
    label: string;
    tone: string;
    position: number;
  }[] | null;

  product_key_ingredients?: {
    note: string;
    position: number;
    ingredient_id: string;
  }[] | null;

  product_collections?: { collection_id: string }[] | null;
  product_skin_types?: { skin_type_id: string }[] | null;
  product_skin_concerns?: { skin_concern_id: string }[] | null;
  product_ingredients?: { ingredient_id: string }[] | null;
  product_hero_ingredients?: { ingredient_id: string }[] | null;

  product_rating_summary?:
    | { average: number; count: number; distribution: number[] }
    | { average: number; count: number; distribution: number[] }[]
    | null;
}

/**
 * Rating summary, when one was supplied.
 *
 * `average` is `null` when there is no summary — a product nobody has reviewed
 * has no score, and zero would assert that reviewers rated it one star. The
 * shape mirrors the view's row, or `null` when the caller had none to merge.
 */
function ratingOf(row: ProductRow): Product['rating'] {
  const raw = row.product_rating_summary;
  const summary = Array.isArray(raw) ? raw[0] : raw;

  if (!summary) return { average: null, count: 0, distribution: [0, 0, 0, 0, 0] };

  const distribution = (summary.distribution ?? []).slice(0, 5);
  const padded: [number, number, number, number, number] = [
    distribution[0] ?? 0,
    distribution[1] ?? 0,
    distribution[2] ?? 0,
    distribution[3] ?? 0,
    distribution[4] ?? 0,
  ];

  // The view's own average is `null` when there are no qualifying reviews.
  const average =
    summary.average === null || summary.average === undefined ? null : Number(summary.average);

  return {
    average,
    count: Number(summary.count ?? 0),
    distribution: padded,
  };
}

export function mapProduct(row: ProductRow): Product {
  const images = (row.product_images ?? [])
    .map((link) => mapImage(link.images, link.position, link.is_primary))
    .filter((image): image is Image => image !== null)
    .sort((a, b) => a.position - b.position);

  // A product must always have a thumbnail for the card layout. Fall back to a
  // 1x1 transparent placeholder rather than rendering a broken image.
  const thumbnail = images.find((image) => image.isPrimary) ?? images[0] ?? PLACEHOLDER_IMAGE;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    brand: row.brand,
    shortDescription: row.short_description,
    description: row.description,
    highlights: row.highlights ?? [],

    price: { amount: row.price, currency: row.currency as Product['currency'] },
    compareAtPrice:
      row.compare_at_price == null
        ? undefined
        : { amount: row.compare_at_price, currency: row.currency as Product['currency'] },
    currency: row.currency as Product['currency'],

    images,
    thumbnail,

    categoryId: row.category_id,
    productType: row.product_type as Product['productType'],
    collectionIds: (row.product_collections ?? []).map((link) => link.collection_id),
    skinTypeIds: (row.product_skin_types ?? []).map((link) => link.skin_type_id),
    skinConcernIds: (row.product_skin_concerns ?? []).map((link) => link.skin_concern_id),
    ingredientIds: (row.product_ingredients ?? []).map((link) => link.ingredient_id),
    heroIngredientIds: (row.product_hero_ingredients ?? []).map((link) => link.ingredient_id),

    benefits: row.benefits ?? [],
    usage: row.usage ?? [],
    ingredients: row.ingredients_text,
    keyIngredients: (row.product_key_ingredients ?? [])
      .sort((a, b) => a.position - b.position)
      .map((link) => ({ ingredientId: link.ingredient_id, note: link.note })),
    warnings: row.warnings ?? undefined,

    size: row.size,
    variants: (row.product_variants ?? []).map((variant) => mapVariant(variant, row.currency)),

    stockQuantity: row.stock_quantity,
    availableForSale: row.available_for_sale,
    lowStockThreshold: row.low_stock_threshold,
    dispatchEstimate: row.dispatch_estimate ?? undefined,

    rating: ratingOf(row),
    badges: (row.product_badges ?? []).map(mapBadge),

    isFeatured: row.is_featured,
    isBestSeller: row.is_best_seller,
    isNewArrival: row.is_new_arrival,

    relatedProductIds: row.related_product_ids ?? [],
    frequentlyBoughtWithIds: row.frequently_bought_with_ids ?? [],

    position: row.position,
    status: 'active',
    visible: row.visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PLACEHOLDER_IMAGE: Image = {
  id: 'placeholder',
  url: '/placeholder.svg',
  alt: '',
  position: 0,
  isPrimary: true,
};
