import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { Paginated, Product, ProductQuery } from '@/types';
import { productService, categoryService, skinTypeService, skinConcernService, ingredientService } from '@/lib/services/catalog-service';
import { parseProductQuery } from '@/lib/utils/query-params';
import { routes } from '@/lib/routes';
import { Breadcrumbs, ProductGridSkeleton } from '@/components/ui/states';
import { CatalogBrowser, type CatalogLabels } from '@/components/catalog/CatalogBrowser';
import { buildFilterData, type FilterPanelData } from '@/lib/utils/filter-facets';
import { JsonLd, breadcrumbLd, itemListLd, SITE_URL } from '@/lib/seo/structured-data';
import { ProductRail } from '@/components/commerce/ProductCard';

/**
 * Shared catalog layout.
 *
 * `/shop`, the category, collection, concern, skin-type and ingredient pages
 * are the same screen with different scoping. Rather than six near-identical
 * routes, each resolves its own taxonomy record and metadata and then delegates
 * here — so filters, sorting, pagination and empty states are written once.
 *
 * Filters live in the URL, so the results depend on `searchParams`. That
 * dependency is deliberately confined to `CatalogResults` below, mounted under a
 * `Suspense` boundary: awaiting `searchParams` here would make the whole route
 * dynamic, which in turn defeats `dynamicParams = false` and turns an unknown
 * slug into a soft-200 "page not found" instead of a real 404.
 */

export interface CatalogHeader {
  eyebrow?: string;
  title: string;
  description?: string;
  image?: Product['thumbnail'];
  /** Extra copy shown under the grid, e.g. a collection story. */
  footer?: string;
}

export function catalogMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: `${SITE_URL}${input.path}` },
    openGraph: {
      title: input.title,
      description: input.description,
      url: `${SITE_URL}${input.path}`,
      ...(input.image ? { images: [{ url: input.image }] } : {}),
    },
  };
}

/**
 * Static part of a catalog page: everything that does not depend on the query
 * string, so it is prerendered and the page keeps its `<h1>` immediately.
 */
export function CatalogPage({
  searchParams,
  scope,
  header,
  crumbs,
  recommendationCount = 4,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  /** Taxonomy ids this page is scoped to, applied on top of any URL filters. */
  scope: ProductQuery;
  header: CatalogHeader;
  crumbs: { label: string; href?: string }[];
  recommendationCount?: number;
}) {
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={crumbs} className="mb-8" />

      <header className="mb-10 max-w-3xl">
        {header.eyebrow && <p className="eyebrow mb-3">{header.eyebrow}</p>}
        <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">{header.title}</h1>
        {header.description && <p className="mt-4 text-md leading-relaxed text-muted">{header.description}</p>}
      </header>

      <Suspense fallback={<ProductGridSkeleton count={8} className="mb-16" />}>
        <CatalogResults
          searchParams={searchParams}
          scope={scope}
          header={header}
          crumbs={crumbs}
          recommendationCount={recommendationCount}
        />
      </Suspense>
    </div>
  );
}

/** Everything that depends on the URL query string. */
async function CatalogResults({
  searchParams,
  scope,
  header,
  crumbs,
  recommendationCount,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  scope: ProductQuery;
  header: CatalogHeader;
  crumbs: { label: string; href?: string }[];
  recommendationCount: number;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }

  const fromUrl = parseProductQuery(params);
  const query: ProductQuery = { ...scope, ...fromUrl, perPage: queryPerPage(scope, fromUrl) };

  const [page, total, facets, categories, skinTypes, skinConcerns, ingredients, recommendations] = await Promise.all([
    productService.list(query),
    productService.count(query),
    productService.facets({ ...query, perPage: undefined, page: undefined }),
    categoryService.getAll(),
    skinTypeService.getAll(),
    skinConcernService.getAll(),
    ingredientService.getAll(),
    productService.getByFlags('isFeatured', recommendationCount),
  ]);

  // `list` returns one page and `count` the full match total; the pagination
  // component needs both, and the two are always asked for together.
  const perPage = query.perPage ?? 12;
  // A failed listing query renders as an empty shelf rather than a crash: the
  // page chrome, filters and navigation stay usable, which is what a shopper
  // needs in order to recover.
  const items = page.data ?? [];
  const result: Paginated<Product> = {
    items,
    total,
    page: query.page ?? 1,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };

  const labels: CatalogLabels = {
    categoryIds: nameMap(categories),
    skinTypeIds: nameMap(skinTypes),
    skinConcernIds: nameMap(skinConcerns),
    ingredientIds: nameMap(ingredients),
    productTypes: Object.fromEntries(
      facets.productTypes.map((item) => [item.id, item.id.replace(/^\w/, (char) => char.toUpperCase())]),
    ),
    brands: Object.fromEntries(facets.brands.map((item) => [item.id, item.id])),
  };

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      {result.total > 0 && (
        <JsonLd
          data={itemListLd(
            header.title,
            result.items.map((product) => ({ name: product.name, href: routes.product(product.slug) })),
          )}
        />
      )}

      <CatalogBrowser
        products={result}
        facets={buildFilterData(facets, { categories, skinTypes, skinConcerns, ingredients })}
        labels={labels}
      />

      {header.footer && (
        <div className="mx-auto mt-20 max-w-2xl border-t border-line pt-8 text-center">
          <p className="text-sm leading-relaxed text-muted">{header.footer}</p>
        </div>
      )}

      {recommendations.length > 0 && (
        <section className="mt-24 border-t border-line pt-16">
          <h2 className="mb-8 font-display text-2xl text-ink sm:text-3xl">You may also like</h2>
          <ProductRail products={recommendations} />
        </section>
      )}
    </>
  );
}

function nameMap(items: { id: string; name: string }[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.id, item.name]));
}

/** Listing pages show 12 at a time; a term landing page shows all it has. */
function queryPerPage(scope: ProductQuery, fromUrl: ProductQuery): number {
  if (fromUrl.perPage) return fromUrl.perPage;
  return scope.perPage ?? 12;
}
