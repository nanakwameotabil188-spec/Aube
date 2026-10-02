import Link from 'next/link';
import { AdminNav } from '@/components/admin/AdminNav';
import { SignOutButton } from '@/components/admin/SignOutButton';
import { getAdminAuth } from '@/lib/supabase/admin-auth';
import { contentService } from '@/lib/services/content-service';

/**
 * Panel chrome.
 *
 * Applies to every `/admin/*` route except `/admin/login`, which sits outside
 * this group. The identity shown here is the one `getAdminAuth` read from
 * `admin_users` — the same call that gated the page, so the name and role on
 * screen are the database's, not something the browser supplied.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const [settings, auth] = await Promise.all([contentService.getSettings(), getAdminAuth()]);

  return (
    <>
      <header className="border-b border-line bg-shell">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
          <Link href="/admin" className="text-lg font-semibold tracking-tight">
            {settings.brandName} <span className="font-normal text-muted">Admin</span>
          </Link>

          <AdminNav />

          {auth.authenticated ? (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted">
                {auth.name || auth.email} · {auth.role}
              </span>
              <SignOutButton />
            </div>
          ) : null}
        </div>
      </header>

      {children}
    </>
  );
}
