import type { Metadata } from 'next';
import { Suspense } from 'react';
import { contentService } from '@/lib/services/content-service';
import { paymentGatewayState } from '@/lib/supabase/integrations';
import { CheckoutFlow } from '@/components/commerce/CheckoutFlow';
import { CartPageSkeleton } from '@/components/ui/states';
import { pageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await contentService.getSettings();
  return pageMetadata(settings, {
    title: 'Checkout',
    description: `Complete your ${settings.brandName} order.`,
    path: '/checkout',
    noIndex: true,
  });
}

export default async function CheckoutPage() {
  const [settings, shippingMethods, gateway] = await Promise.all([
    contentService.getSettings(),
    contentService.getShippingMethods(),
    // What the admin actually configured, resolved on the server. The payment
    // step's wording comes from here rather than being hardcoded, so choosing a
    // provider in the admin panel changes what a shopper is actually told.
    paymentGatewayState(),
  ]);

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-10">
        <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">Checkout</h1>
      </header>

      <Suspense fallback={<CartPageSkeleton />}>
        <CheckoutFlow
          settings={settings}
          shippingMethods={shippingMethods}
          gateway={{
            collectsPayment: gateway.collectsPayment,
            label: gateway.label,
            shopperNotice: gateway.shopperNotice,
          }}
        />
      </Suspense>
    </div>
  );
}
