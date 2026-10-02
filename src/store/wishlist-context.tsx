'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Product } from '@/types';
import { usePersistentState } from '@/lib/hooks/use-persistent-state';

/**
 * Wishlist and recently-viewed state.
 *
 * Both are stored as product ids rather than product objects, so a real
 * implementation can resolve them through `productService` and sync to the
 * customer's account without a migration.
 */

const WISHLIST_KEY = 'aube.wishlist.v1';
const RECENT_KEY = 'aube.recently-viewed.v1';
const RECENT_LIMIT = 8;

interface WishlistContextValue {
  ids: string[];
  isReady: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
  add: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
  /** Moves wishlist items into the cart and clears them. */
  moveAllToCart: (resolve: (ids: string[]) => Product[]) => number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds, isReady] = usePersistentState<string[]>(WISHLIST_KEY, []);

  const has = (productId: string) => ids.includes(productId);
  const add = (productId: string) => setIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
  const remove = (productId: string) => setIds((prev) => prev.filter((id) => id !== productId));
  const toggle = (productId: string) => {
    setIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  };
  const clear = () => setIds([]);

  /**
   * Resolves the current ids and empties the list in one go. The caller passes
   * the resolver because product data lives behind `productService`, which this
   * provider deliberately does not import.
   */
  const moveAllToCart = (resolve: (ids: string[]) => Product[]) => {
    const products = resolve(ids);
    setIds([]);
    return products.length;
  };

  const value: WishlistContextValue = {
    ids,
    isReady,
    has,
    toggle,
    add,
    remove,
    clear,
    count: ids.length,
    moveAllToCart,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used inside <WishlistProvider>.');
  return context;
}

/* ------------------------------------------------------------------ */
/* Recently viewed                                                     */
/* ------------------------------------------------------------------ */

interface RecentlyViewedContextValue {
  ids: string[];
  isReady: boolean;
  record: (productId: string) => void;
  clear: () => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(null);

export function RecentlyViewedProvider({ children }: { children: ReactNode }) {
  const [ids, setIds, isReady] = usePersistentState<string[]>(RECENT_KEY, []);

  const record = (productId: string) => {
    setIds((prev) => [productId, ...prev.filter((id) => id !== productId)].slice(0, RECENT_LIMIT));
  };

  const clear = () => setIds([]);

  const value: RecentlyViewedContextValue = { ids, isReady, record, clear };

  return <RecentlyViewedContext.Provider value={value}>{children}</RecentlyViewedContext.Provider>;
}

export function useRecentlyViewed(): RecentlyViewedContextValue {
  const context = useContext(RecentlyViewedContext);
  if (!context) throw new Error('useRecentlyViewed must be used inside <RecentlyViewedProvider>.');
  return context;
}
