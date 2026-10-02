import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminAuth } from '@/lib/supabase/admin-auth';
import { getAdminStatus } from '@/lib/supabase/admin-data';
import { contentService } from '@/lib/services/content-service';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { SignInForm } from '@/components/admin/SignInForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

/**
 * Admin sign-in.
 *
 * Sits inside the `/admin` segment but outside the panel's own layout, so a
 * signed-out visitor gets a single focused form rather than the admin chrome
 * wrapped around a "Sign in required" message.
 */
export default async function AdminLoginPage() {
  const [auth, status, settings] = await Promise.all([
    getAdminAuth(),
    getAdminStatus(),
    contentService.getSettings(),
  ]);

  // Already in: nothing to do here, send them to the panel.
  if (auth.authenticated) redirect('/admin');

  // Unconfigured is a deployment problem, not a credentials problem, so it is
  // explained instead of offering a form that cannot succeed.
  if (!status.ready) {
    return (
      <Shell brandName={settings.brandName}>
        <AdminEmpty reason={status.reason} detail={status.detail} />
      </Shell>
    );
  }

  return (
    <Shell brandName={settings.brandName}>
      <h1 className="font-display text-3xl tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Administrator accounts only. If you do not have one, ask the store owner to add your
        address.
      </p>

      <SignInForm />

      <p className="mt-8 text-sm text-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-ink">
          Back to the storefront
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ brandName, children }: { brandName: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-porcelain px-6 py-16 text-ink">
      <div className="w-full max-w-sm">
        <p className="text-sm font-semibold tracking-tight">{brandName}</p>
        <div className="mt-6 rounded-lg border border-line bg-shell p-6">{children}</div>
      </div>
    </div>
  );
}
