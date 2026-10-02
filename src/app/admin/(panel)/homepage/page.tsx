import { listHomeSections } from '@/lib/supabase/admin-content';
import { categoryService } from '@/lib/services/catalog-service';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { HomepageEditor } from '@/components/admin/HomepageEditor';

export const dynamic = 'force-dynamic';

export default async function AdminHomepagePage() {
  return (
    <AdminGate>
      <HomepageScreen />
    </AdminGate>
  );
}

async function HomepageScreen() {
  const sections = await listHomeSections();
  if (!sections) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  // Real category records with live visible-product counts, so the showcase
  // picker offers what actually exists and can warn about a category whose
  // products are all hidden — the case that otherwise produces an empty row.
  const categories = (await categoryService.getWithProductCounts()).map((category) => ({
    id: category.id,
    name: category.name,
    productCount: category.productCount,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Homepage</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          The homepage is assembled from these sections, in this order. Reorder with the arrows,
          hide a section without deleting it, and edit its copy. The storefront renders whatever
          this list says.
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="rounded-lg border border-line bg-shell p-6 text-sm text-muted">
          No homepage sections yet. The storefront renders its empty state until at least one is
          enabled.
        </p>
      ) : (
        <HomepageEditor sections={sections} categories={categories} />
      )}
    </div>
  );
}
