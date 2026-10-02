'use client';

import { useCallback, useMemo } from 'react';
import type { Category, Ingredient, ProductQuery, ProductSortKey, SkinConcern, SkinType } from '@/types';
import { SORT_OPTIONS } from '@/lib/utils/catalog';
import { formatMoney } from '@/lib/utils/format';
import { money } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { Checkbox, Radio, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/overlays';
import { useUI } from '@/store/ui-context';
import { type FilterPanelData } from '@/lib/utils/filter-facets';

export type { FilterPanelData };

/**
 * Filter state.
 *
 * Lives in URL search params in the page component, not here. This hook owns
 * only the drawer/toggle state that does not belong in the URL, so filters
 * stay shareable and back/forward works.
 */

export function useFilterDrawer() {
  const { isOpen, open, close } = useUI();
  return {
    isFilterDrawerOpen: isOpen('filters'),
    openFilterDrawer: () => open('filters'),
    closeFilterDrawer: close,
  };
}

/* ------------------------------------------------------------------ */
/* Filter panel                                                        */
/* ------------------------------------------------------------------ */

/**
 * Price bands, in minor units to match `Money.amount` and `ProductQuery`.
 * Defined once so the labels shown and the values matched against the URL
 * cannot drift apart.
 */
const PRICE_BANDS: { value: string; label: string; min?: number; max?: number }[] = [
  { value: 'all', label: 'Any price' },
  { value: 'under-40', label: `Under ${formatMoney(money(4000))}`, min: 0, max: 4000 },
  {
    value: '40-80',
    label: `${formatMoney(money(4000))} – ${formatMoney(money(8000))}`,
    min: 4000,
    max: 8000,
  },
  {
    value: '80-120',
    label: `${formatMoney(money(8000))} – ${formatMoney(money(12000))}`,
    min: 8000,
    max: 12000,
  },
  { value: 'over-120', label: `Over ${formatMoney(money(12000))}`, min: 12000 },
];

export function FilterPanel({
  data,
  query,
  onChange,
  onClear,
  className,
}: {
  data: FilterPanelData;
  query: ProductQuery;
  onChange: (patch: Partial<ProductQuery>) => void;
  onClear: () => void;
  className?: string;
}) {
  // Derived from the URL rather than held in state, so the selected band stays
  // correct through back/forward navigation and a shared link.
  const priceBand = useMemo(() => {
    if (query.minPrice == null && query.maxPrice == null) return 'all';
    return (
      PRICE_BANDS.find((band) => band.min === query.minPrice && band.max === query.maxPrice)?.value ?? 'all'
    );
  }, [query.minPrice, query.maxPrice]);

  const toggleIn = useCallback(
    (key: 'categoryIds' | 'skinTypeIds' | 'skinConcernIds' | 'ingredientIds' | 'productTypes', id: string) => {
      const current = query[key] ?? [];
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      onChange({ [key]: next.length ? next : undefined });
    },
    [onChange, query],
  );

  const activeCount = useMemo(() => {
    let count = 0;
    if (query.categoryIds?.length) count += query.categoryIds.length;
    if (query.skinTypeIds?.length) count += query.skinTypeIds.length;
    if (query.skinConcernIds?.length) count += query.skinConcernIds.length;
    if (query.ingredientIds?.length) count += query.ingredientIds.length;
    if (query.productTypes?.length) count += query.productTypes.length;
    if (query.brands?.length) count += query.brands.length;
    if (query.minPrice != null || query.maxPrice != null) count += 1;
    if (query.inStockOnly) count += 1;
    if (query.onSaleOnly) count += 1;
    if (query.minRating) count += 1;
    return count;
  }, [query]);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="eyebrow">
          Filter
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-ink px-1.5 py-0.5 text-2xs tabular-nums text-shell">
              {activeCount}
            </span>
          )}
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted transition-colors hover:text-ink"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <FilterGroup title="Category">
          {data.categories.map((category) => (
            <Checkbox
              key={category.id}
              label={category.name}
              count={category.count}
              checked={query.categoryIds?.includes(category.id) ?? false}
              onChange={() => toggleIn('categoryIds', category.id)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Product type">
          {data.productTypes.map((entry) => (
            <Checkbox
              key={entry.id}
              label={entry.label}
              count={entry.count}
              checked={query.productTypes?.includes(entry.id as NonNullable<ProductQuery['productTypes']>[number]) ?? false}
              onChange={() => toggleIn('productTypes', entry.id)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Skin concern">
          {data.skinConcerns.map((concern) => (
            <Checkbox
              key={concern.id}
              label={concern.name}
              count={concern.count}
              checked={query.skinConcernIds?.includes(concern.id) ?? false}
              onChange={() => toggleIn('skinConcernIds', concern.id)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Skin type">
          {data.skinTypes.map((type) => (
            <Checkbox
              key={type.id}
              label={type.name}
              count={type.count}
              checked={query.skinTypeIds?.includes(type.id) ?? false}
              onChange={() => toggleIn('skinTypeIds', type.id)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Ingredient">
          {data.ingredients.slice(0, 12).map((ingredient) => (
            <Checkbox
              key={ingredient.id}
              label={ingredient.name}
              count={ingredient.count}
              checked={query.ingredientIds?.includes(ingredient.id) ?? false}
              onChange={() => toggleIn('ingredientIds', ingredient.id)}
            />
          ))}
        </FilterGroup>

        {data.brands.length > 1 && (
          <FilterGroup title="Brand">
            {data.brands.map((brand) => (
              <Checkbox
                key={brand.id}
                label={brand.label}
                count={brand.count}
                checked={query.brands?.includes(brand.id) ?? false}
                onChange={() => {
                  const current = query.brands ?? [];
                  const next = current.includes(brand.id) ? current.filter((item) => item !== brand.id) : [...current, brand.id];
                  onChange({ brands: next.length ? next : undefined });
                }}
              />
            ))}
          </FilterGroup>
        )}

        <FilterGroup title="Price">
          <div className="flex flex-col gap-1 pt-1">
            {PRICE_BANDS.map((band) => (
              <Radio
                key={band.value}
                name="price-band"
                value={band.value}
                label={band.label}
                checked={priceBand === band.value}
                onChange={() => onChange({ minPrice: band.min, maxPrice: band.max })}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Availability">
          <div className="flex flex-col gap-1 pt-1">
            <Checkbox
              label={`In stock only (${data.inStockCount})`}
              checked={query.inStockOnly ?? false}
              onChange={(event) => onChange({ inStockOnly: event.target.checked || undefined })}
            />
            <Checkbox
              label={`On sale (${data.onSaleCount})`}
              checked={query.onSaleOnly ?? false}
              onChange={(event) => onChange({ onSaleOnly: event.target.checked || undefined })}
            />
            {/*
              A minimum-rating filter is meaningless while nothing is rated:
              with no approved reviews it would exclude every product, and
              offering it implies ratings exist. It appears only once real
              reviews land.
            */}
            {data.ratedCount > 0 && (
              <Checkbox
                label="Rated 4 stars and above"
                checked={query.minRating === 4}
                onChange={(event) => onChange({ minRating: event.target.checked ? 4 : undefined })}
              />
            )}
          </div>
        </FilterGroup>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5">
      <legend className="sr-only">{title}</legend>
      <p className="mb-1.5 text-sm font-medium text-ink">{title}</p>
      <div className="max-h-56 overflow-y-auto pr-1">{children}</div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Sort control                                                        */
/* ------------------------------------------------------------------ */

export function SortControl({
  value,
  onChange,
  resultCount,
  className,
}: {
  value: ProductSortKey;
  onChange: (sort: ProductSortKey) => void;
  resultCount: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <p className="hidden text-xs text-muted sm:block">
        <span className="tabular-nums text-ink">{resultCount}</span> {resultCount === 1 ? 'product' : 'products'}
      </p>
      <Select
        label="Sort by"
        value={value}
        onChange={(event) => onChange(event.target.value as ProductSortKey)}
        options={SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        containerClassName="min-w-48"
        className="h-9 border-line text-sm"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter drawer (mobile)                                              */
/* ------------------------------------------------------------------ */

export function FilterDrawer(props: {
  open: boolean;
  onClose: () => void;
  data: FilterPanelData;
  query: ProductQuery;
  onChange: (patch: Partial<ProductQuery>) => void;
  onClear: () => void;
  resultCount: number;
}) {
  const { open, onClose, resultCount, ...panelProps } = props;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filter"
      side="left"
      widthClass="w-full max-w-sm"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={panelProps.onClear} className="flex-1">
            Clear
          </Button>
          <Button onClick={onClose} className="flex-1">
            Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </Button>
        </div>
      }
    >
      <FilterPanel {...panelProps} />
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Active filter chips                                                 */
/* ------------------------------------------------------------------ */

export function ActiveFilters({
  query,
  labels,
  onChange,
  onClear,
  className,
}: {
  query: ProductQuery;
  labels: {
    categoryIds?: Record<string, string>;
    skinTypeIds?: Record<string, string>;
    skinConcernIds?: Record<string, string>;
    ingredientIds?: Record<string, string>;
    productTypes?: Record<string, string>;
    brands?: Record<string, string>;
  };
  onChange: (patch: Partial<ProductQuery>) => void;
  onClear: () => void;
  className?: string;
}) {
  const chips: { key: keyof ProductQuery; id: string; label: string }[] = [];

  const collect = (key: 'categoryIds' | 'skinTypeIds' | 'skinConcernIds' | 'ingredientIds' | 'productTypes' | 'brands') => {
    for (const id of query[key] ?? []) {
      chips.push({ key, id, label: labels[key]?.[id] ?? id });
    }
  };

  collect('categoryIds');
  collect('skinTypeIds');
  collect('skinConcernIds');
  collect('ingredientIds');
  collect('productTypes');
  collect('brands');

  const hasExtras =
    query.minPrice != null || query.maxPrice != null || query.inStockOnly || query.onSaleOnly || query.minRating;

  if (chips.length === 0 && !hasExtras) return null;

  const remove = (key: keyof ProductQuery, id: string) => {
    const current = (query[key] as string[] | undefined) ?? [];
    const next = current.filter((item) => item !== id);
    onChange({ [key]: next.length ? next : undefined });
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <button
          key={`${chip.key}-${chip.id}`}
          type="button"
          onClick={() => remove(chip.key, chip.id)}
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-shell pl-3 pr-2 text-xs text-ink transition-colors hover:border-ink"
        >
          {chip.label}
          <Icon name="close" size={11} aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}

      {hasExtras && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-sand pl-3 pr-2 text-xs text-ink transition-colors hover:border-ink"
        >
          Clear all filters
          <Icon name="close" size={11} aria-hidden />
        </button>
      )}
    </div>
  );
}

