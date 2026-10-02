'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { saveCategoryShowcase, type AdminActionResult } from '@/lib/actions/admin';
import type { AdminSection } from '@/lib/supabase/admin-content';

/**
 * Category selection for a `category-showcase` homepage section.
 *
 * Presents the real category records rather than a fixed list of names, so a
 * category created in the catalogue appears here with nothing to update — which
 * is the whole point of driving the section from data instead of hard-coding
 * "CLEANSERS / SERUMS / MOISTURISERS" into a component.
 *
 * Tick order is the row order. Multi-checkbox groups post in DOM order, so the
 * checkboxes are rendered in the order the admin last arranged them rather
 * than alphabetically, otherwise the ordering they can see would not be the
 * ordering the storefront uses.
 */

interface CategoryOption {
  id: string;
  name: string;
  /** How many visible products currently carry this category. */
  productCount: number;
}

function Result({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={
        result.ok
          ? 'rounded-md border border-line bg-success-soft px-3 py-2 text-sm text-success'
          : 'rounded-md border border-line bg-danger-soft px-3 py-2 text-sm text-danger'
      }
    >
      {result.message}
    </p>
  );
}

export function CategoryShowcaseFields({
  section,
  categories,
}: {
  section: AdminSection;
  categories: CategoryOption[];
}) {
  const [state, action, pending] = useActionState<AdminActionResult | null, FormData>(
    saveCategoryShowcase,
    null,
  );
  const router = useRouter();

  const payload = (section.payload ?? {}) as {
    categoryIds?: string[];
    perCategory?: number;
    maxCategories?: number;
  };
  const selected = payload.categoryIds ?? [];

  // The admin's order first, then anything not yet chosen.
  const ordered = [
    ...selected.map((id) => categories.find((c) => c.id === id)).filter((c): c is CategoryOption => Boolean(c)),
    ...categories.filter((c) => !selected.includes(c.id)),
  ];

  if (categories.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line px-4 py-6 text-sm text-muted">
        No categories exist yet. Create one on a product first, then come back and tick it here.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-md border border-line bg-porcelain p-4">
      <input type="hidden" name="id" value={section.id} />

      <div>
        <p className="text-sm font-medium">Which categories should this show?</p>
        <p className="mt-0.5 text-xs text-muted">
          Each ticked category gets its own row, with that category&rsquo;s own products. Tick them
          in the order you want the rows to appear — the first one is at the top.
        </p>
      </div>

      <ul className="space-y-1.5">
        {ordered.map((category) => {
          const isSelected = selected.includes(category.id);
          return (
            <li key={category.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                  isSelected ? 'border-ink bg-shell' : 'border-line bg-shell hover:border-line-strong'
                }`}
              >
                <input
                  type="checkbox"
                  name="category_ids"
                  value={category.id}
                  defaultChecked={isSelected}
                  className="size-4 accent-moss"
                />
                <span className="flex-1">{category.name}</span>
                {isSelected && selected.indexOf(category.id) > 0 ? (
                  <span className="text-xs tabular-nums text-muted">
                    row {selected.indexOf(category.id) + 1}
                  </span>
                ) : null}
                <span
                  className={
                    category.productCount === 0
                      ? 'text-xs text-danger'
                      : 'text-xs tabular-nums text-muted'
                  }
                >
                {category.productCount === 0
                  ? 'no visible products'
                  : `${category.productCount} product${category.productCount === 1 ? '' : 's'}`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`per-${section.id}`} className="block text-sm font-medium">
            Products per row
          </label>
          <input
            id={`per-${section.id}`}
            name="per_category"
            type="number"
            min={2}
            max={8}
            defaultValue={payload.perCategory ?? 4}
            className="mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted">
            A category with fewer products than this shows all of them.
          </p>
        </div>

        <div>
          <label htmlFor={`max-${section.id}`} className="block text-sm font-medium">
            Maximum rows
          </label>
          <input
            id={`max-${section.id}`}
            name="max_categories"
            type="number"
            min={1}
            max={8}
            defaultValue={payload.maxCategories ?? 4}
            className="mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted">
            Keeps the homepage from growing without bound as you add categories.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save categories'}
        </button>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          Refresh
        </button>
        <Result result={state} />
      </div>

      {selected.length === 0 ? (
        <p className="rounded-md border border-line bg-shell px-3 py-2 text-xs text-muted">
          Nothing ticked, so this section currently shows nothing. It stays off the storefront
          until you tick a category and mark the section Live.
        </p>
      ) : null}
    </form>
  );
}
