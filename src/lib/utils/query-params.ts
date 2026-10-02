import type { ProductQuery, ProductSortKey, ProductType } from '@/types';

/**
 * `ProductQuery` ↔ URL search params.
 *
 * Filters live in the URL rather than component state so a filtered view can
 * be linked, bookmarked and reached with the back button. These two functions
 * are the only place that mapping is written, which keeps `/shop`, the
 * category pages and search from drifting apart.
 *
 * Multiple values in one facet are comma-separated: shorter URLs, and still
 * readable by hand.
 *
 * Units: `ProductQuery.minPrice`/`maxPrice` are in minor units (cents), matching
 * `Money.amount`, but a URL should read like the shop does — `$38`, not `3800`.
 * Dollars are therefore converted at this boundary and nowhere else.
 */

const LIST_KEYS = ['categoryIds', 'collectionIds', 'skinTypeIds', 'skinConcernIds', 'ingredientIds', 'brands'] as const;
const PRODUCT_TYPE_KEYS = ['productTypes'] as const;

const SORT_KEYS: ProductSortKey[] = ['position', 'newest', 'price-asc', 'price-desc', 'rating'];

function readList(params: URLSearchParams, key: string): string[] | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
}

function readNumber(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function readBoolean(params: URLSearchParams, key: string): boolean | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  return raw === '1' || raw === 'true' ? true : undefined;
}

export function parseProductQuery(params: URLSearchParams): ProductQuery {
  const query: ProductQuery = {};

  for (const key of LIST_KEYS) {
    const values = readList(params, key);
    if (values) query[key] = values;
  }

  const productTypes = readList(params, 'productTypes');
  if (productTypes) query.productTypes = productTypes as ProductType[];

  const search = params.get('q')?.trim();
  if (search) query.search = search;

  // URL says dollars, query holds minor units.
  const minPrice = readNumber(params, 'min');
  if (minPrice !== undefined) query.minPrice = Math.round(minPrice * 100);
  const maxPrice = readNumber(params, 'max');
  if (maxPrice !== undefined) query.maxPrice = Math.round(maxPrice * 100);

  const minRating = readNumber(params, 'rating');
  if (minRating !== undefined) query.minRating = minRating;

  if (readBoolean(params, 'stock')) query.inStockOnly = true;
  if (readBoolean(params, 'sale')) query.onSaleOnly = true;

  const sort = params.get('sort');
  if (sort && SORT_KEYS.includes(sort as ProductSortKey)) query.sort = sort as ProductSortKey;

  const page = readNumber(params, 'page');
  if (page !== undefined && page > 1) query.page = Math.floor(page);

  return query;
}

/** Serialises only the keys that are set, so URLs stay short and stable. */
export function serializeProductQuery(query: ProductQuery, base?: string): string {
  const params = new URLSearchParams();

  for (const key of [...LIST_KEYS, ...PRODUCT_TYPE_KEYS]) {
    const values = query[key as keyof ProductQuery] as string[] | undefined;
    if (values?.length) params.set(key, values.join(','));
  }

  if (query.search) params.set('q', query.search);
  if (query.minPrice !== undefined) params.set('min', String(query.minPrice / 100));
  if (query.maxPrice !== undefined) params.set('max', String(query.maxPrice / 100));
  if (query.minRating !== undefined) params.set('rating', String(query.minRating));
  if (query.inStockOnly) params.set('stock', '1');
  if (query.onSaleOnly) params.set('sale', '1');
  if (query.sort && query.sort !== 'position') params.set('sort', query.sort);
  if (query.page && query.page > 1) params.set('page', String(query.page));

  const search = params.toString();
  return search ? `${base ?? ''}?${search}` : (base ?? '');
}
