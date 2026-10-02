import type { ReactNode } from 'react';
import Link from 'next/link';
import { getAdminAuth } from '@/lib/supabase/admin-auth';
import { AdminEmpty } from './AdminEmpty';

/**
 * Admin authorisation gate.
 *
 * Every admin route renders through this before it reads or writes anything.
 * It is a rendering guard, not a security boundary — the service-role client
 * bypasses RLS, so the real checks are `getAdminAuth` inside
 * `admin-content.ts` and `authorise()` inside every server action. This exists
 * so an unauthenticated visitor sees a way in instead of an empty dashboard.
 *
 * The three failure modes are reported distinctly, because they need different
 * fixes: a missing configuration is a deployment problem, a missing session is
 * a sign-in problem, and a missing admin row is a permissions problem.
 */
export async function AdminGate({ children }: { children: ReactNode }) {
  const auth = await getAdminAuth();

  if (auth.authenticated) return <>{children}</>;

  if (auth.reason === 'not_configured') {
    return <AdminEmpty reason="Supabase is not configured" detail={auth.detail} />;
  }

  if (auth.reason === 'not_authorised') {
    return (
      <div className="rounded-lg border border-line bg-shell p-8">
        <h1 className="text-lg font-semibold tracking-tight">Not authorised</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">{auth.detail}</p>
        <p className="mt-4 max-w-prose text-sm text-muted">
          An administrator has to add this account to{' '}
          <code className="rounded-xs bg-sand px-1 py-0.5 text-xs">admin_users</code> before it can
          reach the panel.
        </p>
        <p className="mt-6 flex flex-wrap gap-4">
          <Link href="/admin/login" className="text-sm underline underline-offset-4 hover:text-ink">
            Sign in with another account
          </Link>
          <Link href="/" className="text-sm underline underline-offset-4 hover:text-ink">
            Back to the storefront
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-shell p-8">
      <h1 className="text-lg font-semibold tracking-tight">Sign in required</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">{auth.detail}</p>
      <p className="mt-6">
        <Link
          href="/admin/login"
          className="text-sm underline underline-offset-4 hover:text-ink"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
