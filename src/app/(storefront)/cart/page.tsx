import type { Metadata } from 'next';
import { contentService } from '@/lib/services/content-service';
import { productService } from '@/lib/services/catalog-service';
import { CartView } from '@/components/commerce/CartView';
import { pageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await contentService.getSettings();
  return pageMetadata(settings, {
    title: 'Your bag',
    description: `Review the items in your ${settings.brandName} bag before checking out.`,
    path: '/cart',
    noIndex: true,
  });
}

/**
 * Cart route.
 *
 * The page itself is a shell: the bag lives in client state, so this only
 * supplies the settings and recommendations the view needs.
 */
export default async function CartPage() {
  const [settings, recommendations] = await Promise.all([
    contentService.getSettings(),
    productService.getByFlags('isBestSeller', 8),
  ]);

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-10">
        <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">Your bag</h1>
      </header>

      <CartView settings={settings} recommendations={recommendations} />
    </div>
  );
}
