import { getAdminStatus } from '@/lib/supabase/admin-data';
import { listNewsletterSubscribers } from '@/lib/supabase/newsletter';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { AdminGate } from '@/components/admin/AdminGate';

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function AdminSubscribersPage() {
  return (
    <AdminGate>
      <SubscribersScreen />
    </AdminGate>
  );
}

async function SubscribersScreen() {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const subscribers = await listNewsletterSubscribers();
  if (!subscribers) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Newsletter subscribers</h1>
        <p className="mt-1 text-sm text-muted">
          {subscribers.length} {subscribers.length === 1 ? 'address' : 'addresses'}, newest first
        </p>
      </div>

      {subscribers.length === 0 ? (
        <p className="rounded-lg border border-line bg-shell p-6 text-sm text-muted">
          No subscribers yet. Addresses appear here as soon as someone signs up on the storefront.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-shell">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.14em] text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Source</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((subscriber) => (
                <tr key={subscriber.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{subscriber.email}</td>
                  <td className="px-4 py-3 text-muted">{subscriber.source}</td>
                  <td className="px-4 py-3 text-right text-muted tabular-nums">
                    {formatDate(subscriber.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
