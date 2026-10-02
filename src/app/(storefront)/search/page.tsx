import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { productService, categoryService, skinConcernService, ingredientService } from '@/lib/services/catalog-service';
import { parseProductQuery } from '@/lib/utils/query-params';
import { routes } from '@/lib/routes';
import { ProductGrid } from '@/components/commerce/ProductCard';
import { ProductGridSkeleton, EmptyState } from '@/components/ui/states';
import { MediaImage } from '@/components/commerce/ProductGallery';
import { Icon } from '@/components/ui/Icon';
import { JsonLd, SITE_URL, breadcrumbLd } from '@/lib/seo/structured-data';
import { pageMetadata } from '@/lib/seo/metadata';
import { contentService } from '@/lib/services/content-service';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await contentService.getSettings();
  return pageMetadata(settings, {
    title: 'Search',
    description: `Search ${settings.brandName} products, ingredients and skin concerns.`,
    path: routes.search,
    // Result pages are permutations of the same catalog and should not be
    // indexed individually.
    noIndex: true,
  });
}

const SUGGESTIONS = [
  { label: 'Barrier repair', href: routes.concern('barrier-damage') },
  { label: 'Vitamin C', href: routes.ingredient('vitamin-c') },
  { label: 'Retinal', href: routes.ingredient('retinal') },
  { label: 'Niacinamide', href: routes.ingredient('niacinamide') },
  { label: 'Sunscreen', href: routes.category('sun-care') },
  { label: 'Sensitive skin', href: routes.skinType('sensitive') },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }

  const query = parseProductQuery(params);
  const term = query.search ?? '';

  const [products, categories, concerns, ingredients] = await Promise.all([
    term ? productService.list({ ...query, perPage: 24 }) : Promise.resolve(null),
    categoryService.getAll(),
    skinConcernService.getAll(),
    ingredientService.getAll(),
  ]);

  // An empty or failed result both mean "no matches", so the page shows its
  // empty state and keeps the term box usable instead of erroring.
  const results = products?.data ?? [];

  const crumbs = [
    { label: 'Home', href: routes.home },
    { label: 'Search' },
  ];

  // Taxonomy is matched on the same query, so "vitamin" surfaces the ingredient
  // page alongside the products that contain it.
  const needle = term.trim().toLowerCase();
  const includes = (value: string) => value.toLowerCase().includes(needle);
  const matchedCategories = needle ? categories.filter((item) => includes(item.name)) : [];
  const matchedConcerns = needle ? concerns.filter((item) => includes(item.name)) : [];
  const matchedIngredients = needle ? ingredients.filter((item) => includes(item.name)) : [];

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />

      <div className="container-page py-10 sm:py-14">
        <header className="mb-8">
          <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
            {term ? <>Results for “{term}”</> : 'Search'}
          </h1>
          {term && (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              {results.length} {results.length === 1 ? 'product' : 'products'} found
            </p>
          )}
        </header>

        {/*
          A plain GET form rather than a client-side one: results are already
          URL-driven, so this needs no JavaScript to work and stays usable if
          hydration is slow. The header opens the overlay for instant results;
          this is the full page you land on from a shared or bookmarked link.
        */}
        <form action={routes.search} method="get" role="search" className="mb-12 max-w-2xl">
          <label htmlFor="search-page-term" className="sr-only">
            Search products, ingredients and concerns
          </label>
          <div className="flex items-center gap-3 border-b border-ink pb-3">
            <Icon name="search" size={20} aria-hidden className="shrink-0 text-ink" />
            <input
              id="search-page-term"
              name="q"
              type="search"
              defaultValue={term}
              placeholder="Search products, ingredients, or concerns"
              className="h-9 w-full bg-transparent text-base text-ink placeholder:text-muted-light focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 text-sm text-ink underline underline-offset-4 transition-colors hover:text-muted"
            >
              Search
            </button>
          </div>
        </form>

        {!term ? (
          <div className="flex flex-col gap-8">
            <p className="max-w-md text-md leading-relaxed text-muted">
              Search by product name, an ingredient, or what your skin is doing.
            </p>
            <ul className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex h-9 items-center rounded-full border border-line bg-shell px-4 text-sm text-ink transition-colors hover:border-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {(matchedCategories.length > 0 || matchedConcerns.length > 0 || matchedIngredients.length > 0) && (
              <section className="mb-14">
                <h2 className="eyebrow mb-4">In the index</h2>
                <ul className="grid gap-4 sm:grid-cols-3">
                  {matchedIngredients.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={routes.ingredient(item.slug)}
                        className="group/term flex items-center gap-3 rounded-xs border border-line p-3 transition-colors hover:border-ink"
                      >
                        {item.image && (
                          <span className="relative size-12 shrink-0 overflow-hidden rounded-xs bg-sand">
                            <MediaImage
                              image={item.image}
                              aspect="1/1"
                              rounded="rounded-xs"
                              sizes="48px"
                              className="[&_img]:object-cover"
                            />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-2xs uppercase tracking-[0.12em] text-muted">Ingredient</span>
                          <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                        </span>
                        <Icon
                          name="arrow-right"
                          size={14}
                          aria-hidden
                          className="shrink-0 text-muted transition-transform group-hover/term:translate-x-0.5"
                        />
                      </Link>
                    </li>
                  ))}
                  {matchedConcerns.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={routes.concern(item.slug)}
                        className="group/term flex items-center gap-3 rounded-xs border border-line p-3 transition-colors hover:border-ink"
                      >
                        <span className="grid size-12 shrink-0 place-items-center rounded-xs bg-sand text-moss">
                          <Icon name={item.icon ?? 'sparkle'} size={18} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-2xs uppercase tracking-[0.12em] text-muted">Concern</span>
                          <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                        </span>
                        <Icon
                          name="arrow-right"
                          size={14}
                          aria-hidden
                          className="shrink-0 text-muted transition-transform group-hover/term:translate-x-0.5"
                        />
                      </Link>
                    </li>
                  ))}
                  {matchedCategories.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={routes.category(item.slug)}
                        className="group/term flex items-center gap-3 rounded-xs border border-line p-3 transition-colors hover:border-ink"
                      >
                        <span className="grid size-12 shrink-0 place-items-center rounded-xs bg-sand text-moss">
                          <Icon name="grid" size={18} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-2xs uppercase tracking-[0.12em] text-muted">Category</span>
                          <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                        </span>
                        <Icon
                          name="arrow-right"
                          size={14}
                          aria-hidden
                          className="shrink-0 text-muted transition-transform group-hover/term:translate-x-0.5"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Suspense fallback={<ProductGridSkeleton count={8} />}>
              {results.length > 0 ? (
                <section>
                  <h2 className="eyebrow mb-6">Products</h2>
                  <ProductGrid products={results} />
                </section>
              ) : (
                <EmptyState
                  title={`Nothing found for “${term}”`}
                  body="Check the spelling, or try a broader term — an ingredient name, or what your skin is doing."
                  icon="search"
                  action={{ label: 'Shop all products', href: routes.shop }}
                />
              )}
            </Suspense>
          </>
        )}
      </div>
    </>
  );
}
