import { listAutomations, listTemplates } from '@/lib/mail/templates';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { EmailAutomationPanel } from '@/components/admin/EmailAutomationPanel';
import { getAdminStatus } from '@/lib/supabase/admin-data';
import { readIntegration } from '@/lib/supabase/integrations';

export const dynamic = 'force-dynamic';

/** Email templates and the automations that send them. */
export default async function AdminEmailPage() {
  return (
    <AdminGate>
      <EmailScreen />
    </AdminGate>
  );
}

async function EmailScreen() {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const [templates, automations, integration] = await Promise.all([
    listTemplates(),
    listAutomations(),
    readIntegration('email'),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Email</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          What gets sent, when, and what it says.
        </p>
      </div>

      {integration.provider === 'none' ? (
        <p className="rounded-md border border-line bg-sand px-4 py-3 text-sm text-muted">
          No email provider is configured, so nothing is actually sent — every attempt is recorded in
          the log as skipped.{' '}
          <a href="/admin/integrations" className="underline underline-offset-4">
            Connect one under Integrations
          </a>
          , or choose <strong>Log only</strong> to see what would go out.
        </p>
      ) : null}

      {templates.length === 0 ? (
        <AdminEmpty
          reason="No templates"
          detail="The seed migration did not run, so there is nothing to edit yet."
        />
      ) : (
        <EmailAutomationPanel templates={templates} automations={automations} />
      )}
    </div>
  );
}