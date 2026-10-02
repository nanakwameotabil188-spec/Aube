import type { AppliedDiscount, Cart, CartLine, CartTotals, Money, Product, ShippingMethod, StoreSettings } from '@/types';
import { money } from '@/lib/utils/format';

/**
 * Cart pricing.
 *
 * Pure functions, isomorphic, and deliberately isolated: a real deployment
 * re-prices on the server and returns authoritative totals, so the client
 * calculations here are a preview rather than the source of truth.
 */

export const MAX_LINE_QUANTITY = 10;

export function lineSubtotal(line: CartLine): Money {
  return { amount: line.unitPrice.amount * line.quantity, currency: line.unitPrice.currency };
}

export function cartSubtotal(lines: readonly CartLine[]): Money {
  const currency = lines[0]?.unitPrice.currency ?? 'USD';
  return {
    amount: lines.reduce((total, line) => total + lineSubtotal(line).amount, 0),
    currency,
  };
}

export function discountTotal(discounts: readonly AppliedDiscount[]): Money {
  const currency = discounts[0]?.amount.currency ?? 'USD';
  return {
    amount: discounts
      .filter((discount) => discount.type !== 'free_shipping')
      .reduce((total, discount) => total + discount.amount.amount, 0),
    currency,
  };
}

export function hasFreeShipping(discounts: readonly AppliedDiscount[]): boolean {
  return discounts.some((discount) => discount.type === 'free_shipping');
}

export function countLines(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/**
 * Build the shipping cost for a selection of lines.
 * Free above the store threshold, unless the cart is already qualified.
 */
export function calculateShipping(
  lines: readonly CartLine[],
  method: ShippingMethod | null,
  settings: StoreSettings,
  discounts: readonly AppliedDiscount[] = [],
): Money {
  const currency = lines[0]?.unitPrice.currency ?? settings.currency;
  if (lines.length === 0) return money(0, currency);

  const subtotal = cartSubtotal(lines).amount;
  const qualifiesFree = method?.freeAbove ? subtotal >= method.freeAbove.amount : subtotal >= settings.freeShippingThreshold.amount;
  if (qualifiesFree || hasFreeShipping(discounts)) return money(0, currency);

  return { amount: method?.price.amount ?? 0, currency };
}

export function freeShippingProgress(
  lines: readonly CartLine[],
  settings: StoreSettings,
): { remaining: Money; progress: number } {
  const currency = lines[0]?.unitPrice.currency ?? settings.currency;
  const threshold = settings.freeShippingThreshold.amount;
  const subtotal = cartSubtotal(lines).amount;
  if (threshold <= 0) return { remaining: money(0, currency), progress: 1 };
  if (subtotal >= threshold) return { remaining: money(0, currency), progress: 1 };
  return {
    remaining: { amount: threshold - subtotal, currency },
    progress: subtotal / threshold,
  };
}

export function calculateTotals(
  lines: readonly CartLine[],
  discounts: readonly AppliedDiscount[],
  method: ShippingMethod | null,
  settings: StoreSettings,
): CartTotals {
  const currency = lines[0]?.unitPrice.currency ?? settings.currency;
  const subtotal = cartSubtotal(lines);
  const discountsTotal = discountTotal(discounts);
  const shipping = calculateShipping(lines, method, settings, discounts);
  const total = Math.max(0, subtotal.amount - discountsTotal.amount + shipping.amount);
  const { progress } = freeShippingProgress(lines, settings);

  return {
    subtotal,
    discountTotal: discountsTotal,
    shipping,
    // Tax is calculated at checkout against the delivery address.
    tax: money(0, currency),
    total: { amount: total, currency },
    freeShippingProgress: progress,
    freeShippingThreshold: settings.freeShippingThreshold,
  };
}

/* ------------------------------------------------------------------ */
/* Line construction                                                   */
/* ------------------------------------------------------------------ */

export function createLine(product: Product, variantId: string | undefined, quantity: number): CartLine {
  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  if (!variant) throw new Error(`Product ${product.id} has no sellable variant.`);

  return {
    id: `${product.id}:${variant.id}`,
    productId: product.id,
    variantId: variant.id,
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle,
    size: variant.size,
    unitPrice: variant.compareAtPrice ?? variant.price,
    compareAtUnitPrice: variant.compareAtPrice ? variant.price : undefined,
    quantity: Math.min(Math.max(1, quantity), Math.min(MAX_LINE_QUANTITY, variant.stockQuantity || MAX_LINE_QUANTITY)),
    maxQuantity: Math.min(MAX_LINE_QUANTITY, variant.stockQuantity || MAX_LINE_QUANTITY),
    image: product.thumbnail,
    unavailableReason: product.availableForSale ? undefined : 'This product is currently unavailable.',
    addedAt: new Date().toISOString(),
  };
}

export function findLine(lines: readonly CartLine[], productId: string, variantId: string): CartLine | undefined {
  return lines.find((line) => line.productId === productId && line.variantId === variantId);
}

export function emptyCart(settings: StoreSettings): Cart {
  return {
    id: 'cart-local',
    lines: [],
    discounts: [],
    totals: calculateTotals([], [], null, settings),
    currency: settings.currency,
    updatedAt: new Date().toISOString(),
  };
}
