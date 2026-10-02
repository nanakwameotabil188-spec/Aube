import type { MetadataRoute } from 'next';
import { categoryService, collectionService, productService, skinConcernService, skinTypeService, ingredientService } from '@/lib/services/catalog-service';
import { contentService } from '@/lib/services/content-service';
import { routes } from '@/lib/routes';
import { SITE_URL } from '@/lib/seo/structured-data';

export const revalidate = 3600;

/** Policy slugs are content records; their URLs live in the route table. */
const POLICY_ROUTES: Record<string, string> = {
  shipping: routes.shipping,
  returns: routes.returns,
  privacy: routes.privacy,
  terms: routes.terms,
  accessibility: routes.accessibility,
};

/**
 * Sitemap.
 *
 * Generated from the same service boundary the pages read from, so a product
 * added to the catalog appears here without a second registry drifting out of
 * sync. The one hand-written list below is the small set of fixed, index-only
 * routes that have no content record behind them.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, collections, products, concerns, skinTypes, ingredients, posts, pages] = await Promise.all([
    categoryService.getAll(),
    collectionService.getAll(),
    productService.getAll(),
    skinConcernService.getAll(),
    skinTypeService.getAll(),
    ingredientService.getAll(),
    contentService.getJournalPosts(),
    contentService.getPages(),
  ]);

  const now = new Date();

  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/concerns`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/skin-types`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/ingredients`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/journal`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const contentPages: MetadataRoute.Sitemap = pages
    .map((page) => ({ slug: page.slug, href: POLICY_ROUTES[page.slug] }))
    .filter((entry): entry is { slug: string; href: string } => Boolean(entry.href))
    .map((entry) => ({
      url: `${SITE_URL}${entry.href}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    }));

  return [
    ...fixed,
    ...contentPages,
    ...categories.map((term) => ({
      url: `${SITE_URL}${routes.category(term.slug)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...collections.map((collection) => ({
      url: `${SITE_URL}${routes.collection(collection.slug)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...concerns.map((term) => ({
      url: `${SITE_URL}${routes.concern(term.slug)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...skinTypes.map((term) => ({
      url: `${SITE_URL}${routes.skinType(term.slug)}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...ingredients.map((term) => ({
      url: `${SITE_URL}${routes.ingredient(term.slug)}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...products.map((product) => ({
      url: `${SITE_URL}${routes.product(product.slug)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...posts.map((post) => ({
      url: `${SITE_URL}${routes.journal.post(post.slug)}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
