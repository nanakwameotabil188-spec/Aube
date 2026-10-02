import { readBrandSettings, listMedia } from '@/lib/supabase/admin-content';
import { contentService } from '@/lib/services/content-service';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { BrandForm } from '@/components/admin/BrandForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  return (
    <AdminGate>
      <SettingsScreen />
    </AdminGate>
  );
}

async function SettingsScreen() {
  const [stored, live, media] = await Promise.all([
    readBrandSettings(),
    contentService.getSettings(),
    listMedia(),
  ]);

  if (!stored) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  /*
   * Seeded values are merged in so a freshly seeded project shows editable
   * fields rather than blank ones. A stored value always wins, because that is
   * what the admin last saved.
   */
  const settings = {
    ...stored,
    brandName: stored.brandName || live.brandName,
    legalName: stored.legalName || live.legalName,
    brandCode: stored.brandCode || live.brandCode,
    tagline: stored.tagline || live.tagline,
    description: stored.description || live.description,
    supportEmail: stored.supportEmail || live.supportEmail,
    supportPhone: stored.supportPhone || live.supportPhone,
    address: stored.address || live.address,
    seoTitle: stored.seoTitle || live.seoTitle,
    seoDescription: stored.seoDescription || live.seoDescription,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Branding</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          The website name, contact details, and default search copy. These are the single source of
          truth: changing the name here updates the navbar, footer, page titles, structured data,
          order numbers, and SKUs across the whole site.
        </p>
      </div>

      <BrandForm
        settings={settings}
        media={(media ?? []).map((item) => ({ id: item.id, url: item.url, alt: item.alt }))}
      />
    </div>
  );
}
