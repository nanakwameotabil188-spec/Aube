'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Ingredient, Product, SkinConcern, StoreSettings } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/format';
import { routes } from '@/lib/routes';
import { searchProducts } from '@/lib/actions';
import { Icon } from '@/components/ui/Icon';
import { Price } from '@/components/ui/primitives';
import { useUI } from '@/store/ui-context';
import { usePersistentValue } from '@/lib/hooks/use-persistent-state';
import { useDebounced, useEscapeKey, useLockBodyScroll } from '@/lib/hooks';

/**
 * Search overlay.
 *
 * Query results are resolved through the `searchProducts` server action, so the
 * matching, ranking and future search-engine integration all live behind the
 * service boundary — this component only renders what it is given.
 */

const RECENT_KEY = 'aube.recent-searches.v1';
const MAX_RECENT = 5;

/** Stable empty reference, so an empty result list is not a new array each render. */
const EMPTY_PRODUCTS: Product[] = [];

const POPULAR = [
  { label: 'Niacinamide', href: '/ingredient/niacinamide' },
  { label: 'Barrier repair', href: '/concern/barrier-damage' },
  { label: 'Vitamin C', href: '/ingredient/vitamin-c' },
  { label: 'Retinal', href: '/ingredient/retinal' },
  { label: 'Sunscreen', href: '/category/sun-care' },
];

export function SearchOverlay({
  categories,
  skinConcerns,
  ingredients,
  settings,
}: {
  categories: Category[];
  skinConcerns: SkinConcern[];
  ingredients: Ingredient[];
  settings: StoreSettings;
}) {
  const { isOpen, close } = useUI();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [term, setTerm] = useState('');
  // Results are stored against the query that produced them. A stale response
  // is therefore never rendered: it simply stops matching the current query.
  const [found, setFound] = useState<{ query: string; items: Product[] }>({ query: '', items: [] });
  const [recent, setRecent] = usePersistentValue<string[]>(RECENT_KEY, []);

  const debounced = useDebounced(term, 220);
  const query = debounced.trim();
  const open = isOpen('search');

  const results = found.query === query ? found.items : EMPTY_PRODUCTS;
  const isSearching = query !== '' && found.query !== query;

  // Clearing happens in the dismiss handler rather than an effect watching
  // `open`, so reopening shows an empty field on the very first frame instead
  // of a frame carrying the previous query.
  const dismiss = useCallback(() => {
    setTerm('');
    setFound({ query: '', items: [] });
    close();
  }, [close]);

  useLockBodyScroll(open);
  useEscapeKey(dismiss, open);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    // Through a server action, so the browser never holds the catalog.
    searchProducts(query, 6).then(({ products }) => {
      if (!cancelled) setFound({ query, items: products });
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const termMatches = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return { categories: [], concerns: [], ingredients: [] };
    const includes = (value: string) => value.toLowerCase().includes(query);
    return {
      categories: categories.filter((item) => includes(item.name)).slice(0, 3),
      concerns: skinConcerns.filter((item) => includes(item.name)).slice(0, 3),
      ingredients: ingredients.filter((item) => includes(item.name)).slice(0, 3),
    };
    // Categories and concerns are stable for the lifetime of the layout.
  }, [term, categories, skinConcerns, ingredients]);

  const remember = (value: string) => {
    const next = [value, ...recent.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, MAX_RECENT);
    setRecent(next);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!term.trim()) return;
    remember(term.trim());
    dismiss();
    router.push(routes.search + `?q=${encodeURIComponent(term.trim())}`);
  };

  const hasResults = results.length > 0 || termMatches.categories.length > 0 || termMatches.concerns.length > 0 || termMatches.ingredients.length > 0;

  return (
    <div
      className={cn(
        'fixed inset-0 z-80 transition-[visibility,opacity] duration-300',
        open ? 'visible opacity-100' : 'invisible opacity-0',
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close search"
        tabIndex={open ? 0 : -1}
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search products"
        className={cn(
          'absolute inset-x-0 top-0 max-h-[90vh] overflow-y-auto border-b border-line bg-porcelain shadow-overlay',
          open ? 'animate-fade-up' : '',
        )}
      >
        <div className="container-page py-6 sm:py-8">
          <form onSubmit={submit} role="search" className="flex items-center gap-3 border-b border-ink pb-3">
            <Icon name="search" size={22} aria-hidden className="shrink-0 text-ink" />
            <label htmlFor="site-search" className="sr-only">
              Search products, ingredients and concerns
            </label>
            <input
              id="site-search"
              ref={inputRef}
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search products, ingredients, concerns…"
              autoComplete="off"
              tabIndex={open ? 0 : -1}
              aria-describedby="search-hint"
              aria-controls="search-results"
              className="min-w-0 flex-1 bg-transparent font-display text-xl text-ink placeholder:text-muted-light focus:outline-none sm:text-2xl"
            />
            {term && (
              <button
                type="button"
                onClick={() => setTerm('')}
                tabIndex={open ? 0 : -1}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"
                aria-label="Clear search"
              >
                <Icon name="close" size={16} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              tabIndex={open ? 0 : -1}
              className="hidden shrink-0 text-xs uppercase tracking-[0.14em] text-muted hover:text-ink sm:block"
            >
              Esc
            </button>
          </form>

          <p id="search-hint" className="sr-only">
            Results update as you type. Press Enter to see all results.
          </p>

          <div id="search-results" className="mt-7" aria-live="polite">
            {!term.trim() ? (
              <IdleState recent={recent} onSelect={remember} onDismiss={dismiss} settings={settings} />
            ) : isSearching && results.length === 0 ? (
              <SearchSkeleton />
            ) : hasResults ? (
              <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
                <div>
                  <p className="eyebrow mb-4">
                    {results.length} {results.length === 1 ? 'product' : 'products'}
                  </p>
                  {results.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-line">
                      {results.map((product) => (
                        <li key={product.id}>
                          <Link
                            href={routes.product(product.slug)}
                            onClick={() => {
                              remember(term.trim());
                              close();
                            }}
                            tabIndex={open ? 0 : -1}
                            className="group/result flex items-center gap-4 py-3.5"
                          >
                            <span className="relative size-16 shrink-0 overflow-hidden rounded-xs bg-sand">
                              <Image src={product.thumbnail.url} alt="" fill sizes="64px" className="object-cover" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-display text-lg text-ink transition-colors group-hover/result:text-moss">
                                {product.name}
                              </span>
                              <span className="block truncate text-xs text-muted">{product.subtitle}</span>
                            </span>
                            <Price price={product.price} compareAtPrice={product.compareAtPrice} size="sm" className="shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">No products match &ldquo;{term.trim()}&rdquo;.</p>
                  )}
                </div>

                <div className="flex flex-col gap-6">
                  <SuggestionList
                    heading="Skin concerns"
                    items={termMatches.concerns.map((item) => ({ id: item.id, label: item.name, href: routes.concern(item.slug) }))}
                    onNavigate={close}
                    tabIndex={open ? 0 : -1}
                  />
                  <SuggestionList
                    heading="Ingredients"
                    items={termMatches.ingredients.map((item) => ({ id: item.id, label: item.name, href: routes.ingredient(item.slug) }))}
                    onNavigate={close}
                    tabIndex={open ? 0 : -1}
                  />
                  <SuggestionList
                    heading="Categories"
                    items={termMatches.categories.map((item) => ({ id: item.id, label: item.name, href: routes.category(item.slug) }))}
                    onNavigate={close}
                    tabIndex={open ? 0 : -1}
                  />
                </div>
              </div>
            ) : (
              <div className="py-6">
                <p className="font-display text-2xl text-ink">No results for &ldquo;{term.trim()}&rdquo;</p>
                <p className="mt-2 max-w-md text-base leading-relaxed text-muted">
                  Check the spelling, or browse by skin concern — it is usually faster than guessing a product name.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {skinConcerns.slice(0, 5).map((concern) => (
                    <Link
                      key={concern.id}
                      href={routes.concern(concern.slug)}
                      onClick={dismiss}
                      tabIndex={open ? 0 : -1}
                      className="rounded-full border border-line bg-shell px-3.5 py-1.5 text-xs text-ink transition-colors hover:border-ink"
                    >
                      {concern.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {term.trim() && (results.length > 0 || hasResults) && (
            <button
              type="button"
              onClick={submit}
              tabIndex={open ? 0 : -1}
              className="mt-8 flex w-full items-center justify-between border-t border-line pt-5 text-sm font-medium text-ink transition-colors hover:text-moss"
            >
              See all results for &ldquo;{term.trim()}&rdquo;
              <Icon name="arrow-right" size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IdleState({
  recent,
  onSelect,
  onDismiss,
  settings,
}: {
  recent: string[];
  onSelect: (value: string) => void;
  /** Navigating away from a suggestion chip must also clear the query. */
  onDismiss: () => void;
  settings: StoreSettings;
}) {
  const router = useRouter();
  const close = useUI().close;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <p className="eyebrow mb-4">Popular searches</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onDismiss}
              className="rounded-full border border-line bg-shell px-3.5 py-1.5 text-xs text-ink transition-colors hover:border-ink"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {recent.length > 0 && (
          <>
            <p className="eyebrow mt-8 mb-3">Recent searches</p>
            <ul className="flex flex-col divide-y divide-line">
              {recent.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      close();
                      router.push(routes.search + `?q=${encodeURIComponent(item)}`);
                    }}
                    className="flex w-full items-center gap-3 py-2.5 text-left text-sm text-muted transition-colors hover:text-ink"
                  >
                    <Icon name="search" size={14} aria-hidden />
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="rounded-xs border border-line bg-sand p-5">
        <p className="eyebrow mb-2">Need a starting point?</p>
        <p className="text-sm leading-relaxed text-muted">
          Answer four questions and we will build a routine from the {settings.brandName} range. It takes about a minute.
        </p>
        <Link
          href="/faq#skin"
          onClick={onDismiss}
          className="link-underline mt-3 inline-block text-sm font-medium text-ink"
        >
          Read the four-step guide
        </Link>
      </div>
    </div>
  );
}

function SuggestionList({
  heading,
  items,
  onNavigate,
  tabIndex,
}: {
  heading: string;
  items: { id: string; label: string; href: string }[];
  onNavigate: () => void;
  tabIndex: number;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-3">{heading}</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              onClick={onNavigate}
              tabIndex={tabIndex}
              className="text-sm text-ink transition-colors hover:text-moss"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div role="status" aria-label="Searching" className="flex flex-col divide-y divide-line">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 py-3.5">
          <div className="skeleton size-16 shrink-0 rounded-xs" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2 rounded-xs" />
            <div className="skeleton h-3 w-1/3 rounded-xs" />
          </div>
        </div>
      ))}
      <span className="sr-only">Searching</span>
    </div>
  );
}
