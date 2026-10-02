import type { PostgrestFilterBuilder } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  Category,
  Collection,
  Ingredient,
  Product,
  ProductQuery,
  Result,
  Review,
  SkinConcern,
  SkinType,
} from '@/types';
import { SERVICE_ERRORS } from '../config';
import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { mapCategory, mapCollection, mapIngredient, mapProduct, mapSkinConcern, mapTerm, type ProductRow, type TermRow } from '@/lib/supabase/mappers';

/**
 * Supabase catalog repository.
 *
 * Implements the same interface as the mock repository, so `catalog-service.ts`
 * can hand back whichever one `DATA_SOURCE` selects without a single component
 * changing.
 *
 * Two deliberate differences from the mock:
 *
 *  - Filtering, sorting, pagination and facets are pushed into Postgres. Doing
 *    them in SQL is the entire point of moving off mock data; re-implementing
 *    `queryProducts` over a full table fetch would just be the mock again with
 *    extra latency.
 *  - `getInOrder` and the taxonomy getters resolve through a per-request
 *    request-scoped client, so a shopper's session is visible to RLS. The
 *    client is created once per call chain rather than cached at module scope,
 *    which would leak one shopper's session into another's render.
 */

function ok<T>(data: T): Result<T> {
  return { data };
}

function fail<T>(message: string): Result<T> {
  return { error: { code: 'not_found', message } };
}

/** The nested selects that build a full `Product`, shared by every query. */
const PRODUCT_SELECT = `
  *,
  product_images ( position, is_primary, images ( * ) ),
  product_variants ( * ),
  product_badges ( * ),
  product_key_ingredients ( * ),
  product_collections ( collection_id ),
  product_skin_types ( skin_type_id ),
  product_skin_concerns ( skin_concern_id ),
  product_ingredients ( ingredient_id ),
  product_hero_ingredients ( ingredient_id )
`;

/**
 * Attaches rating summaries fetched separately.
 *
 * `product_rating_summary` is a *view*, and PostgREST can only embed a related
 * table through a real foreign key — a view has none, so listing it here
 * returned `PGRST200` and failed every single product read. Views therefore
 * have to be queried on their own and merged by `product_id`.
 *
 * The view stays the source of truth for the honesty rule: it counts only
 * reviews that are both approved and published, and its `average` is `null`
 * when none qualify.
 */
async function withRatings<T extends { id: string }>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;

  const client = await createPublicSupabaseClient();
  if (!client) return rows;

  const { data, error } = await client
    .from('product_rating_summary')
    .select('product_id, average, count, distribution')
    .in(
      'product_id',
      rows.map((row) => row.id),
    );

  // A missing summary is not a missing rating: the mapper's own default is the
  // honest "no reviews" state, so there is nothing to do but carry on.
  if (error || !data) return rows;

  const byProduct = new Map(data.map((entry) => [entry.product_id, entry]));

  return rows.map((row) => ({
    ...row,
    product_rating_summary: byProduct.get(row.id) ?? null,
  }));
}

/**
 * The PostgREST query builder for the `products` table, as returned by
 * `.select(...).eq(...)`. Naming it once keeps the filter and sort helpers
 * readable; the `any` slots are how supabase-js itself types a builder whose
 * result shape is still being assembled by chained calls.
 */
type ProductBuilder = PostgrestFilterBuilder<any, any, any, any, any>;

/**
 * Applied in SQL rather than in JS. Kept in one function so the shop page, the
 * category pages and search cannot drift apart, exactly as `queryProducts` is
 * for the mock.
 */
function applyProductFilters(builder: ProductBuilder, query: ProductQuery): ProductBuilder {
  const apply = builder;

  if (query.categoryIds?.length) apply.in('category_id', query.categoryIds);
  if (query.productTypes?.length) apply.in('product_type', query.productTypes);
  if (query.brands?.length) apply.in('brand', query.brands);
  if (query.minPrice != null) apply.gte('price', query.minPrice);
  if (query.maxPrice != null) apply.lte('price', query.maxPrice);
  if (query.search) {
    const term = query.search.trim();
    if (term) {
      // One `or` group, so these are OR'd with each other while remaining AND'd
      // against the facets above.
      apply.or(
        [
          `name.ilike.%${term}%`,
          `subtitle.ilike.%${term}%`,
          `short_description.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `ingredients_text.ilike.%${term}%`,
        ].join(','),
      );
    }
  }
  if (query.inStockOnly) {
    apply.gt('stock_quantity', 0).eq('available_for_sale', true);
  }
  if (query.onSaleOnly) apply.not('compare_at_price', 'is', null);

  return apply;
}

function applySort(builder: ProductBuilder, sort: ProductQuery['sort']): ProductBuilder {
  switch (sort) {
    case 'newest':
      return builder.order('created_at', { ascending: false });
    case 'price-asc':
      return builder.order('price', { ascending: true });
    case 'price-desc':
      return builder.order('price', { ascending: false });
      /*
       * `rating` is served by the `product_rating_summary` view, which
       * PostgREST cannot join into an `order` clause. It falls back to the
       * curated merchandising position rather than to some other column:
       * ordering by price would silently answer "highest rated" with "most
       * expensive", which is worse than not honouring the sort at all.
       * Exposing the aggregate as a database function is the change that makes
       * this exact.
       */
      case 'rating':
      case 'position':
      default:
        return builder.order('position', { ascending: true });
  }
}

/**
 * Runs a PostgREST read, retrying once on a transport-level failure.
 *
 * `if (error) return []` reads as harmless and is not: these lists feed
 * `generateStaticParams`, so a single dropped connection during a build
 * silently produces a site with zero product pages and no error anywhere. One
 * retry absorbs the transient case; a genuine failure still surfaces.
 */
async function readWithRetry<T>(
  query: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= TAXONOMY_RETRIES; attempt += 1) {
    const { data, error } = await query();

    if (!error) return (data ?? []) as T[];

    lastError = error.message;
    if (attempt < TAXONOMY_RETRIES) await sleep(TAXONOMY_RETRY_DELAY_MS);
  }

  throw new Error(`${what}: ${lastError}`);
}

export const productService = {
  async list(query: ProductQuery = {}): Promise<Result<Product[]>> {
    const client = await createPublicSupabaseClient();
    if (!client) return fail(SERVICE_ERRORS.network);

    const { page = 1, perPage = 24 } = query;
    const from = (page - 1) * perPage;

    let builder = client.from('products').select(PRODUCT_SELECT).eq('visible', true);
    builder = applyProductFilters(builder, query);
    builder = applySort(builder, query.sort);

    const { data, error } = await builder.range(from, from + perPage - 1);
    if (error || !data) return fail(SERVICE_ERRORS.unknown);

    return ok((await withRatings(data as unknown as ProductRow[])).map(mapProduct));
  },

  async count(query: ProductQuery = {}): Promise<number> {
    const client = await createPublicSupabaseClient();
    if (!client) return 0;

    let builder = client.from('products').select('id', { count: 'exact' }).eq('visible', true);
    builder = applyProductFilters(builder, query);

    const { count, error } = await builder;
    if (error) return 0;
    return count ?? 0;
  },

  /**
   * Facets are computed from the scope before the shopper's own selections, so
   * a count never collapses the moment the shopper ticks its own box. This runs
   * the same scoped query and aggregates in JS, which is correct for a catalog
   * this size and keeps one implementation of the facet maths.
   */
  async facets(scope: ProductQuery = {}) {
    const client = await createPublicSupabaseClient();
    if (!client) {
      const { buildFacets } = await import('@/lib/utils/catalog');
      return buildFacets([], []);
    }

    let builder = client.from('products').select(PRODUCT_SELECT).eq('visible', true);
    builder = applyProductFilters(builder, { ...scope, sort: undefined });
    const { data, error } = await builder;
    if (error || !data) {
      const { buildFacets } = await import('@/lib/utils/catalog');
      return buildFacets([], []);
    }

    const mapped = (await withRatings(data as unknown as ProductRow[])).map(mapProduct);
    const { buildFacets } = await import('@/lib/utils/catalog');
    return buildFacets(mapped, mapped);
  },

  async getAll(): Promise<Product[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    // Feeds `generateStaticParams`, so a failure here has to be loud: the
    // alternative is a build that succeeds and ships a store with no products.
    const data = await readWithRetry<ProductRow>(
      () =>
        client
          .from('products')
          .select(PRODUCT_SELECT)
          .eq('visible', true)
          .order('position', { ascending: true }) as unknown as PromiseLike<{
          data: ProductRow | null;
          error: { message: string } | null;
        }>,
      'products.getAll',
    );

    return (await withRatings(data)).map(mapProduct);
  },

  async getBySlug(slug: string): Promise<Result<Product | null>> {
    const client = await createPublicSupabaseClient();
    if (!client) return fail(SERVICE_ERRORS.network);

    const { data, error } = await client
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('slug', slug)
      .eq('visible', true)
      .maybeSingle();

    if (error) return fail(SERVICE_ERRORS.unknown);
    if (!data) return fail(SERVICE_ERRORS.notFound);
    return ok(mapProduct((await withRatings([data as unknown as ProductRow]))[0]!));
  },

  async getById(id: string): Promise<Product | null> {
    const client = await createPublicSupabaseClient();
    if (!client) return null;

    // `visible` is asserted here as well as by RLS. Every sibling method on
    // this repository filters explicitly, and relying on the policy alone made
    // this one read differently the moment a caller used a privileged client —
    // a hidden product would have come back. RLS is the backstop, not the only
    // thing standing between a draft and a public page.
    const { data, error } = await client
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .eq('visible', true)
      .maybeSingle();
    if (error || !data) return null;
    return mapProduct((await withRatings([data as unknown as ProductRow]))[0]!);
  },

  async getManyByIds(ids: string[]): Promise<Product[]> {
    if (!ids.length) return [];
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('products')
      .select(PRODUCT_SELECT)
      .in('id', ids)
      .eq('visible', true);
    if (error || !data) return [];
    return (await withRatings(data as unknown as ProductRow[])).map(mapProduct);
  },

  /** Preserve the caller's ordering rather than the catalog's. */
  async getInOrder(ids: string[] = []): Promise<Product[]> {
    if (!ids.length) return [];
    const found = new Map((await this.getManyByIds(ids)).map((item) => [item.id, item]));
    return ids.map((id) => found.get(id)).filter((item): item is Product => Boolean(item));
  },

  async getByFlags(flag: 'isFeatured' | 'isBestSeller' | 'isNewArrival', limit?: number): Promise<Product[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    let builder = client.from('products').select(PRODUCT_SELECT).eq('visible', true).eq(flag, true);
    builder = builder.order('position', { ascending: true });
    if (limit) builder = builder.limit(limit);

    const { data, error } = await builder;
    if (error || !data) return [];
    return (await withRatings(data as unknown as ProductRow[])).map(mapProduct);
  },

  async getByCategory(categoryId: string): Promise<Product[]> {
    const result = await this.list({ categoryIds: [categoryId], perPage: 100 });
    return result.data ?? [];
  },

  async getByCollection(collectionId: string): Promise<Product[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('product_collections')
      .select('product_id')
      .eq('collection_id', collectionId);
    if (error || !data) return [];

    return this.getManyByIds(data.map((row) => row.product_id));
  },

  async getByIngredient(ingredientId: string): Promise<Product[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('product_ingredients')
      .select('product_id')
      .eq('ingredient_id', ingredientId);
    if (error || !data) return [];

    return this.getManyByIds(data.map((row) => row.product_id));
  },

  async getBySkinType(skinTypeId: string): Promise<Product[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('product_skin_types')
      .select('product_id')
      .eq('skin_type_id', skinTypeId);
    if (error || !data) return [];

    return this.getManyByIds(data.map((row) => row.product_id));
  },

  async getBySkinConcern(skinConcernId: string): Promise<Product[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('product_skin_concerns')
      .select('product_id')
      .eq('skin_concern_id', skinConcernId);
    if (error || !data) return [];

    return this.getManyByIds(data.map((row) => row.product_id));
  },

  async getRelated(product: Product, limit = 4): Promise<Product[]> {
    const curated = await this.getInOrder(product.relatedProductIds ?? []);
    if (curated.length >= limit) return curated.slice(0, limit);

    // Fall back to a recommendation-style fill by shared concern, then position.
    const seen = new Set(curated.map((item) => item.id));
    const filler = (await this.getBySkinConcern(product.skinConcernIds[0] ?? ''))
      .filter((item) => item.id !== product.id && !seen.has(item.id))
      .slice(0, limit - curated.length);
    return [...curated, ...filler];
  },

  async getFrequentlyBoughtWith(product: Product, limit = 3): Promise<Product[]> {
    return (await this.getInOrder(product.frequentlyBoughtWithIds ?? [])).slice(0, limit);
  },

  async search(term: string, limit?: number): Promise<Product[]> {
    const result = await this.list({ search: term, perPage: limit ?? 24, sort: 'position' });
    return result.data ?? [];
  },

  async getSuggestions(term: string) {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) {
      return { products: [], categories: [], concerns: [], ingredients: [] };
    }

    const productsFound = (await this.search(term, 8))
      .filter((product) => product.isBestSeller || product.isFeatured)
      .slice(0, 4);

    return {
      products: productsFound,
      categories: (await categoryService.getAll()).filter((item) => item.name.toLowerCase().includes(trimmed)).slice(0, 3),
      concerns: (await skinConcernService.getAll()).filter((item) => item.name.toLowerCase().includes(trimmed)).slice(0, 3),
      ingredients: (await ingredientService.getAll()).filter((item) => item.name.toLowerCase().includes(trimmed)).slice(0, 3),
    };
  },
};

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export const reviewService = {
  async listForProduct(productId: string): Promise<Review[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('reviews')
      .select('*, review_images ( position, images ( * ) )')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      productId: row.product_id,
      author: row.author,
      verified: row.verified,
      rating: row.rating,
      title: row.title,
      body: row.body,
      skinType: row.skin_type_id ?? undefined,
      helpfulCount: row.helpful_count,
      createdAt: row.created_at,
    }));
  },

  async listByProductIds(productIds: string[]): Promise<Review[]> {
    if (!productIds.length) return [];
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client.from('reviews').select('*').in('product_id', productIds);
    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      productId: row.product_id,
      author: row.author,
      verified: row.verified,
      rating: row.rating,
      title: row.title,
      body: row.body,
      skinType: row.skin_type_id ?? undefined,
      helpfulCount: row.helpful_count,
      createdAt: row.created_at,
    }));
  },

  async topForProduct(productId: string, limit = 3): Promise<Review[]> {
    return (await this.listForProduct(productId)).slice(0, limit);
  },

  /** The aggregate comes from `product_rating_summary`, so it is not recomputed. */
  summaryFor(product: Product): Product['rating'] {
    return product.rating;
  },
};

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

/**
 * How long one taxonomy read is reused within a server process.
 *
 * Short enough that an admin edit shows up on the next page load rather than
 * the next deploy, long enough to collapse a build — where eleven workers
 * each render every product page, and every product page resolves its
 * category — into a handful of requests instead of thousands.
 */
const TAXONOMY_TTL_MS = 30_000;

/** One retry, briefly delayed, before a read is considered failed. */
const TAXONOMY_RETRIES = 1;
const TAXONOMY_RETRY_DELAY_MS = 400;

const taxonomyCache = new Map<string, { at: number; rows: TermRow[] }>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * All terms of one kind, ordered for display.
 *
 * Every taxonomy service reads through here, including the `getBySlug` and
 * `getById` lookups — so a single product page would otherwise fetch the whole
 * category list once for the page and again for the breadcrumb.
 *
 * On failure the order of preference is: a stale cache, then a retry, then an
 * error. Returning `[]` on error — which this used to do — turns a dropped
 * connection into a store that silently claims to sell nothing, with an empty
 * navigation to match and nothing in the logs. Failing the build on a single
 * blip is the opposite mistake. A retry absorbs the transient case, and a
 * genuine outage still surfaces.
 */
async function termsOfKind(kind: string): Promise<TermRow[]> {
  const cached = taxonomyCache.get(kind);
  if (cached && Date.now() - cached.at < TAXONOMY_TTL_MS) return cached.rows;

  const client = await createPublicSupabaseClient();
  if (!client) return [];

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= TAXONOMY_RETRIES; attempt += 1) {
    const { data, error } = await client
      .from('taxonomy_terms')
      .select('*')
      .eq('kind', kind)
      .eq('visible', true)
      .order('position', { ascending: true });

    if (!error) {
      const rows = (data ?? []) as unknown as TermRow[];
      taxonomyCache.set(kind, { at: Date.now(), rows });
      return rows;
    }

    lastError = error.message;
    if (attempt < TAXONOMY_RETRIES) await sleep(TAXONOMY_RETRY_DELAY_MS);
  }

  // A stale list is a better answer than an empty one, and a far better answer
  // than an exception from a static render.
  if (cached) return cached.rows;
  throw new Error(`taxonomy_terms(${kind}): ${lastError}`);
}

export const categoryService = {
  async getAll(): Promise<Category[]> {
    return (await termsOfKind('category')).map(mapCategory);
  },
  async getBySlug(slug: string): Promise<Category | null> {
    const found = (await termsOfKind('category')).find((item) => item.slug === slug);
    return found ? (mapCategory(found)) : null;
  },
  async getById(id: string): Promise<Category | null> {
    const found = (await termsOfKind('category')).find((item) => item.id === id);
    return found ? (mapCategory(found)) : null;
  },
  async getManyByIds(ids: string[]): Promise<Category[]> {
    const wanted = new Set(ids);
    return (await termsOfKind('category')).filter((item) => wanted.has(item.id)).map(mapCategory);
  },
  async getWithProductCounts(): Promise<(Category & { productCount: number })[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data } = await client.from('products').select('category_id').eq('visible', true);
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
    return (await categoryService.getAll()).map((category) => ({
      ...category,
      productCount: counts.get(category.id) ?? 0,
    }));
  },
};

export const collectionService = {
  async getAll(): Promise<Collection[]> {
    return (await termsOfKind('collection')).map(mapCollection);
  },
  async getBySlug(slug: string): Promise<Collection | null> {
    const found = (await termsOfKind('collection')).find((item) => item.slug === slug);
    return found ? (mapCollection(found)) : null;
  },
  async getById(id: string): Promise<Collection | null> {
    const found = (await termsOfKind('collection')).find((item) => item.id === id);
    return found ? (mapCollection(found)) : null;
  },
  async getProducts(collection: Collection): Promise<Product[]> {
    return productService.getByCollection(collection.id);
  },
};

export const ingredientService = {
  async getAll(): Promise<Ingredient[]> {
    return (await termsOfKind('ingredient')).map(mapIngredient);
  },
  async getBySlug(slug: string): Promise<Ingredient | null> {
    const found = (await termsOfKind('ingredient')).find((item) => item.slug === slug);
    return found ? (mapIngredient(found)) : null;
  },
  async getById(id: string): Promise<Ingredient | null> {
    const found = (await termsOfKind('ingredient')).find((item) => item.id === id);
    return found ? (mapIngredient(found)) : null;
  },
  async getManyByIds(ids: string[]): Promise<Ingredient[]> {
    const wanted = new Set(ids);
    return (await termsOfKind('ingredient')).filter((item) => wanted.has(item.id)).map(mapIngredient);
  },
  async getHero(ingredient: Ingredient): Promise<Product | null> {
    if (!ingredient.heroProductId) return null;
    return productService.getById(ingredient.heroProductId);
  },
};

export const skinTypeService = {
  async getAll(): Promise<SkinType[]> {
    return (await termsOfKind('skin_type')).map(mapTerm) as SkinType[];
  },
  async getBySlug(slug: string): Promise<SkinType | null> {
    const found = (await termsOfKind('skin_type')).find((item) => item.slug === slug);
    return found ? (mapTerm(found) as SkinType) : null;
  },
  async getById(id: string): Promise<SkinType | null> {
    const found = (await termsOfKind('skin_type')).find((item) => item.id === id);
    return found ? (mapTerm(found) as SkinType) : null;
  },
};

export const skinConcernService = {
  async getAll(): Promise<SkinConcern[]> {
    return (await termsOfKind('skin_concern')).map(mapSkinConcern);
  },
  async getBySlug(slug: string): Promise<SkinConcern | null> {
    const found = (await termsOfKind('skin_concern')).find((item) => item.slug === slug);
    return found ? (mapSkinConcern(found)) : null;
  },
  async getById(id: string): Promise<SkinConcern | null> {
    const found = (await termsOfKind('skin_concern')).find((item) => item.id === id);
    return found ? (mapSkinConcern(found)) : null;
  },
  async getManyByIds(ids: string[]): Promise<SkinConcern[]> {
    const wanted = new Set(ids);
    return (await termsOfKind('skin_concern')).filter((item) => wanted.has(item.id)).map(mapSkinConcern);
  },
  async getWithCounts(): Promise<(SkinConcern & { productCount: number })[]> {
    const client = await createPublicSupabaseClient();
    if (!client) return [];

    const { data } = await client.from('product_skin_concerns').select('skin_concern_id');
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      counts.set(row.skin_concern_id, (counts.get(row.skin_concern_id) ?? 0) + 1);
    }
    return (await skinConcernService.getAll()).map((concern) => ({
      ...concern,
      productCount: counts.get(concern.id) ?? 0,
    }));
  },
};
