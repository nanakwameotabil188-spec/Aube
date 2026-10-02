import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DATA_SOURCE } from '../config';
import * as mock from './mock-catalog';
import type { TermPageData } from './mock-catalog';

/**
 * Repository selection.
 *
 * `DATA_SOURCE=supabase` swaps every catalog service in one place. The two
 * implementations are structurally identical, so this is the only file that
 * knows which one is live — and it falls back to the mock rather than throwing
 * when Supabase is selected but unconfigured, because a storefront that cannot
 * render because an env var is missing is worse than one showing mock content.
 *
 * The Supabase repository is loaded with a dynamic import on purpose. It pulls
 * in `next/headers` via the server client, and the mock is then the synchronous
 * default: services resolve without a microtask when no backend is configured,
 * and Postgres is only ever loaded in a server context. Client components reach
 * services only through the server actions in `@/lib/actions`.
 */

type CatalogRepo = typeof mock;

export const activeSource: 'mock' | 'supabase' =
  DATA_SOURCE === 'supabase' && isSupabaseConfigured() ? 'supabase' : 'mock';

let resolved: CatalogRepo | null = null;
let pending: Promise<CatalogRepo> | null = null;

async function repo(): Promise<CatalogRepo> {
  if (resolved) return resolved;
  if (!pending) {
    pending = (async () => {
      if (activeSource === 'supabase') {
        const mod = await import('./supabase-catalog');
        // The two modules are structurally identical by construction; the cast
        // documents that rather than restating seven service signatures.
        resolved = mod as unknown as CatalogRepo;
      } else {
        resolved = mock;
      }
      return resolved;
    })();
  }
  return pending;
}

/**
 * Content repository selection.
 *
 * Separate from the catalog seam because the content side is not an either/or
 * implementation: both sources are always valid, and the database is an override
 * on top of the in-repo content rather than a replacement for it. A `null` read
 * means "nothing stored", and the caller falls back — so a half-migrated site
 * renders instead of erroring.
 *
 * The catalog had to be one source or the other, so it is a single repository.
 * Content is layered, so it is an optional overlay. Under the mock source the
 * overlay does not exist at all and the in-repo content stands on its own.
 */
type ContentRepo = typeof import('./supabase-content');

let contentRepo: ContentRepo | null | undefined;
let contentPending: Promise<ContentRepo | null> | null = null;

async function content(): Promise<ContentRepo | null> {
  if (contentRepo !== undefined) return contentRepo;
  if (!contentPending) {
    contentPending = (async () => {
      if (activeSource === 'supabase') {
        // Dynamic for the same reason as the catalog: it pulls in the
        // `server-only` public client.
        contentRepo = await import('./supabase-content');
      } else {
        contentRepo = null;
      }
      return contentRepo;
    })();
  }
  return contentPending;
}

/*
 * Forwarding is written out rather than proxied for two reasons: it keeps every
 * method's types exact, and calling `service.method(...)` — rather than a
 * destructured reference — preserves `this`, which several catalog methods rely
 * on when they call their own siblings.
 */

export const productService = {
  list: (...a: Parameters<typeof mock.productService.list>) => repo().then((r) => r.productService.list(...a)),
  count: (...a: Parameters<typeof mock.productService.count>) => repo().then((r) => r.productService.count(...a)),
  facets: (...a: Parameters<typeof mock.productService.facets>) => repo().then((r) => r.productService.facets(...a)),
  getAll: () => repo().then((r) => r.productService.getAll()),
  getBySlug: (...a: Parameters<typeof mock.productService.getBySlug>) => repo().then((r) => r.productService.getBySlug(...a)),
  getById: (...a: Parameters<typeof mock.productService.getById>) => repo().then((r) => r.productService.getById(...a)),
  getManyByIds: (...a: Parameters<typeof mock.productService.getManyByIds>) => repo().then((r) => r.productService.getManyByIds(...a)),
  getInOrder: (...a: Parameters<typeof mock.productService.getInOrder>) => repo().then((r) => r.productService.getInOrder(...a)),
  getByFlags: (...a: Parameters<typeof mock.productService.getByFlags>) => repo().then((r) => r.productService.getByFlags(...a)),
  getByCategory: (...a: Parameters<typeof mock.productService.getByCategory>) => repo().then((r) => r.productService.getByCategory(...a)),
  getByCollection: (...a: Parameters<typeof mock.productService.getByCollection>) => repo().then((r) => r.productService.getByCollection(...a)),
  getByIngredient: (...a: Parameters<typeof mock.productService.getByIngredient>) => repo().then((r) => r.productService.getByIngredient(...a)),
  getBySkinType: (...a: Parameters<typeof mock.productService.getBySkinType>) => repo().then((r) => r.productService.getBySkinType(...a)),
  getBySkinConcern: (...a: Parameters<typeof mock.productService.getBySkinConcern>) => repo().then((r) => r.productService.getBySkinConcern(...a)),
  getRelated: (...a: Parameters<typeof mock.productService.getRelated>) => repo().then((r) => r.productService.getRelated(...a)),
  getFrequentlyBoughtWith: (...a: Parameters<typeof mock.productService.getFrequentlyBoughtWith>) => repo().then((r) => r.productService.getFrequentlyBoughtWith(...a)),
  search: (...a: Parameters<typeof mock.productService.search>) => repo().then((r) => r.productService.search(...a)),
  getSuggestions: (...a: Parameters<typeof mock.productService.getSuggestions>) => repo().then((r) => r.productService.getSuggestions(...a)),
};

export const reviewService = {
  listForProduct: (...a: Parameters<typeof mock.reviewService.listForProduct>) => repo().then((r) => r.reviewService.listForProduct(...a)),
  listByProductIds: (...a: Parameters<typeof mock.reviewService.listByProductIds>) => repo().then((r) => r.reviewService.listByProductIds(...a)),
  topForProduct: (...a: Parameters<typeof mock.reviewService.topForProduct>) => repo().then((r) => r.reviewService.topForProduct(...a)),

  /**
   * Synchronous by contract, so it cannot await a repository. It only reads
   * `product.rating`, which the Supabase mapper already fills from
   * `product_rating_summary` — so returning it unchanged is correct for both.
   */
  summaryFor: (product: Parameters<typeof mock.reviewService.summaryFor>[0]) => product.rating,
};

export const categoryService = {
  getAll: () => repo().then((r) => r.categoryService.getAll()),
  getBySlug: (...a: Parameters<typeof mock.categoryService.getBySlug>) => repo().then((r) => r.categoryService.getBySlug(...a)),
  getById: (...a: Parameters<typeof mock.categoryService.getById>) => repo().then((r) => r.categoryService.getById(...a)),
  getManyByIds: (...a: Parameters<typeof mock.categoryService.getManyByIds>) => repo().then((r) => r.categoryService.getManyByIds(...a)),
  getWithProductCounts: () => repo().then((r) => r.categoryService.getWithProductCounts()),
};

export const collectionService = {
  getAll: () => repo().then((r) => r.collectionService.getAll()),
  getBySlug: (...a: Parameters<typeof mock.collectionService.getBySlug>) => repo().then((r) => r.collectionService.getBySlug(...a)),
  getById: (...a: Parameters<typeof mock.collectionService.getById>) => repo().then((r) => r.collectionService.getById(...a)),
  getProducts: (...a: Parameters<typeof mock.collectionService.getProducts>) => repo().then((r) => r.collectionService.getProducts(...a)),
};

export const ingredientService = {
  getAll: () => repo().then((r) => r.ingredientService.getAll()),
  getBySlug: (...a: Parameters<typeof mock.ingredientService.getBySlug>) => repo().then((r) => r.ingredientService.getBySlug(...a)),
  getById: (...a: Parameters<typeof mock.ingredientService.getById>) => repo().then((r) => r.ingredientService.getById(...a)),
  getManyByIds: (...a: Parameters<typeof mock.ingredientService.getManyByIds>) => repo().then((r) => r.ingredientService.getManyByIds(...a)),
  getHero: (...a: Parameters<typeof mock.ingredientService.getHero>) => repo().then((r) => r.ingredientService.getHero(...a)),
};

export const skinTypeService = {
  getAll: () => repo().then((r) => r.skinTypeService.getAll()),
  getBySlug: (...a: Parameters<typeof mock.skinTypeService.getBySlug>) => repo().then((r) => r.skinTypeService.getBySlug(...a)),
  getById: (...a: Parameters<typeof mock.skinTypeService.getById>) => repo().then((r) => r.skinTypeService.getById(...a)),
};

export const skinConcernService = {
  getAll: () => repo().then((r) => r.skinConcernService.getAll()),
  getBySlug: (...a: Parameters<typeof mock.skinConcernService.getBySlug>) => repo().then((r) => r.skinConcernService.getBySlug(...a)),
  getById: (...a: Parameters<typeof mock.skinConcernService.getById>) => repo().then((r) => r.skinConcernService.getById(...a)),
  getManyByIds: (...a: Parameters<typeof mock.skinConcernService.getManyByIds>) => repo().then((r) => r.skinConcernService.getManyByIds(...a)),
  getWithCounts: () => repo().then((r) => r.skinConcernService.getWithCounts()),
};

/**
 * The content overlay, or `null` when none is available.
 *
 * Exposed as a single object rather than a dozen exported wrappers so callers
 * reach for it in one obvious way, and so the "no overlay" case is a single null
 * check rather than a guard on every method.
 */
export async function contentOverlay(): Promise<ContentRepo | null> {
  return content();
}

export type { TermPageData };

/**
 * Shared loader for category / collection / concern / skin-type / ingredient.
 *
 * Lives here rather than in a repository because it composes whichever
 * repository is active — duplicating it would let the two drift.
 */
export async function loadTermPage(
  kind: 'category' | 'collection' | 'concern' | 'skin-type' | 'ingredient',
  slug: string,
): Promise<TermPageData | null> {
  switch (kind) {
    case 'category': {
      const term = await categoryService.getBySlug(slug);
      if (!term) return null;
      return { term, products: await productService.getByCategory(term.id), total: 1 };
    }
    case 'collection': {
      const term = await collectionService.getBySlug(slug);
      if (!term) return null;
      return { term, products: await collectionService.getProducts(term), total: 1 };
    }
    case 'concern': {
      const term = await skinConcernService.getBySlug(slug);
      if (!term) return null;
      return { term, products: await productService.getBySkinConcern(term.id), total: 1 };
    }
    case 'skin-type': {
      const term = await skinTypeService.getBySlug(slug);
      if (!term) return null;
      return { term, products: await productService.getBySkinType(term.id), total: 1 };
    }
    case 'ingredient': {
      const term = await ingredientService.getBySlug(slug);
      if (!term) return null;
      return { term, products: await productService.getByIngredient(term.id), total: 1 };
    }
    default:
      return null;
  }
}
