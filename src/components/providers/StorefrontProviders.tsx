'use client';

import type { ReactNode } from 'react';
import type { ShippingMethod, StoreSettings } from '@/types';
import { CartProvider } from '@/store/cart-context';
import { UIProvider } from '@/store/ui-context';
import { WishlistProvider, RecentlyViewedProvider } from '@/store/wishlist-context';
import { ToastProvider } from '@/store/toast-context';

/**
 * Global state boundary.
 *
 * One client provider tree, mounted once in the root layout. Props arrive
 * from the server and are plain serialisable records, so no client fetch is
 * needed to boot the shell.
 */
export function StorefrontProviders({
  children,
  settings,
  shippingMethods,
}: {
  children: ReactNode;
  settings: StoreSettings;
  shippingMethods: ShippingMethod[];
}) {
  return (
    <ToastProvider>
      <UIProvider>
        <WishlistProvider>
          <RecentlyViewedProvider>
            <CartProvider settings={settings} shippingMethods={shippingMethods}>
              {children}
            </CartProvider>
          </RecentlyViewedProvider>
        </WishlistProvider>
      </UIProvider>
    </ToastProvider>
  );
}
