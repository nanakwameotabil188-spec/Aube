'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { Product } from '@/types';
import { cn } from '@/lib/utils/cn';
import { routes } from '@/lib/routes';
import { stockLevel } from '@/lib/utils/catalog';
import { Badge, Price, Rating, StockPill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/store/toast-context';
import { useCart } from '@/store/cart-context';
import { useWishlist } from '@/store/wishlist-context';
import { useUI } from '@/store/ui-context';

/**
 * Product card.
 *
 * Purely presentational — it receives a `Product` and nothing else. The
 * second gallery image cross-fades on hover, the wishlist button is
 * optimistic, and quick-add uses the default variant so the common case
 * never requires opening the product page.
 */

export interface ProductCardProps {
  product: Product;
  /** Editorial cards show larger type and no price. */
  variant?: 'default' | 'compact' | 'editorial';
  priority?: boolean;
  className?: string;
  showQuickAdd?: boolean;
}

export function ProductCard({
  product,
  variant = 'default',
  priority = false,
  className,
  showQuickAdd = true,
}: ProductCardProps) {
  const secondary = product.images[1];
  const level = stockLevel(product);
  const soldOut = level === 'out-of-stock' || level === 'unavailable';
  const isEditorial = variant === 'editorial';

  return (
    <article
      className={cn(
        'group/card relative flex flex-col',
        isEditorial ? 'gap-3' : 'gap-3.5',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-xs bg-sand">
        {/* The image is a secondary link target: the product name below is the
            accessible name, so this is hidden from assistive technology. The
            wishlist and quick-add controls are absolutely positioned siblings
            that sit above it, so they keep their own clicks. */}
        <Link
          href={routes.product(product.slug)}
          tabIndex={-1}
          aria-hidden
          className="block focus:outline-none"
        >
          <div className="relative aspect-4/5">
            <Image
              src={product.thumbnail.url}
              alt={product.thumbnail.alt}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 46vw"
              className={cn(
                'object-cover transition-[opacity,transform] duration-700 ease-[var(--ease-soft)]',
                secondary && 'group-hover/card:opacity-0',
                'group-hover/card:scale-[1.03]',
              )}
            />
            {secondary && (
              <Image
                src={secondary.url}
                alt=""
                aria-hidden
                fill
                sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 46vw"
                className="object-cover opacity-0 transition-opacity duration-700 ease-[var(--ease-soft)] group-hover/card:opacity-100"
              />
            )}
            {soldOut && (
              <div className="absolute inset-0 grid place-items-center bg-porcelain/70">
                <span className="rounded-xs border border-line bg-shell px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  Sold out
                </span>
              </div>
            )}
          </div>
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-col items-start gap-1.5">
            {product.badges.slice(0, 2).map((badge) => (
              <Badge key={badge.id} tone={badge.tone}>
                {badge.label}
              </Badge>
            ))}
          </div>
          <WishlistButton product={product} />
        </div>

        {showQuickAdd && !soldOut && variant === 'default' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full p-3 transition-transform duration-400 ease-[var(--ease-soft)] group-hover/card:translate-y-0 group-focus-within/card:translate-y-0 max-md:hidden">
            <QuickAdd product={product} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow-tight text-muted">{product.brand}</p>
          {level === 'low' && <StockPill level={level} />}
        </div>

        <h3 className={cn('font-display leading-snug text-ink', isEditorial ? 'text-2xl' : 'text-lg')}>
          <Link
            href={routes.product(product.slug)}
            className="transition-colors duration-200 hover:text-moss focus:outline-none focus-visible:underline"
          >
            {product.name}
          </Link>
        </h3>

        {!isEditorial && <p className="text-sm leading-relaxed text-muted">{product.subtitle}</p>}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-1.5">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} size={isEditorial ? 'lg' : 'md'} />
          {/* Omitted entirely when unrated. Repeating "No reviews yet" on every
              card would be noise, and printing a 0.0 would be a false claim. */}
          {product.rating.count > 0 && product.rating.average != null && (
            <Rating value={product.rating.average} count={product.rating.count} size={12} />
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Wishlist button                                                     */
/* ------------------------------------------------------------------ */

export function WishlistButton({ product, className }: { product: Product; className?: string }) {
  const { has, toggle } = useWishlist();
  const { notify } = useToast();
  const active = has(product.id);

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      toggle(product.id);
      notify(active ? `Removed ${product.name} from your wishlist` : `Saved ${product.name} to your wishlist`, {
        tone: active ? 'default' : 'success',
      });
    },
    [active, notify, product.id, product.name, toggle],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      className={cn(
        'pointer-events-auto grid size-9 place-items-center rounded-full border border-line/60 bg-shell/90 backdrop-blur-sm',
        'transition-[color,background-color,transform] duration-300 ease-[var(--ease-soft)] hover:scale-105 active:scale-95',
        active ? 'text-clay' : 'text-ink',
        className,
      )}
    >
      <Icon name="heart" size={16} filled={active} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Quick add                                                           */
/* ------------------------------------------------------------------ */

export function QuickAdd({ product, className }: { product: Product; className?: string }) {
  const { add } = useCart();
  const { open } = useUI();
  const { notify } = useToast();
  const [added, setAdded] = useState(false);

  const defaultVariant = product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
  const singleVariant = product.variants.length <= 1;

  const onClick = useCallback(() => {
    if (!defaultVariant) return;
    add(product, defaultVariant.id, 1);
    setAdded(true);
    notify(`${product.name} added to your bag`, {
      tone: 'success',
      action: { label: 'View bag', onClick: () => open('cart') },
      duration: 3200,
    });
    window.setTimeout(() => setAdded(false), 1800);
  }, [add, defaultVariant, notify, open, product]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'pointer-events-auto flex h-10 w-full items-center justify-center gap-2 rounded-xs text-xs font-medium uppercase tracking-[0.12em]',
        'bg-shell/95 text-ink backdrop-blur-sm transition-colors duration-300 hover:bg-ink hover:text-shell',
        className,
      )}
    >
      {added ? (
        <>
          <Icon name="check" size={14} aria-hidden />
          Added
        </>
      ) : singleVariant ? (
        'Quick add'
      ) : (
        <>
          Add
          <span className="opacity-50">·</span>
          {product.variants.length} sizes
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Grids and rails                                                     */
/* ------------------------------------------------------------------ */

export function ProductGrid({
  products,
  className,
  priorityCount = 4,
}: {
  products: Product[];
  className?: string;
  priorityCount?: number;
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < priorityCount} />
      ))}
    </div>
  );
}

/** Horizontally scrollable on small screens, four-up from `lg`. */
export function ProductRail({ products, className }: { products: Product[]; className?: string }) {
  return (
    <div className={cn('rail', className)}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 2} />
      ))}
    </div>
  );
}
