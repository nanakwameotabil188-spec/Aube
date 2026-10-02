/**
 * Shown in place of admin data when the panel cannot reach the database.
 *
 * This is a normal state, not an error: the storefront ships with mock content
 * and no credentials, so the panel has to be useful as an explanation rather
 * than a stack trace on first run.
 */
export function AdminEmpty({ reason, detail }: { reason: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-shell p-8">
      <h1 className="text-lg font-semibold tracking-tight">{reason}</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">{detail}</p>
      <p className="mt-4 max-w-prose text-sm text-muted">
        Set <code className="rounded-xs bg-sand px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
        <code className="rounded-xs bg-sand px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
        and <code className="rounded-xs bg-sand px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
        in <code className="rounded-xs bg-sand px-1 py-0.5 text-xs">.env.local</code>, then run the
        migration in <code className="rounded-xs bg-sand px-1 py-0.5 text-xs">supabase/migrations</code>.
      </p>
    </div>
  );
}
