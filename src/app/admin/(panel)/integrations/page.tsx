import { describeIntegration } from '@/lib/supabase/integrations';
import { describeEncryptionConfig } from '@/lib/supabase/crypto';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { IntegrationForm, TestEmailConnectionForm } from '@/components/admin/IntegrationForm';
import { getAdminStatus } from '@/lib/supabase/admin-data';

export const dynamic = 'force-dynamic';

/**
 * Integrations.
 *
 * The place where a payment gateway and an email provider are configured without
 * a deploy. Everything on this page is masked or boolean — the page never
 * receives a decrypted credential, because the read path for one does not exist.
 */
export default async function AdminIntegrationsPage() {
  return (
    <AdminGate>
      <IntegrationsScreen />
    </AdminGate>
  );
}

async function IntegrationsScreen() {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const [payments, email, encryption] = await Promise.all([
    describeIntegration('payments'),
    describeIntegration('email'),
    Promise.resolve(describeEncryptionConfig()),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Connect a payment gateway and an email provider. Credentials are encrypted before they are
          stored and cannot be read back afterwards — only replaced.
        </p>
      </div>

      {!encryption.ready ? (
        <div className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          <p className="font-medium">Credentials cannot be stored yet.</p>
          <p className="mt-1">{encryption.message}</p>
          <p className="mt-1">
            Generate one with{' '}
            <code className="rounded-xs bg-porcelain px-1 py-0.5 text-xs">
              node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
            </code>{' '}
            and add it to the deployment environment as{' '}
            <code className="rounded-xs bg-porcelain px-1 py-0.5 text-xs">SECRET_ENCRYPTION_KEY</code>.
            Nothing is stored unencrypted in the meantime.
          </p>
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Payments</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            How orders get paid. Until a gateway is connected and its checkout flow is implemented,
            checkout will not collect a card and will say that no payment was taken.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-shell p-5">
          <IntegrationForm
            id="payments"
            view={payments}
            encryptionReady={encryption.ready}
            encryptionMessage={encryption.message}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Email</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Sends order confirmations, verification links, password resets and broadcasts. Choose{' '}
            <strong>Log only</strong> to see what would be sent without sending it.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-shell p-5">
          <IntegrationForm
            id="email"
            view={email}
            encryptionReady={encryption.ready}
            encryptionMessage={encryption.message}
          />
        </div>

        {email.provider !== 'none' && email.provider !== 'console' ? (
          <div className="rounded-lg border border-line bg-shell p-5">
            <h3 className="mb-3 text-sm font-semibold">Check the credentials</h3>
            <TestEmailConnectionForm provider={email.provider} />
          </div>
        ) : null}
      </section>
    </div>
  );
}