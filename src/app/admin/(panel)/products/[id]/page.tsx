import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminStatus, getAdminProduct, listTaxonomyForAdmin } from '@/lib/supabase/admin-data';
import { listMedia } from '@/lib/supabase/admin-content';
import { contentService } from '@/lib/services/content-service';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { AdminGate } from '@/components/admin/AdminGate';
import { ProductForm } from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AdminGate>
      <EditProductScreen params={params} />
    </AdminGate>
  );
}

async function EditProductScreen({ params }: { params: Promise<{ id: string }> }) {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) notFound();

  const [taxonomy, media, settings] = await Promise.all([
    listTaxonomyForAdmin(),
    listMedia(),
    contentService.getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{product.name}</h1>
        <Link
          href={`/products/${product.slug}`}
          className="text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          View on storefront
        </Link>
      </div>

      <ProductForm
        product={product}
        taxonomy={taxonomy ?? []}
        media={media ?? []}
        brandName={settings.brandName}
      />
    </div>
  );
}
