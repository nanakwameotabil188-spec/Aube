import { listMedia } from '@/lib/supabase/admin-content';
import { audienceCounts, notificationStats } from '@/lib/supabase/notifications';
import { readIntegration } from '@/lib/supabase/integrations';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { ComposePanel, TestSendPanel } from '@/components/admin/ComposePanel';
import { getAdminStatus } from '@/lib/supabase/admin-data';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

/**
 * Messaging: send to the newsletter list and to account holders, plus a record
 * of every attempt.
 */
export default async function AdminMessagingPage() {
  return (
    <AdminGate>
      <MessagingScreen />
    </AdminGate>
  );
}

function toneClass(status: string): string {
  if (status === 'sent') return 'bg-success-soft text-success';
  if (status === 'failed') return 'bg-danger-soft text-danger';
  return 'bg-sand text-muted';
}

async function MessagingScreen() {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const [media, counts, stats, integration] = await Promise.all([
    listMedia(),
    audienceCounts(),
    notificationStats(),
    readIntegration('email'),
  ]);

  const admin = createAdminSupabaseClient();
  const { data: log } = admin
    ? await admin
        .from('email_log')
        .select('event, recipient, subject, status, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(25)
    : { data: null };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Messaging</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Send an announcement to the newsletter list or to account holders, and see what has been
          sent.
        </p>
      </div>

      {integration.provider === 'none' ? (
        <p className="rounded-md border border-line bg-sand px-4 py-3 text-sm text-muted">
          No email provider is configured, so sending will record every message as skipped rather
          than deliver it.{' '}
          <a href="/admin/integrations" className="underline underline-offset-4">
            Connect one under Integrations
          </a>
          . <strong>Log only</strong> is the quickest way to check your message renders correctly.
        </p>
      ) : null}

      <section className="rounded-lg border border-line bg-shell p-5">
        <ComposePanel
          media={(media ?? []).map((item) => ({ id: item.id, url: item.url, alt: item.alt ?? '' }))}
          counts={counts}
        />
      </section>

      <section className="rounded-lg border border-line bg-shell p-5">
        <h2 className="mb-3 text-sm font-semibold">Send a test</h2>
        <TestSendPanel />
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">In-app notifications</h2>
        <p className="mt-1 text-sm text-muted">
          {stats.total} sent · {stats.unread} unread. Notifications fan out one row per recipient so
          each person has their own read state.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Recent sends</h2>
        {log && log.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-sand text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Trigger</th>
                  <th scope="col" className="px-4 py-3 font-medium">To</th>
                  <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                  <th scope="col" className="px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row, index) => (
                  <tr key={index} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.event}</td>
                    <td className="px-4 py-3">{row.recipient}</td>
                    <td className="px-4 py-3 text-muted">{row.subject}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          toneClass(row.status),
                        )}
                        title={row.detail ?? undefined}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Nothing has been sent yet.
          </p>
        )}
      </section>
    </div>
  );
}