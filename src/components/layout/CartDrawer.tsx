'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Product, StoreSettings } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/format';
import { routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/overlays';
import { LinkButton } from '@/components/ui/Button';
import { CartLineRow, FreeShippingMeter } from '@/components/commerce/Cart';
import { useCart } from '@/store/cart-context';
import { useUI } from '@/store/ui-context';
import { useWishlist } from '@/store/wishlist-context';

/**
 * Cart drawer.
 *
 * An at-a-glance view of the bag that keeps the shopper in place. Anything
 * that changes the cart routes to the full cart or checkout page rather than
 * being editable here beyond quantity and removal.
 */
export function CartDrawer({
  settings,
  recommendations = [],
}: {
  settings: StoreSettings;
  recommendations?: Product[];
}) {
  const { isOpen, close } = useUI();
  const { lines, count, isEmpty, cart, add } = useCart();
  const { ids: wishlistIds } = useWishlist();
  const router = useRouter();

  const open = isOpen('cart');

  // Recommendations exclude anything already in the bag or the wishlist.
  const suggestions = recommendations
    .filter((product) => !lines.some((line) => line.productId === product.id) && !wishlistIds.includes(product.id))
    .slice(0, 3);

  return (
    <Drawer
      open={open}
      onClose={close}
      title={isEmpty ? 'Your bag' : `Your bag (${count})`}
      label="Shopping bag"
      widthClass="w-full max-w-md"
      footer={
        isEmpty ? (
          <LinkButton href={routes.shop} fullWidth size="lg" onClick={close}>
            Browse all products
          </LinkButton>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-medium tabular-nums text-ink">{formatMoney(cart.totals.subtotal)}</span>
            </div>
            <p className="-mt-1 text-xs text-muted">{settings.taxNote}</p>
            <LinkButton
              href={routes.checkout}
              size="lg"
              fullWidth
              onClick={() => {
                close();
                router.push(routes.checkout);
              }}
            >
              Checkout
            </LinkButton>
            <button
              type="button"
              onClick={() => {
                close();
                router.push(routes.cart);
              }}
              className="text-center text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
            >
              View full bag
            </button>
          </div>
        )
      }
    >
      {isEmpty ? (
        <div className="flex flex-col items-center gap-5 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-sand text-muted">
            <Icon name="cart" size={24} aria-hidden />
          </span>
          <div className="max-w-xs">
            <p className="font-display text-2xl text-ink">Your bag is empty</p>
            <p className="mt-2 text-base leading-relaxed text-muted">
              Nothing here yet. The Essentials is where most people start, or browse by skin concern if you know what your
              skin is doing.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <LinkButton href="/collection/the-essentials" onClick={close}>
              Shop the essentials
            </LinkButton>
            <LinkButton href={routes.shop} variant="text" onClick={close}>
              Browse all products
            </LinkButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <FreeShippingMeter lines={lines} settings={settings} />

          <ul className="divide-y divide-line border-t border-line">
            {lines.map((line) => (
              <CartLineRow key={line.id} line={line} compact />
            ))}
          </ul>

          {suggestions.length > 0 && (
            <div className="border-t border-line pt-5">
              <p className="eyebrow mb-3">Pairs well with your bag</p>
              <ul className="flex flex-col gap-3">
                {suggestions.map((product) => (
                  <li key={product.id} className="flex items-center gap-3.5">
                    <Link
                      href={routes.product(product.slug)}
                      onClick={close}
                      className="relative size-14 shrink-0 overflow-hidden rounded-xs bg-sand"
                    >
                      <Image
                        src={product.thumbnail.url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={routes.product(product.slug)}
                        onClick={close}
                        className="block truncate text-sm font-medium text-ink transition-colors hover:text-moss"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs tabular-nums text-muted">{formatMoney(product.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => add(product, undefined, 1)}
                      className={cn(
                        'shrink-0 rounded-xs border border-line px-3 py-1.5 text-xs font-medium text-ink',
                        'transition-colors hover:border-ink hover:bg-ink hover:text-shell',
                      )}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
