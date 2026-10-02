'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback } from 'react';
import type { CartLine as CartLineType, CartTotals, Product, StoreSettings } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/format';
import { routes } from '@/lib/routes';
import { freeShippingProgress } from '@/lib/commerce/pricing';
import { Icon } from '@/components/ui/Icon';
import { LinkButton } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/overlays';
import { useCart } from '@/store/cart-context';
import { useWishlist } from '@/store/wishlist-context';
import { useToast } from '@/store/toast-context';
import { useUI } from '@/store/ui-context';

/* ------------------------------------------------------------------ */
/* Cart line                                                           */
/* ------------------------------------------------------------------ */

export function CartLineRow({ line, compact = false }: { line: CartLineType; compact?: boolean }) {
  const { setQuantity, remove, increment, decrement } = useCart();
  const { add: addToWishlist } = useWishlist();
  const { notify } = useToast();
  const { open } = useUI();

  const unavailable = Boolean(line.unavailableReason);

  // Depend on the primitives the callback reads rather than the line object,
  // which is a fresh reference on every cart recalculation.
  const { productId, id: lineId, name: lineName } = line;

  const saveForLater = useCallback(() => {
    addToWishlist(productId);
    remove(lineId);
    notify(`${lineName} saved for later`, { tone: 'success' });
  }, [addToWishlist, productId, lineId, lineName, notify, remove]);

  return (
    <li className={cn('flex gap-4 py-5', compact && 'py-4')}>
      <Link
        href={routes.product(line.slug)}
        className={cn('relative shrink-0 overflow-hidden rounded-xs bg-sand', compact ? 'w-20' : 'w-24 sm:w-28')}
      >
        <span className={cn('block', compact ? 'aspect-square' : 'aspect-4/5')} />
        <Image
          src={line.image.url}
          alt={line.image.alt}
          fill
          sizes={compact ? '80px' : '112px'}
          className="object-cover"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg leading-snug text-ink">
              <Link href={routes.product(line.slug)} className="transition-colors hover:text-moss">
                {line.name}
              </Link>
            </h3>
            <p className="mt-0.5 text-xs text-muted">{line.size}</p>
          </div>
          <p className="shrink-0 text-sm font-medium tabular-nums text-ink">
            {formatMoney({ amount: line.unitPrice.amount * line.quantity, currency: line.unitPrice.currency })}
          </p>
        </div>

        {unavailable && (
          <p className="text-xs font-medium text-danger">{line.unavailableReason}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1.5">
          <QuantityStepper
            value={line.quantity}
            onChange={(next) => setQuantity(line.id, next)}
            min={1}
            max={line.maxQuantity}
            size={compact ? 'sm' : 'md'}
            disabled={unavailable}
            label={`Quantity for ${line.name}`}
          />

          <div className="flex items-center gap-1">
            {!compact && (
              <>
                <LineAction onClick={saveForLater}>Save for later</LineAction>
                <LineAction onClick={increment.bind(null, line.id)} disabled={unavailable} label={`Increase quantity of ${line.name}`}>
                  <Icon name="plus" size={13} aria-hidden />
                </LineAction>
                <LineAction
                  onClick={decrement.bind(null, line.id)}
                  disabled={unavailable || line.quantity <= 1}
                  label={`Decrease quantity of ${line.name}`}
                >
                  <Icon name="minus" size={13} aria-hidden />
                </LineAction>
              </>
            )}
            <LineAction
              onClick={() => {
                remove(line.id);
                notify(`${line.name} removed from your bag`);
                if (compact) open('cart');
              }}
              label={`Remove ${line.name} from bag`}
            >
              <Icon name="trash" size={13} aria-hidden />
            </LineAction>
          </div>
        </div>
      </div>
    </li>
  );
}

function LineAction({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-xs px-2 text-xs text-muted transition-colors duration-200',
        'hover:bg-sand hover:text-ink disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Free shipping meter                                                */
/* ------------------------------------------------------------------ */

export function FreeShippingMeter({ lines, settings }: { lines: CartLineType[]; settings: StoreSettings }) {
  const { remaining, progress } = freeShippingProgress(lines, settings);
  const qualified = remaining.amount === 0 && lines.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs leading-relaxed text-muted" aria-live="polite">
        {qualified ? (
          <>Your order qualifies for complimentary shipping.</>
        ) : (
          <>
            You are <span className="font-medium text-ink">{formatMoney(remaining)}</span> away from complimentary
            shipping.
          </>
        )}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Progress toward free shipping"
        className="h-1 overflow-hidden rounded-full bg-oat"
      >
        <div
          className="h-full rounded-full bg-moss transition-[width] duration-700 ease-[var(--ease-soft)]"
          style={{ width: `${Math.max(3, progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Order summary                                                       */
/* ------------------------------------------------------------------ */

export function OrderSummary({
  lines,
  totals,
  settings,
  promoSlot,
  checkoutHref = routes.checkout,
  showShipping = true,
}: {
  lines: CartLineType[];
  totals: CartTotals;
  settings: StoreSettings;
  promoSlot?: React.ReactNode;
  checkoutHref?: string;
  showShipping?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-2xl text-ink">Order summary</h2>

      {lines.length > 0 && <FreeShippingMeter lines={lines} settings={settings} />}

      <dl className="flex flex-col gap-2.5 border-t border-line pt-5 text-sm">
        <SummaryRow label="Subtotal" value={formatMoney(totals.subtotal)} />
        {totals.discountTotal.amount > 0 && (
          <SummaryRow label="Discounts" value={`−${formatMoney(totals.discountTotal)}`} tone="success" />
        )}
        {showShipping && (
          <SummaryRow
            label="Shipping"
            value={totals.shipping.amount === 0 ? 'Complimentary' : formatMoney(totals.shipping)}
            tone={totals.shipping.amount === 0 ? 'success' : undefined}
          />
        )}
        <SummaryRow label="Tax" value="Calculated at checkout" muted />
      </dl>

      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-sm font-medium text-ink">Total</span>
        <span className="font-display text-2xl tabular-nums text-ink">{formatMoney(totals.total)}</span>
      </div>

      <p className="-mt-2 text-xs text-muted">{settings.taxNote}</p>

      {promoSlot}

      <LinkButton href={checkoutHref} fullWidth size="lg">
        Checkout
      </LinkButton>

      <ul className="flex flex-col gap-1.5 text-xs text-muted">
        {[
          'Sixty-day returns, opened or unopened',
          'Free returns on every order, we pay the label',
          'Secure checkout — card, wallet or instalments',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon name="check" size={13} className="mt-0.5 shrink-0 text-success" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: 'success';
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          tone === 'success' && 'text-success',
          muted && 'text-xs text-muted',
          !tone && !muted && 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Frequently bought together                                          */
/* ------------------------------------------------------------------ */

export function FrequentlyBoughtTogether({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {products.map((product) => (
        <div key={product.id} className="flex flex-col gap-2">
          <Link href={routes.product(product.slug)} className="block">
            <ProductMiniThumb product={product} />
          </Link>
          <Link
            href={routes.product(product.slug)}
            className="text-sm font-medium leading-snug text-ink transition-colors hover:text-moss"
          >
            {product.name}
          </Link>
          <p className="text-sm tabular-nums text-muted">{formatMoney(product.price)}</p>
        </div>
      ))}
    </div>
  );
}

function ProductMiniThumb({ product }: { product: Product }) {
  return (
    <div className="relative aspect-4/5 overflow-hidden rounded-xs bg-sand">
      <Image src={product.thumbnail.url} alt={product.thumbnail.alt} fill sizes="(min-width: 640px) 30vw, 90vw" className="object-cover" />
    </div>
  );
}
