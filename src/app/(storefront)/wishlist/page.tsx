import type { Metadata } from 'next';
import { contentService } from '@/lib/services/content-service';
import { WishlistView } from '@/components/commerce/WishlistView';
import { productService } from '@/lib/services/catalog-service';

export const metadata: Metadata = {
  title: 'Saved products',
  description: 'Products you have saved for later.',
  robots: { index: false, follow: true },
};

export default async function WishlistPage() {
  // The saved ids live in client storage, so the products they resolve to are
  // passed in whole and the view renders whatever subset is still saved.
  const [settings, all] = await Promise.all([contentService.getSettings(), productService.getAll()]);

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-10">
        <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">Saved</h1>
        <p className="mt-3 max-w-md text-md leading-relaxed text-muted">
          Kept in this browser. Anything saved while signed in would follow your account instead.
        </p>
      </header>

      <WishlistView products={all} settings={settings} />
    </div>
  );
}
