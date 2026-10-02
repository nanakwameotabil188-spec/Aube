import type { AppliedDiscount, Cart, CartLine, Product, Promotion, ShippingMethod, StoreSettings } from '@/types';
import { money } from '@/lib/utils/format';
import { createLine, findLine } from './pricing';

/**
 * Cart service.
 *
 * Every mutation is expressed as a pure `Cart -> Cart` transform so the same
 * logic can run client-side now and server-side later. A backend
 * implementation returns the re-priced cart from each call and the reducer
 * simply adopts it.
 */

export const cartService = {
  add(cart: Cart, product: Product, variantId: string | undefined, quantity: number): Cart {
    const line = createLine(product, variantId, quantity);
    const existing = findLine(cart.lines, product.id, line.variantId);

    const lines = existing
      ? cart.lines.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, item.maxQuantity) }
            : item,
        )
      : [...cart.lines, line];

    return { ...cart, lines, updatedAt: new Date().toISOString() };
  },

  setQuantity(cart: Cart, lineId: string, quantity: number): Cart {
    if (quantity <= 0) return cartService.remove(cart, lineId);
    const lines = cart.lines.map((line) =>
      line.id === lineId ? { ...line, quantity: Math.min(quantity, line.maxQuantity) } : line,
    );
    return { ...cart, lines, updatedAt: new Date().toISOString() };
  },

  increment(cart: Cart, lineId: string): Cart {
    const line = cart.lines.find((item) => item.id === lineId);
    if (!line) return cart;
    return cartService.setQuantity(cart, lineId, line.quantity + 1);
  },

  decrement(cart: Cart, lineId: string): Cart {
    const line = cart.lines.find((item) => item.id === lineId);
    if (!line) return cart;
    return cartService.setQuantity(cart, lineId, line.quantity - 1);
  },

  remove(cart: Cart, lineId: string): Cart {
    return { ...cart, lines: cart.lines.filter((line) => line.id !== lineId), updatedAt: new Date().toISOString() };
  },

  clear(cart: Cart): Cart {
    return { ...cart, lines: [], discounts: [], updatedAt: new Date().toISOString() };
  },

  /** Move a line to the wishlist ("save for later"). */
  moveToWishlist(cart: Cart, lineId: string): { cart: Cart; productId: string } | null {
    const line = cart.lines.find((item) => item.id === lineId);
    if (!line) return null;
    return { cart: cartService.remove(cart, lineId), productId: line.productId };
  },

  /**
   * Validate and price a promotion code against the current cart.
   * Returns a discriminated result so the UI can distinguish "invalid code"
   * from "valid, but not applicable to this cart".
   */
  applyPromotion(
    cart: Cart,
    promotion: Promotion | null,
    code: string,
    lines: readonly CartLine[],
  ): { ok: true; discount: AppliedDiscount } | { ok: false; reason: string } {
    if (!promotion) return { ok: false, reason: `The code ${code.trim().toUpperCase()} is not valid.` };

    if (promotion.endsAt && Date.parse(promotion.endsAt) < Date.now()) {
      return { ok: false, reason: `The code ${code.trim().toUpperCase()} has expired.` };
    }
    if (promotion.startsAt && Date.parse(promotion.startsAt) > Date.now()) {
      return { ok: false, reason: `The code ${code.trim().toUpperCase()} is not active yet.` };
    }

    const scope = promotion.appliesTo;
    const hasScope = scope.productIds?.length || scope.categoryIds?.length || scope.collectionIds?.length;

    if (hasScope) {
      const eligible = lines.filter((line) => {
        if (scope.productIds?.length) return scope.productIds.includes(line.productId);
        return true;
      });
      if (eligible.length === 0) {
        return { ok: false, reason: 'That code applies to a different part of the range.' };
      }
    }

    const currency = cart.currency;
    const discount: AppliedDiscount = {
      id: `dsc-${promotion.id}`,
      code: promotion.code ?? promotion.name,
      label: promotion.description,
      type: promotion.type,
      value: promotion.value ?? 0,
      amount:
        promotion.type === 'percentage'
          ? money(Math.round((cart.totals.subtotal.amount * (promotion.value ?? 0)) / 100), currency)
          : promotion.type === 'fixed'
            ? money((promotion.value ?? 0) * 100, currency)
            : money(0, currency),
    };

    return { ok: true, discount };
  },

  removeDiscount(cart: Cart, discountId: string): Cart {
    return { ...cart, discounts: cart.discounts.filter((item) => item.id !== discountId) };
  },

  /** Select the cheapest available method, used as the cart-page default. */
  defaultShippingMethod(methods: readonly ShippingMethod[]): ShippingMethod | null {
    return methods[0] ?? null;
  },
};
