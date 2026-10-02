import type { Money, Product, ProductQuery, ProductSortKey } from '@/types';

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

function matchesAny(value: string[] | undefined, selected: string[] | undefined): boolean {
  if (!selected?.length) return true;
  if (!value?.length) return false;
  return selected.some((id) => value.includes(id));
}

function overlaps(a: number, b: number, from?: number, to?: number): boolean {
  if (from != null && b < from) return false;
  if (to != null && a > to) return false;
  return true;
}

/**
 * The single filtering implementation used by shop, category, collection,
 * search, concern, skin-type and ingredient pages. One behaviour, one place
 * to change, and a direct seam for a server-side `GET /products` call.
 */
export function filterProducts(products: readonly Product[], query: ProductQuery): Product[] {
  const term = query.search?.trim().toLowerCase() ?? '';

  return products.filter((product) => {
    if (!product.availableForSale && !query.inStockOnly) {
      // Sold-out products stay listed but are handled by the UI state layer.
    }
    if (query.inStockOnly && !isInStock(product)) return false;
    if (query.onSaleOnly && !product.compareAtPrice) return false;
    // An unrated product has no `average`, so it cannot satisfy a minimum-rating
    // filter. Excluding it is honest; treating it as zero would be a claim.
    if (query.minRating != null && (product.rating.average ?? -1) < query.minRating) return false;
    if (!overlaps(product.price.amount, product.compareAtPrice?.amount ?? product.price.amount, query.minPrice, query.maxPrice)) {
      return false;
    }
    if (query.categoryIds?.length && !query.categoryIds.includes(product.categoryId)) return false;
    if (!matchesAny(product.collectionIds, query.collectionIds)) return false;
    if (!matchesAny(product.skinTypeIds, query.skinTypeIds)) return false;
    if (!matchesAny(product.skinConcernIds, query.skinConcernIds)) return false;
    if (!matchesAny(product.ingredientIds, query.ingredientIds)) return false;
    if (query.productTypes?.length && !query.productTypes.includes(product.productType)) return false;
    if (query.brands?.length && !query.brands.includes(product.brand)) return false;

    if (query.flags?.featured && !product.isFeatured) return false;
    if (query.flags?.bestSeller && !product.isBestSeller) return false;
    if (query.flags?.newArrival && !product.isNewArrival) return false;

    if (term && !matchesTerm(product, term, query)) return false;

    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

export const SORT_OPTIONS: { value: ProductSortKey; label: string }[] = [
  { value: 'position', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

export function sortProducts(products: readonly Product[], key: ProductSortKey = 'position'): Product[] {
  const sorted = products.slice();

  switch (key) {
    case 'newest':
      return sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    case 'price-asc':
      return sorted.sort((a, b) => a.price.amount - b.price.amount);
    case 'price-desc':
      return sorted.sort((a, b) => b.price.amount - a.price.amount);
    case 'rating':
      // Unrated products sort last rather than being treated as zero-star.
      return sorted.sort(
        (a, b) =>
          (b.rating.average ?? -1) - (a.rating.average ?? -1) || b.rating.count - a.rating.count,
      );
    case 'position':
    default:
      return sorted.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }
}

export function queryProducts(products: readonly Product[], query: ProductQuery): Product[] {
  return sortProducts(filterProducts(products, query), query.sort);
}

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

export function isInStock(product: Product): boolean {
  return product.availableForSale && product.stockQuantity > 0;
}

export type StockLevel = 'in-stock' | 'low' | 'out-of-stock' | 'pre-order' | 'unavailable';

export function stockLevel(product: Product): StockLevel {
  if (!product.availableForSale) return 'unavailable';
  if (product.stockQuantity <= 0) return 'out-of-stock';
  if (product.stockQuantity <= product.lowStockThreshold) return 'low';
  return 'in-stock';
}

/* ------------------------------------------------------------------ */
/* Search (client-side placeholder for the future search API)          */
/* ------------------------------------------------------------------ */

/**
 * Relevance-scored term match across the fields a real search index would
 * cover: name, subtitle, brand, product type, highlights, ingredients and
 * the names of linked taxonomy terms.
 */
function matchesTerm(
  product: Product,
  term: string,
  query: ProductQuery,
): boolean {
  const haystacks: { text: string; weight: number }[] = [
    { text: product.name, weight: 10 },
    { text: product.subtitle, weight: 6 },
    { text: product.brand, weight: 4 },
    { text: product.highlights.join(' '), weight: 4 },
    { text: product.ingredients, weight: 2 },
    { text: product.benefits.join(' '), weight: 2 },
    { text: product.productType, weight: 3 },
  ];

  return haystacks.some(({ text }) => text.toLowerCase().includes(term));
}

/** Public helper: does a product match a free-text search on its own terms? */
export function productMatchesSearch(product: Product, term: string): boolean {
  return matchesTerm(product, term.trim().toLowerCase(), {});
}

/* ------------------------------------------------------------------ */
/* Facet building — powers the filter panel counts                     */
/* ------------------------------------------------------------------ */

export interface FacetBucket {
  id: string;
  label: string;
  count: number;
  image?: Product['thumbnail'];
}

export interface ProductFacets {
  categoryIds: FacetBucket[];
  skinTypeIds: FacetBucket[];
  skinConcernIds: FacetBucket[];
  ingredientIds: FacetBucket[];
  productTypes: FacetBucket[];
  brands: FacetBucket[];
  priceRange: { min: number; max: number };
  inStockCount: number;
  onSaleCount: number;
  /** Products with at least one approved review. Gates the rating filter. */
  ratedCount: number;
}

function bucket(map: Map<string, FacetBucket>, id: string, label: string, image?: Product['thumbnail']) {
  const existing = map.get(id);
  if (existing) {
    existing.count += 1;
  } else {
    map.set(id, { id, label, count: 1, image });
  }
}

/**
 * Facets are computed from the *unfiltered* set for the current scope so
 * counts stay stable while the shopper narrows down, matching how most
 * premium storefronts behave.
 */
export function buildFacets(products: readonly Product[], scope: readonly Product[]): ProductFacets {
  const categoryIds = new Map<string, FacetBucket>();
  const skinTypeIds = new Map<string, FacetBucket>();
  const skinConcernIds = new Map<string, FacetBucket>();
  const ingredientIds = new Map<string, FacetBucket>();
  const productTypes = new Map<string, FacetBucket>();
  const brands = new Map<string, FacetBucket>();

  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  let inStockCount = 0;
  let onSaleCount = 0;
  let ratedCount = 0;

  for (const product of scope) {
    bucket(categoryIds, product.categoryId, product.productType);
    bucket(productTypes, product.productType, product.productType);
    bucket(brands, product.brand, product.brand);
    for (const id of product.skinTypeIds) bucket(skinTypeIds, id, id);
    for (const id of product.skinConcernIds) bucket(skinConcernIds, id, id);
    for (const id of product.ingredientIds) bucket(ingredientIds, id, id, product.thumbnail);

    min = Math.min(min, product.price.amount);
    max = Math.max(max, product.price.amount);
    if (isInStock(product)) inStockCount += 1;
    if (product.compareAtPrice) onSaleCount += 1;
    // Only products with real approved reviews can satisfy a rating filter.
    if (product.rating.count > 0 && product.rating.average != null) ratedCount += 1;
  }

  return {
    categoryIds: [...categoryIds.values()].sort((a, b) => b.count - a.count),
    skinTypeIds: [...skinTypeIds.values()].sort((a, b) => b.count - a.count),
    skinConcernIds: [...skinConcernIds.values()].sort((a, b) => b.count - a.count),
    ingredientIds: [...ingredientIds.values()].sort((a, b) => b.count - a.count),
    productTypes: [...productTypes.values()].sort((a, b) => b.count - a.count),
    brands: [...brands.values()].sort((a, b) => b.count - a.count),
    priceRange: { min: Number.isFinite(min) ? min : 0, max },
    inStockCount,
    onSaleCount,
    ratedCount,
  };
}

/* ------------------------------------------------------------------ */
/* Totals                                                              */
/* ------------------------------------------------------------------ */

export function sumMoney(values: readonly Money[]): Money {
  return values.reduce<Money>(
    (total, value) => ({ amount: total.amount + value.amount, currency: value.currency }),
    { amount: 0, currency: 'USD' },
  );
}
