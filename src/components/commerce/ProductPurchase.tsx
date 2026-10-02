'use client';

import { useState } from 'react';
import type {
  CurrencyCode,
  Money,
  Product,
  ShippingMethod,
  SkinConcern,
  SkinType,
  StoreSettings,
} from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/format';
import { routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Price, Rating, StockPill } from '@/components/ui/primitives';
import { QuantityStepper } from '@/components/ui/overlays';
import { useCart } from '@/store/cart-context';
import { useRecentlyViewed, useWishlist } from '@/store/wishlist-context';
import { useToast } from '@/store/toast-context';
import { useUI } from '@/store/ui-context';

/**
 * Product purchase panel.
 *
 * Owns the only genuinely interactive part of the product page: which variant
 * is selected, how many, and the two buttons. Everything descriptive is passed
 * in already resolved so the cart never has to fetch a product to add one.
 *
 * The free-shipping threshold is the store's most reliable conversion lever, so
 * it is shown as a live progress bar against the current cart rather than as
 * static copy.
 */

export function ProductPurchase({
  product,
  skinTypes,
  concerns,
  settings,
  shippingMethods,
  className,
}: {
  product: Product;
  skinTypes: SkinType[];
  concerns: SkinConcern[];
  settings: StoreSettings;
  shippingMethods: ShippingMethod[];
  className?: string;
}) {
  const { add, count, isFreeShippingQualified, cart, maxQuantity } = useCart();
  const { has, toggle } = useWishlist();
  const { record } = useRecentlyViewed();
  const { notify } = useToast();
  const { open } = useUI();

  const sorted = [...product.variants].sort((a, b) => a.position - b.position);
  const [variantId, setVariantId] = useState(() => sorted.find((v) => v.isDefault)?.id ?? sorted[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);

  const variant = sorted.find((item) => item.id === variantId) ?? sorted[0] ?? null;
  const price = variant?.price ?? product.price;
  const compareAt = variant?.compareAtPrice ?? product.compareAtPrice;
  const inStock = (variant?.stockQuantity ?? 0) > 0;
  const low = (variant?.stockQuantity ?? 0) <= product.lowStockThreshold;
  const wished = has(product.id);

  const onAdd = () => {
    if (!variant || !inStock) return;
    add(product, variant.id, quantity);
    record(product.id);
    notify(`${product.name} (${variant.size}) added to your bag`, {
      tone: 'success',
      action: { label: 'View bag', onClick: () => open('cart') },
    });
  };

  // Both sides of the threshold are `Money`; the bar only needs the gap.
  const threshold = settings.freeShippingThreshold;
  const remaining = Math.max(0, threshold.amount - cart.totals.subtotal.amount);
  const currency = price.currency;

  return (
    <div className={cn('flex flex-col gap-7', className)}>
      <div className="flex flex-col gap-3">
        {product.badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.badges.map((badge) => (
              <span
                key={badge.id}
                className={cn(
                  'rounded-full px-2.5 py-1 text-2xs font-medium uppercase tracking-[0.12em]',
                  BADGE_TONE[badge.tone],
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}

        <h1 className="font-display text-3xl leading-[1.08] text-ink sm:text-4xl">{product.name}</h1>
        <p className="text-md text-muted">{product.subtitle}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Price price={price} compareAtPrice={compareAt} size="lg" />
          {product.rating.count > 0 && (
            <a href="#reviews" className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink">
              <Rating value={product.rating.average} size={14} showCount={false} />
              <span className="underline underline-offset-2">{product.rating.count} reviews</span>
            </a>
          )}
        </div>
      </div>

      <p className="text-md leading-relaxed text-ink-soft">{product.shortDescription}</p>

      {product.highlights.length > 0 && (
        <ul className="flex flex-col gap-2 border-y border-line py-5">
          {product.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2.5 text-sm text-ink">
              <Icon name="check" size={15} aria-hidden className="mt-0.5 shrink-0 text-moss" />
              {highlight}
            </li>
          ))}
        </ul>
      )}

      {sorted.length > 1 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="eyebrow-tight mb-1 text-muted">Size</legend>
          <div className="flex flex-wrap gap-2">
            {sorted.map((item) => {
              const soldOut = item.stockQuantity === 0;
              const selected = item.id === variantId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setVariantId(item.id);
                    setQuantity(1);
                  }}
                  aria-pressed={selected}
                  className={cn(
                    'min-w-20 rounded-xs border px-3.5 py-2.5 text-sm transition-colors',
                    selected ? 'border-ink bg-ink text-shell' : 'border-line bg-shell text-ink hover:border-ink',
                    soldOut && 'cursor-not-allowed opacity-40 hover:border-line',
                  )}
                >
                  {item.size}
                  {soldOut && <span className="sr-only"> (sold out)</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-3">
        <StockPill level={!inStock ? 'out-of-stock' : low ? 'low' : 'in-stock'} />
        {product.dispatchEstimate && <p className="text-xs text-muted">{product.dispatchEstimate}</p>}
      </div>

      <div className="flex flex-wrap items-stretch gap-3">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          max={Math.min(maxQuantity, variant?.stockQuantity ?? maxQuantity)}
          disabled={!inStock}
        />
        <Button
          type="button"
          onClick={onAdd}
          disabled={!inStock}
          className="flex-1"
          size="lg"
          data-testid="add-to-bag"
        >
          {inStock ? (count > 0 ? 'Add to bag' : 'Add to bag') : 'Sold out'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            toggle(product.id);
            notify(wished ? `${product.name} removed from saved` : `${product.name} saved`, {
              tone: wished ? 'default' : 'success',
            });
          }}
          aria-pressed={wished}
        >
          <Icon name="heart" size={15} aria-hidden />
          {wished ? 'Saved' : 'Save for later'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => open('cart')}>
          View bag{count > 0 ? ` (${count})` : ''}
        </Button>
      </div>

      {!isFreeShippingQualified && remaining > 0 && (
        <div className="flex flex-col gap-2 rounded-xs bg-sand px-4 py-3">
          <p className="text-sm text-ink">
            {formatMoney({ amount: remaining, currency })} away from free shipping
          </p>          <div
            className="h-1 w-full overflow-hidden rounded-full bg-shell"
            role="progressbar"
            aria-valuenow={Math.round(cart.totals.freeShippingProgress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress towards free shipping"
          >
            <div
              className="h-full rounded-full bg-moss transition-[width] duration-500 ease-[var(--ease-soft)]"
              style={{ width: `${Math.min(100, cart.totals.freeShippingProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      <dl className="grid gap-3 border-t border-line pt-5 text-sm">
        <DeliveryRow methods={shippingMethods} threshold={threshold} currency={currency} />
        {(skinTypes.length > 0 || concerns.length > 0) && (
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-muted">Suits</dt>
            <dd className="text-ink">
              {[...skinTypes.map((item) => item.name), ...concerns.map((item) => item.name)].join(', ')}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

const BADGE_TONE: Record<string, string> = {
  neutral: 'bg-sand text-ink',
  moss: 'bg-moss text-shell',
  clay: 'bg-clay/30 text-ink',
  danger: 'bg-danger/12 text-danger',
  ink: 'bg-ink text-shell',
};

function DeliveryRow({
  methods,
  threshold,
  currency,
}: {
  methods: ShippingMethod[];
  threshold: Money;
  currency: CurrencyCode;
}) {
  const cheapest = methods.reduce<ShippingMethod | null>(
    (best, method) => (!best || method.price.amount < best.price.amount ? method : best),
    null,
  );

  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted">Delivery</dt>
      <dd className="text-ink">
        {cheapest ? (
          <>
            {cheapest.price.amount === 0
              ? `Free${threshold.amount > 0 ? ` over ${formatMoney(threshold)}` : ''}`
              : `From ${formatMoney(cheapest.price)}`}
          </>
        ) : (
          'Calculated at checkout'
        )}
      </dd>
    </div>
  );
}
