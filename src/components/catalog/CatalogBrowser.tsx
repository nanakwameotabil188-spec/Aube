'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { Product, ProductQuery, ProductSortKey } from '@/types';
import type { Paginated } from '@/types';
import { parseProductQuery, serializeProductQuery } from '@/lib/utils/query-params';
import { ProductGrid } from '@/components/commerce/ProductCard';
import { EmptyState, Pagination } from '@/components/ui/states';
import { ActiveFilters, FilterDrawer, FilterPanel, SortControl, useFilterDrawer, type FilterPanelData } from '@/components/commerce/filters';

/**
 * Catalog browser.
 *
 * A thin client shell around server-rendered results. The products arrive as
 * props from a server component; this owns only what the URL owns — the query,
 * and the transitions between pages of it. Changing a filter pushes a new URL,
 * which re-runs the server query, so there is no client-side filtering logic
 * to drift out of sync with the backend.
 */

export interface CatalogLabels {
  categoryIds: Record<string, string>;
  skinTypeIds: Record<string, string>;
  skinConcernIds: Record<string, string>;
  ingredientIds: Record<string, string>;
  productTypes: Record<string, string>;
  brands: Record<string, string>;
}

export function CatalogBrowser({
  products,
  facets,
  labels,
  emptyTitle = 'Nothing matches those filters',
  emptyBody = 'Try removing a filter or two — the catalog is deliberately small, so it should be easy to narrow.',
}: {
  products: Paginated<Product>;
  facets: FilterPanelData;
  labels: CatalogLabels;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `usePathname` rather than `window.location`: this component renders on the
  // server too, where there is no `window`. It also keeps every navigation
  // below pointing at the same path.
  const pathname = usePathname();
  const query = parseProductQuery(new URLSearchParams(searchParams.toString()));
  const { isFilterDrawerOpen, openFilterDrawer, closeFilterDrawer } = useFilterDrawer();

  /**
   * Any change resets to page one: staying on page 7 of a list that just
   * shrank to two pages shows an empty grid with no obvious cause.
   */
  const update = useCallback(
    (patch: Partial<ProductQuery>) => {
      const next: ProductQuery = { ...query, ...patch, page: undefined };
      if (patch.page) next.page = patch.page;
      router.push(serializeProductQuery(next, pathname), { scroll: false });
    },
    [query, router, pathname],
  );

  const setSort = useCallback((sort: ProductSortKey) => update({ sort }), [update]);

  const clearAll = useCallback(() => router.push(pathname, { scroll: false }), [router, pathname]);

  const hrefFor = useCallback(
    (page: number) => serializeProductQuery({ ...query, page: page > 1 ? page : undefined }, pathname),
    [query, pathname],
  );

  const isEmpty = products.items.length === 0;

  return (
    <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
      <aside className="hidden lg:block">
        <FilterPanel
          data={facets}
          query={query}
          onChange={update}
          onClear={clearAll}
          className="sticky top-28 max-h-[calc(100vh-9rem)] overflow-y-auto pr-2"
        />
      </aside>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <p className="text-sm text-muted" aria-live="polite">
            {products.total} {products.total === 1 ? 'product' : 'products'}
          </p>

          <div className="flex items-center gap-3">
            <FilterDrawer
              open={isFilterDrawerOpen}
              onClose={closeFilterDrawer}
              data={facets}
              query={query}
              onChange={update}
              onClear={clearAll}
              resultCount={products.total}
            />
            <SortControl value={query.sort ?? 'position'} onChange={setSort} resultCount={products.total} />
          </div>
        </div>

        <ActiveFilters query={query} labels={labels} onChange={update} onClear={clearAll} />

        {isEmpty ? (
          <EmptyState
            title={emptyTitle}
            body={emptyBody}
            icon="search"
            action={{ label: 'Clear all filters', href: pathname }}
          />
        ) : (
          <ProductGrid products={products.items} />
        )}

        <Pagination page={products.page} totalPages={products.totalPages} buildHref={hrefFor} className="mt-4" />
      </div>
    </div>
  );
}
