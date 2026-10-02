import Link from 'next/link';
import { getAdminStatus, listTaxonomyForAdmin } from '@/lib/supabase/admin-data';
import { listMedia } from '@/lib/supabase/admin-content';
import { contentService } from '@/lib/services/content-service';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { AdminGate } from '@/components/admin/AdminGate';
import { ProductForm } from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';

export default async function NewAdminProductPage() {
  return (
    <AdminGate>
      <NewProductScreen />
    </AdminGate>
  );
}

async function NewProductScreen() {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const [taxonomy, media, settings] = await Promise.all([
    listTaxonomyForAdmin(),
    listMedia(),
    contentService.getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          A name and a category are required. The slug is derived from the name, and anything left
          blank simply is not shown on the storefront — an unfinished product is better than a
          blank card with a price on it.
        </p>
      </div>

      <ProductForm
        product={null}
        taxonomy={taxonomy ?? []}
        media={media ?? []}
        brandName={settings.brandName}
      />

      <p className="text-sm text-muted">
        <Link href="/admin/products" className="underline underline-offset-4 hover:text-ink">
          Back to products
        </Link>
      </p>
    </div>
  );
}
