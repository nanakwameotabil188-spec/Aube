'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Cart, CartLine, Product, Promotion, ShippingMethod, StoreSettings } from '@/types';
import { cartService } from '@/lib/commerce/cart-service';
import { calculateTotals, countLines, emptyCart, MAX_LINE_QUANTITY } from '@/lib/commerce/pricing';
import { usePersistentValue } from '@/lib/hooks/use-persistent-state';
import { useHydrated } from '@/lib/hooks/use-media-query';

/**
 * Cart state.
 *
 * The persisted store *is* the cart, not a snapshot of it. Every mutation is a
 * pure transformation from `cartService` applied inside a store update, so there
 * is no reducer to hydrate and no effect to sequence: the render always reads
 * one source of truth. When a real API replaces the store, only the update
 * bodies here change — this file and its consumers do not.
 *
 * `CartLine` is deliberately denormalised (name, price, image are copied onto
 * the line), which is what lets a restored cart render completely without
 * refetching every product. The server re-prices on every real mutation.
 */

interface CartContextValue {
  cart: Cart;
  lines: CartLine[];
  count: number;
  isEmpty: boolean;
  isFreeShippingQualified: boolean;
  add: (product: Product, variantId?: string, quantity?: number) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  applyCode: (code: string, promotion: Promotion | null) => { ok: boolean; reason?: string };
  removeDiscount: (discountId: string) => void;
  quantityOf: (productId: string, variantId?: string) => number;
  shippingMethod: ShippingMethod | null;
  setShippingMethod: (method: ShippingMethod | null) => void;
  maxQuantity: number;
  /** False until the persisted cart has been adopted after hydration. */
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'aube.cart.v1';
const METHOD_KEY = 'aube.shipping-method.v1';

interface PersistedCart {
  lines: CartLine[];
  discounts: Cart['discounts'];
}

export function CartProvider({
  children,
  settings,
  shippingMethods,
}: {
  children: ReactNode;
  settings: StoreSettings;
  shippingMethods: ShippingMethod[];
}) {
  const [persisted, setPersisted] = usePersistentValue<PersistedCart>(STORAGE_KEY, { lines: [], discounts: [] });
  const [methodId, setMethodId] = usePersistentValue<string | null>(METHOD_KEY, settings.defaultShippingMethodId);
  const hydrated = useHydrated();

  // The React Compiler memoises these; hand-written `useMemo` would only
  // duplicate its analysis and can drift out of sync with it.
  const shippingMethod =
    shippingMethods.find((method) => method.id === methodId) ?? shippingMethods[0] ?? null;

  // `cartService` takes and returns a whole `Cart`, so every update rebuilds
  // the shell around the stored lines and keeps only what is persisted.
  const base = (current: PersistedCart): Cart => ({
    ...emptyCart(settings),
    lines: current.lines,
    discounts: current.discounts,
  });

  const commit = (transform: (cart: Cart, current: PersistedCart) => Cart) => {
    setPersisted((current) => {
      const next = transform(base(current), current);
      return { lines: next.lines, discounts: next.discounts };
    });
  };

  const cart: Cart = {
    ...base(persisted),
    totals: calculateTotals(persisted.lines, persisted.discounts, shippingMethod, settings),
  };

  const add = (product: Product, variantId?: string, quantity = 1) => {
    commit((current) => cartService.add(current, product, variantId, quantity));
  };

  const setQuantity = (lineId: string, quantity: number) => {
    commit((current) => cartService.setQuantity(current, lineId, quantity));
  };

  const increment = (lineId: string) => {
    commit((current) => cartService.increment(current, lineId));
  };

  const decrement = (lineId: string) => {
    commit((current) => cartService.decrement(current, lineId));
  };

  const remove = (lineId: string) => {
    commit((current) => cartService.remove(current, lineId));
  };

  const clear = () => {
    setPersisted((current) => ({ lines: [], discounts: current.discounts }));
  };

  const removeDiscount = (discountId: string) => {
    commit((current) => cartService.removeDiscount(current, discountId));
  };

  const applyCode = (code: string, promotion: Promotion | null) => {
    const result = cartService.applyPromotion(cart, promotion, code, cart.lines);
    if (!result.ok) return { ok: false, reason: result.reason };

    setPersisted((current) => ({
      lines: current.lines,
      discounts: [...current.discounts.filter((item) => item.id !== result.discount.id), result.discount],
    }));
    return { ok: true };
  };

  const setShippingMethod = (method: ShippingMethod | null) => setMethodId(method?.id ?? null);

  const quantityOf = (productId: string, variantId?: string) =>
    cart.lines.find((item) => item.productId === productId && (!variantId || item.variantId === variantId))?.quantity ?? 0;

  const value: CartContextValue = {
    cart,
    lines: cart.lines,
    count: countLines(cart.lines),
    isEmpty: cart.lines.length === 0,
    isFreeShippingQualified: cart.totals.freeShippingProgress >= 1,
    add,
    setQuantity,
    increment,
    decrement,
    remove,
    clear,
    applyCode,
    removeDiscount,
    quantityOf,
    shippingMethod,
    setShippingMethod,
    maxQuantity: MAX_LINE_QUANTITY,
    ready: hydrated,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>.');
  return context;
}
