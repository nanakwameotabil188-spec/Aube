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
import { products } from '@/data/products';
import { reviews } from '@/data/reviews';
import { categories, collections, ingredients, skinConcerns, skinTypes } from '@/data/taxonomy';
import { byPositionField, visibleAndOrdered } from '@/lib/utils/ordering';
import { buildFacets, isInStock, queryProducts, type ProductFacets } from '@/lib/utils/catalog';
import { SERVICE_ERRORS } from '../config';

/**
 * Catalog service.
 *
 * The only module that reads catalog content. Every function is async and
 * returns `Result<T>`, so a future `api` implementation has exactly the same
 * shape — including failures — as this one. Components call the service, not
 * the data, and never import from `@/data` directly.
 */

function ok<T>(data: T): Result<T> {
  return { data };
}

function fail<T>(message: string): Result<T> {
  return { error: { code: 'not_found', message } };
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */
/**
 * Mock catalog repository.
 *
 * The in-repo implementation behind the same interface as the Supabase
 * repository. Selected by DATA_SOURCE=mock, which is the default, so a clone
 * with no credentials renders the full storefront.
 *
 * Moved here verbatim from catalog-service.ts when the Supabase path was
 * added; the service objects and their behaviour are unchanged.
 */

export const productService = {
  /** Paginated listing with the shared filter/sort implementation. */
  async list(query: ProductQuery = {}): Promise<Result<Product[]>> {
    const { page = 1, perPage = 24, ...rest } = query;
    const filtered = queryProducts(products, rest);
    const start = (page - 1) * perPage;
    return ok(filtered.slice(start, start + perPage));
  },

  /** Total count for the same query — used for pagination. */
  async count(query: ProductQuery = {}): Promise<number> {
    return queryProducts(products, query).length;
  },

  /** Facets computed over the scope before the shopper's own selections. */
  async facets(scope: ProductQuery = {}): Promise<ProductFacets> {
    const scopeProducts = queryProducts(products, scope);
    return buildFacets(products, scopeProducts);
  },

  async getAll(): Promise<Product[]> {
    return visibleAndOrdered(products);
  },

  async getBySlug(slug: string): Promise<Result<Product | null>> {
    const product = products.find((item) => item.slug === slug && item.visible);
    return product ? ok(product) : fail(SERVICE_ERRORS.notFound);
  },

  async getById(id: string): Promise<Product | null> {
    return products.find((item) => item.id === id) ?? null;
  },

  async getManyByIds(ids: string[]): Promise<Product[]> {
    const wanted = new Set(ids);
    return products.filter((item) => wanted.has(item.id));
  },

  /** Preserve the caller's ordering rather than the catalog's. */
  /**
   * Resolves ids to products, preserving the given order and dropping any that
   * no longer exist. The list argument is optional because merchandising links
   * are genuinely absent on some records — an empty recommendation rail is a
   * normal state, not an error.
   */
  async getInOrder(ids: string[] = []): Promise<Product[]> {
    const found = new Map(products.map((item) => [item.id, item]));
    return ids.map((id) => found.get(id)).filter((item): item is Product => Boolean(item));
  },

  async getByFlags(flag: 'isFeatured' | 'isBestSeller' | 'isNewArrival', limit?: number): Promise<Product[]> {
    const result = visibleAndOrdered(products)
      .filter((item) => item[flag])
      .slice(0, limit);
    return result;
  },

  async getByCategory(categoryId: string): Promise<Product[]> {
    return visibleAndOrdered(products.filter((item) => item.categoryId === categoryId));
  },

  async getByCollection(collectionId: string): Promise<Product[]> {
    return visibleAndOrdered(products.filter((item) => item.collectionIds.includes(collectionId)));
  },

  async getByIngredient(ingredientId: string): Promise<Product[]> {
    return visibleAndOrdered(products.filter((item) => item.ingredientIds.includes(ingredientId)));
  },

  async getBySkinType(skinTypeId: string): Promise<Product[]> {
    return visibleAndOrdered(products.filter((item) => item.skinTypeIds.includes(skinTypeId)));
  },

  async getBySkinConcern(skinConcernId: string): Promise<Product[]> {
    return visibleAndOrdered(products.filter((item) => item.skinConcernIds.includes(skinConcernId)));
  },

  async getRelated(product: Product, limit = 4): Promise<Product[]> {
    const curated = await this.getInOrder(product.relatedProductIds ?? []);
    if (curated.length >= limit) return curated.slice(0, limit);

    // Fall back to a recommendation-style fill by shared concern, then position.
    const seen = new Set(curated.map((item) => item.id));
    const filler = visibleAndOrdered(products)
      .filter(
        (item) =>
          item.id !== product.id &&
          !seen.has(item.id) &&
          item.skinConcernIds.some((concern) => product.skinConcernIds.includes(concern)),
      )
      .slice(0, limit - curated.length);
    return [...curated, ...filler];
  },

  async getFrequentlyBoughtWith(product: Product, limit = 3): Promise<Product[]> {
    return (await this.getInOrder(product.frequentlyBoughtWithIds ?? [])).slice(0, limit);
  },

  async search(term: string, limit?: number): Promise<Product[]> {
    const results = queryProducts(products, { search: term });
    return limit ? results.slice(0, limit) : results;
  },

  async getSuggestions(term: string): Promise<{ products: Product[]; categories: Category[]; concerns: SkinConcern[]; ingredients: Ingredient[] }> {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) {
      return { products: [], categories: [], concerns: [], ingredients: [] };
    }
    const matches = (value: string) => value.toLowerCase().includes(trimmed);

    return {
      products: (await this.search(term, 4)).filter((product) => product.isBestSeller || product.isFeatured).slice(0, 4),
      categories: byPositionField(categories).filter((category) => matches(category.name)).slice(0, 3),
      concerns: byPositionField(skinConcerns).filter((concern) => matches(concern.name)).slice(0, 3),
      ingredients: byPositionField(ingredients).filter((ingredient) => matches(ingredient.name)).slice(0, 3),
    };
  },
};

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export const reviewService = {
  async listForProduct(productId: string): Promise<Review[]> {
    return reviews
      .filter((review) => review.productId === productId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  async listByProductIds(productIds: string[]): Promise<Review[]> {
    const wanted = new Set(productIds);
    return reviews.filter((review) => wanted.has(review.productId));
  },

  /** Highlighted reviews, capped for the product page. */
  async topForProduct(productId: string, limit = 3): Promise<Review[]> {
    const list = await this.listForProduct(productId);
    return list.slice(0, limit);
  },

  /**
   * Derive the rating summary purely from written reviews.
   *
   * Average = total rating points / number of reviews, per the business rule.
   * The previous version blended the written average with the catalogue's
   * stored aggregate and then returned the *unblended* count and distribution,
   * so the score, the count, and the histogram all came from different
   * denominators. It is now internally consistent, and a product with no
   * reviews gets `average: null` rather than an inherited number.
   */
  summaryFor(product: Product): Product['rating'] {
    const list = reviews.filter((review) => review.productId === product.id);
    if (list.length === 0) {
      return { average: null, count: 0, distribution: [0, 0, 0, 0, 0] };
    }

    const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const review of list) {
      const index = Math.min(4, Math.max(0, Math.round(review.rating) - 1));
      distribution[index] = (distribution[index] ?? 0) + 1;
    }

    const totalPoints = list.reduce((total, review) => total + review.rating, 0);
    return {
      average: Number((totalPoints / list.length).toFixed(1)),
      count: list.length,
      distribution,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

export const categoryService = {
  async getAll(): Promise<Category[]> {
    return visibleAndOrdered(categories);
  },
  async getBySlug(slug: string): Promise<Category | null> {
    return categories.find((item) => item.slug === slug && item.visible) ?? null;
  },
  async getById(id: string): Promise<Category | null> {
    return categories.find((item) => item.id === id) ?? null;
  },
  async getManyByIds(ids: string[]): Promise<Category[]> {
    const wanted = new Set(ids);
    return visibleAndOrdered(categories).filter((item) => wanted.has(item.id));
  },
  async getWithProductCounts(): Promise<(Category & { productCount: number })[]> {
    return visibleAndOrdered(categories).map((category) => ({
      ...category,
      productCount: products.filter((product) => product.categoryId === category.id).length,
    }));
  },
};

export const collectionService = {
  async getAll(): Promise<Collection[]> {
    return visibleAndOrdered(collections);
  },
  async getBySlug(slug: string): Promise<Collection | null> {
    return collections.find((item) => item.slug === slug && item.visible) ?? null;
  },
  async getById(id: string): Promise<Collection | null> {
    return collections.find((item) => item.id === id) ?? null;
  },
  async getProducts(collection: Collection): Promise<Product[]> {
    if (collection.rule === 'manual' && collection.productIds) {
      return productService.getInOrder(collection.productIds);
    }
    return productService.getByCollection(collection.id);
  },
};

export const ingredientService = {
  async getAll(): Promise<Ingredient[]> {
    return visibleAndOrdered(ingredients);
  },
  async getBySlug(slug: string): Promise<Ingredient | null> {
    return ingredients.find((item) => item.slug === slug && item.visible) ?? null;
  },
  async getById(id: string): Promise<Ingredient | null> {
    return ingredients.find((item) => item.id === id) ?? null;
  },
  async getManyByIds(ids: string[]): Promise<Ingredient[]> {
    const wanted = new Set(ids);
    return visibleAndOrdered(ingredients).filter((item) => wanted.has(item.id));
  },
  async getHero(ingredient: Ingredient): Promise<Product | null> {
    if (!ingredient.heroProductId) return null;
    return productService.getById(ingredient.heroProductId);
  },
};

export const skinTypeService = {
  async getAll(): Promise<SkinType[]> {
    return visibleAndOrdered(skinTypes);
  },
  async getBySlug(slug: string): Promise<SkinType | null> {
    return skinTypes.find((item) => item.slug === slug && item.visible) ?? null;
  },
  async getById(id: string): Promise<SkinType | null> {
    return skinTypes.find((item) => item.id === id) ?? null;
  },
};

export const skinConcernService = {
  async getAll(): Promise<SkinConcern[]> {
    return visibleAndOrdered(skinConcerns);
  },
  async getBySlug(slug: string): Promise<SkinConcern | null> {
    return skinConcerns.find((item) => item.slug === slug && item.visible) ?? null;
  },
  async getById(id: string): Promise<SkinConcern | null> {
    return skinConcerns.find((item) => item.id === id) ?? null;
  },
  async getManyByIds(ids: string[]): Promise<SkinConcern[]> {
    const wanted = new Set(ids);
    return visibleAndOrdered(skinConcerns).filter((item) => wanted.has(item.id));
  },
  /** Concern tiles with live product counts for the homepage and search. */
  async getWithCounts(): Promise<(SkinConcern & { productCount: number })[]> {
    return visibleAndOrdered(skinConcerns).map((concern) => ({
      ...concern,
      productCount: products.filter(
        (product) => product.skinConcernIds.includes(concern.id) && isInStock(product),
      ).length,
    }));
  },
};

/* ------------------------------------------------------------------ */
/* Reusable helper for a "term + product list" page                    */
/* ------------------------------------------------------------------ */

export interface TermPageData {
  term: { name: string; shortDescription: string; description?: string; image?: Product['thumbnail']; promise?: string };
  products: Product[];
  total: number;
}

/** Shared loader for category / collection / concern / skin-type / ingredient. */
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

/** Journal and FAQ accessors live in the content service. */
