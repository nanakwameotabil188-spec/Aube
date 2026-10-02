'use client';

import { useEffect, useState } from 'react';
import type { Product, StoreSettings } from '@/types';
import { cn } from '@/lib/utils/cn';
import { routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { Button, LinkButton } from '@/components/ui/Button';
import { CartLineRow, OrderSummary } from '@/components/commerce/Cart';
import { ProductCard } from '@/components/commerce/ProductCard';
import { EmptyState } from '@/components/ui/states';
import { useCart } from '@/store/cart-context';
import { useToast } from '@/store/toast-context';
import { useWishlist } from '@/store/wishlist-context';
import { lookupPromotion, suggestionsForBag } from '@/lib/actions';

/**
 * Cart page.
 *
 * The full bag: the same `CartLineRow` the drawer uses, plus promo codes and
 * the order summary. This is the last page a shopper can edit the cart on, so
 * it is the one that surfaces the save-for-later escape hatch — the cart page
 * should never be a dead end.
 */

export function CartView({
  settings,
  recommendations,
}: {
  settings: StoreSettings;
  /** Fallback rail used until the bag-derived suggestions resolve. */
  recommendations: Product[];
}) {
  const { lines, isEmpty, cart, clear, removeDiscount, applyCode } = useCart();
  const { ids: wishlistIds } = useWishlist();
  const { notify } = useToast();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [paired, setPaired] = useState<Product[] | null>(null);

  const bagIds = lines.map((line) => line.productId).join(',');

  /*
   * Suggestions are resolved from the bag's actual contents rather than served
   * as a fixed "frequently bought" list, so the heading describes something
   * true. The fallback keeps the rail from disappearing during the round trip.
   */
  useEffect(() => {
    // An empty bag returns early above, so there is nothing to reset here.
    if (isEmpty) return;

    let active = true;
    void suggestionsForBag(lines.map((line) => line.productId)).then((products) => {
      if (active) setPaired(products);
    });

    return () => {
      active = false;
    };
    // `bagIds` is the stable identity of the bag; `lines` itself is a new
    // array on every render and would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagIds, isEmpty]);

  const suggestions = (paired ?? recommendations)
    .filter((product) => !lines.some((line) => line.productId === product.id) && !wishlistIds.includes(product.id))
    .slice(0, 4);

  const apply = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setCodeError(null);
    // The lookup runs on the server: a real backend validates the code there,
    // and the browser must not hold the promotion table.
    const promotion = await lookupPromotion(trimmed);
    const result = applyCode(trimmed, promotion);

    if (result.ok) {
      setCode('');
      notify(`${trimmed.toUpperCase()} applied`, { tone: 'success' });
    } else {
      setCodeError(result.reason ?? 'That code is not valid.');
    }
  };

  if (isEmpty) {
    return (
      <EmptyState
        icon="cart"
        title="Your bag is empty"
        body="Nothing here yet. The Essentials is where most people start."
        action={{ label: 'Shop all products', href: routes.shop }}
        secondaryAction={{ label: 'Shop the essentials', href: routes.collection('the-essentials') }}
        className="py-24"
      />
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <section aria-label="Bag contents">
        <div className="mb-2 flex items-baseline justify-between border-b border-ink pb-3">
          <h2 className="text-sm uppercase tracking-[0.14em] text-muted">
            {lines.length} {lines.length === 1 ? 'item' : 'items'}
          </h2>
          <button
            type="button"
            onClick={() => {
              clear();
              notify('Bag emptied');
            }}
            className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-danger"
          >
            Empty bag
          </button>
        </div>

        <ul className="divide-y divide-line">
          {lines.map((line) => (
            <CartLineRow key={line.id} line={line} />
          ))}
        </ul>

        {cart.discounts.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2">
            {cart.discounts.map((discount) => (
              <li
                key={discount.id}
                className="flex items-center justify-between gap-3 rounded-xs bg-sand px-3.5 py-2.5 text-sm"
              >
                <span className="text-ink">
                  <span className="font-medium">{discount.code}</span> · {discount.label}
                </span>
                <button
                  type="button"
                  onClick={() => removeDiscount(discount.id)}
                  className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink"
                >
                  Remove
                  <Icon name="close" size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={apply} className="mt-8 flex max-w-sm items-start gap-2">
          <div className="flex-1">
            <label htmlFor="promo" className="sr-only">
              Discount code
            </label>
            <input
              id="promo"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Discount code"
              autoComplete="off"
              aria-invalid={Boolean(codeError)}
              aria-describedby={codeError ? 'promo-error' : undefined}
              className="h-11 w-full rounded-xs border border-line bg-shell px-3 text-sm uppercase text-ink placeholder:normal-case placeholder:text-muted-light focus:border-ink focus:outline-none"
            />
            {codeError && (
              <p id="promo-error" role="alert" className="mt-1.5 text-xs text-danger">
                {codeError}
              </p>
            )}
          </div>
          <Button type="submit" variant="secondary" disabled={!code.trim()}>
            Apply
          </Button>
        </form>
      </section>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <OrderSummary
          lines={lines}
          totals={cart.totals}
          settings={settings}
          checkoutHref={routes.checkout}
        />
      </aside>

      {suggestions.length > 0 && (
        <section className="lg:col-span-2">
          <h2 className={cn('mb-6 font-display text-2xl text-ink')}>Pairs well with your bag</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {suggestions.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} showQuickAdd />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="lg:col-span-2">
        <LinkButton href={routes.shop} variant="text">
          Continue shopping
        </LinkButton>
      </div>
    </div>
  );
}
