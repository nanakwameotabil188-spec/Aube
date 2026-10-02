import type { Metadata } from 'next';
import { getAdminStatus } from '@/lib/supabase/admin-data';

/**
 * Outer admin shell.
 *
 * Only the surface: a background, a readable colour scheme, and a main
 * landmark. The navigation and the signed-in account live in the `(panel)`
 * group's own layout, so `/admin/login` renders as a single focused form
 * instead of the full panel chrome wrapped around a "Sign in required" panel.
 *
 * No "Supabase is not configured" banner here on purpose. `AdminGate` already
 * reports that, once, in the content area, and a second copy in the chrome
 * above it just repeats the same sentence on every page.
 */

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Resolved so an unconfigured deployment is visible in the server log as
  // well as in the UI, without duplicating the message on the page.
  getAdminStatus();

  return (
    <div className="min-h-dvh bg-porcelain text-ink">
      <main id="main" className="mx-auto w-full max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
