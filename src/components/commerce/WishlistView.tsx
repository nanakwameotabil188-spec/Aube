'use client';

import type { Product, StoreSettings } from '@/types';
import { ProductGrid } from '@/components/commerce/ProductCard';
import { EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { useWishlist } from '@/store/wishlist-context';
import { useCart } from '@/store/cart-context';
import { useToast } from '@/store/toast-context';

/**
 * Wishlist.
 *
 * Products are resolved on the server and the saved ids on the client, so the
 * view intersects the two. Items whose product has since been delisted simply
 * drop out rather than rendering a broken card.
 */
export function WishlistView({ products, settings }: { products: Product[]; settings: StoreSettings }) {
  const { ids, clear, isReady } = useWishlist();
  const { add } = useCart();
  const { notify } = useToast();

  const saved = products.filter((product) => ids.includes(product.id));

  if (!isReady) {
    // Storage is read after hydration; rendering the empty state first would
    // flash "nothing saved" at a returning shopper with a full wishlist.
    return <div className="h-64" aria-hidden />;
  }

  if (saved.length === 0) {
    return (
      <EmptyState
        icon="heart"
        title="Nothing saved yet"
        body="Tap the heart on any product to keep it here while you decide."
        action={{ label: 'Shop all products', href: routes.shop }}
        className="py-20"
      />
    );
  }

  const moveAll = () => {
    saved.forEach((product) => add(product, undefined, 1));
    clear();
    notify(`${saved.length} ${saved.length === 1 ? 'product' : 'products'} moved to your bag`, { tone: 'success' });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <p className="text-sm text-muted" aria-live="polite">
          {saved.length} saved {saved.length === 1 ? 'product' : 'products'}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={moveAll}>
            Move all to bag
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clear();
              notify('Saved products cleared');
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <ProductGrid products={saved} />
    </div>
  );
}
