import { listOnboardingSlides } from '@/lib/supabase/admin-content';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { SlideEditor } from '@/components/admin/SlideEditor';

export const dynamic = 'force-dynamic';

export default async function AdminOnboardingPage() {
  return (
    <AdminGate>
      <OnboardingScreen />
    </AdminGate>
  );
}

async function OnboardingScreen() {
  const slides = await listOnboardingSlides();
  if (!slides) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Intro / Onboarding</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          The short introduction a first-time visitor sees once. Create, edit, reorder, or hide
          slides. With no live slides the storefront shows no introduction at all.
        </p>
      </div>

      <SlideEditor slides={slides} />
    </div>
  );
}
