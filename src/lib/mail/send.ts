import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { readIntegration, readSecret } from '@/lib/supabase/integrations';
import { mailProvider } from './providers';
import type { MailMessage, MailResult } from './types';

/**
 * The single outbound email path.
 *
 * Every caller — the automation engine, the admin broadcast, the verification
 * flow — goes through `sendMail`. There is no second way to send mail, which is
 * what makes the log complete and the "is email actually configured" answer
 * reliable.
 *
 * ## Every attempt is logged, including the ones that did not happen
 *
 * `email_log` gets a row whether the mail was sent, refused, or skipped because
 * no provider is configured. The skipped case is the one that matters: without
 * it, "no confirmation email arrived" and "the confirmation email was never
 * attempted" are indistinguishable from the outside, and the first question an
 * operator asks — is my provider working? — has no answer.
 */

export interface SendOptions {
  /** The automation that fired, or a dotted manual event. */
  event: string;
  /** Suppresses the log row. Only for tests. */
  record?: boolean;
}

function senderFrom(config: Record<string, string>): { from?: string; fromName?: string } {
  const from = config.from_email?.trim();
  if (!from) return {};

  // `Name <address@example.com>` is accepted in the one config field, so an
  // operator can paste either form without the field becoming two fields.
  const match = /^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/.exec(from);
  if (match) return { fromName: match[1] || undefined, from: match[2] };
  return { from };
}

async function record(entry: {
  event: string;
  templateKey?: string | null;
  recipient: string;
  subject: string;
  provider: string;
  status: 'sent' | 'failed' | 'skipped';
  detail?: string | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  if (!admin) return;

  // A failure to write the log must not fail the send. Losing an audit row is
  // bad; failing to tell a customer their order shipped is worse.
  await admin.from('email_log').insert({
    event: entry.event,
    template_key: entry.templateKey ?? null,
    recipient: entry.recipient,
    subject: entry.subject.slice(0, 200),
    provider: entry.provider,
    status: entry.status,
    detail: entry.detail ?? null,
  });
}

/**
 * Sends one message using whatever provider is configured.
 *
 * Returns a result rather than throwing. A failed send is an ordinary outcome
 * that callers log and, where it matters, surface — it is not an exception that
 * should unwind a checkout.
 */
export async function sendMail(
  message: MailMessage,
  options: SendOptions,
): Promise<MailResult> {
  const record_ = options.record !== false;

  const { provider: providerId, enabled, config } = await readIntegration('email');

  const write = async (result: MailResult, templateKey: string | null = null) => {
    if (record_) {
      await record({
        event: options.event,
        templateKey,
        recipient: message.to,
        subject: message.subject,
        provider: result.provider,
        status: result.ok ? 'sent' : result.failure === 'not-configured' ? 'skipped' : 'failed',
        detail: result.detail,
      });
    }
    return result;
  };

  if (providerId === 'none') {
    return write({
      ok: false,
      provider: 'none',
      detail: 'No email provider is configured. Configure one under Admin → Integrations.',
      failure: 'not-configured',
    });
  }

  if (!enabled) {
    return write({
      ok: false,
      provider: providerId,
      detail: `The ${providerId} integration is switched off.`,
      failure: 'not-configured',
    });
  }

  const provider = mailProvider(providerId);
  if (!provider) {
    return write({
      ok: false,
      provider: providerId,
      detail: `Provider "${providerId}" is not implemented in this app.`,
      failure: 'provider-unsupported',
    });
  }

  const secrets = provider.requiresSecrets ? await readSecret('email') : {};

  if (provider.requiresSecrets && Object.keys(secrets).length === 0) {
    return write({
      ok: false,
      provider: providerId,
      detail: `No credentials are stored for ${providerId}.`,
      failure: 'not-configured',
    });
  }

  const sender = senderFrom(config);
  const enriched: MailMessage = {
    ...message,
    from: message.from ?? sender.from,
    fromName: message.fromName ?? sender.fromName,
  };

  try {
    return await write(await provider.send(enriched, secrets));
  } catch (error) {
    // A provider adapter is not supposed to throw, but a bug in one must not
    // take down the caller.
    return write({
      ok: false,
      provider: providerId,
      detail: error instanceof Error ? error.message : 'the provider call threw',
      failure: 'rejected',
    });
  }
}

/** Runs a provider's credential check for the admin's "Test connection" button. */
export async function verifyEmailProvider(
  providerId: string,
  secrets: Record<string, string>,
): Promise<MailResult> {
  const provider = mailProvider(providerId);

  if (!provider) {
    return {
      ok: false,
      provider: providerId,
      detail: `Provider "${providerId}" is not implemented in this app.`,
      failure: 'provider-unsupported',
    };
  }

  if (!provider.requiresSecrets) return provider.verify(secrets);

  // Prefer what is already stored when the admin has not just pasted new values.
  const stored = Object.keys(secrets).length > 0 ? secrets : await readSecret('email');
  return provider.verify(stored);
}