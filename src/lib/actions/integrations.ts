'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAuth } from '@/lib/supabase/admin-auth';
import {
  describeIntegration,
  providersFor,
  saveIntegration,
  type IntegrationId,
} from '@/lib/supabase/integrations';
import { describeEncryptionConfig } from '@/lib/supabase/crypto';
import { verifyEmailProvider } from '@/lib/mail/send';
import {
  listAutomations,
  listTemplates,
  saveTemplate,
  setAutomationEnabled,
} from '@/lib/mail/templates';

/**
 * Admin actions for payment and email configuration.
 *
 * ## Nothing here returns a secret
 *
 * Every action returns either a mask or a status. That is the whole contract:
 * these results are serialised into the page, so a decrypted key returned from
 * any of them would end up in the HTML and in the browser's network log.
 *
 * ## `admin` role, not `editor`
 *
 * `requireAdmin()` rather than the default editor check. An editor who can
 * rewrite the payment gateway credential is an editor who can point every future
 * order somewhere else. Reading is fine for an editor; writing keys is not.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

function asString(value: FormDataEntryValue | null, max = 400): string {
  return String(value ?? '').trim().slice(0, max);
}

function collectPrefixed(formData: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(prefix) && typeof value === 'string' && value.trim() !== '') {
      out[key.slice(prefix.length)] = value.trim();
    }
  }
  return out;
}

/**
 * Admin-role gate for the credential actions.
 *
 * `getAdminAuth` carries the role read from `admin_users`, so this checks an
 * authoritative server-side value â€” not a role read from a cookie or posted with
 * the form, which is the shape that lets an editor promote themselves.
 */
async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const auth = await getAdminAuth();

  if (!auth.authenticated) {
    return { ok: false, message: 'You are not authorised to perform this action.' };
  }
  if (auth.role !== 'admin') {
    return {
      ok: false,
      message: 'Only an admin can change provider credentials. Ask an admin to do this.',
    };
  }

  return { ok: true, userId: auth.userId };
}

/** Whether the form included any secret field at all. */
function submittedSecrets(formData: FormData): boolean {
  return [...formData.keys()].some((key) => key.startsWith('secret_'));
}

export async function savePaymentIntegration(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const provider = asString(formData.get('provider'), 40);
  const enabled = formData.get('enabled') === 'on' || formData.get('enabled') === 'true';
  const config = collectPrefixed(formData, 'config_');
  const secrets = collectPrefixed(formData, 'secret_');

  const result = await saveIntegration({
    id: 'payments',
    provider,
    enabled,
    config,
    // Absent from the form entirely means "leave what is stored alone"; present
    // but blank means "clear it". The product form can therefore edit config
    // without re-pasting a key it was never shown.
    secrets: submittedSecrets(formData)
      ? secrets
      : null,
    adminUserId: auth.userId,
  });

  if (!result.ok) return result;

  revalidatePath('/admin/integrations');
  revalidatePath('/admin/settings');

const support = providersFor('payments').find((p) => p.id === provider)?.support;
  const suffix =
    support === 'credentials-only'
      ? ' Credentials are stored, but the live checkout flow for this provider is not implemented yet — orders will be recorded as unpaid and no card will be charged.'
      : '';

  return {
    ok: true,
    message: result.cleared
      ? `Saved. The stored credentials were cleared.${suffix}`
      : `Saved. The credentials are encrypted and can never be read back — only replaced.${suffix}`,
  };
}

export async function saveEmailIntegration(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const encryption = describeEncryptionConfig();
  const provider = asString(formData.get('provider'), 40);
  const enabled = formData.get('enabled') === 'on' || formData.get('enabled') === 'true';
  const config = collectPrefixed(formData, 'config_');
  const secrets = collectPrefixed(formData, 'secret_');

  // Providers with no secret at all are legitimate, so the key check only
  // applies when one is actually being submitted.
  if (Object.keys(secrets).length > 0 && !encryption.ready) {
    return { ok: false, message: encryption.message };
  }

  const result = await saveIntegration({
    id: 'email',
    provider,
    enabled,
    config,
    secrets: submittedSecrets(formData) ? secrets : null,
    adminUserId: auth.userId,
  });

  if (!result.ok) return result;

  revalidatePath('/admin/integrations');
  revalidatePath('/admin/settings');

  return { ok: true, message: result.cleared ? 'Saved. Credentials cleared.' : 'Saved.' };
}

/**
 * Checks credentials without sending anything to a real person.
 *
 * The pasted values win over what is stored, so an operator can validate a key
 * before committing to it. Nothing is written: this is a read-only check against
 * the provider.
 */
export async function testEmailConnection(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const provider = asString(formData.get('provider'), 40);
  const pasted = collectPrefixed(formData, 'secret_');

  const result = await verifyEmailProvider(provider, pasted);

  return {
    ok: result.ok,
    message: result.ok
      ? `Connected. ${result.detail}`
      : `Could not connect. ${result.detail}`,
  };
}

export async function saveEmailTemplate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const result = await saveTemplate({
    key: asString(formData.get('key'), 60),
    subject: asString(formData.get('subject'), 200),
    bodyHtml: String(formData.get('body_html') ?? '').slice(0, 20_000),
    bodyText: String(formData.get('body_text') ?? '').slice(0, 20_000),
    enabled: formData.get('enabled') === 'on',
    adminUserId: auth.userId,
  });

  if (!result.ok) return result;

  revalidatePath('/admin/email');
  return { ok: true, message: 'Template saved.' };
}

export async function toggleAutomation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const event = asString(formData.get('event'), 60);
  const enabled = formData.get('enabled') === 'on' || formData.get('enabled') === 'true';

  const result = await setAutomationEnabled(event, enabled);
  if (!result.ok) return result;

  revalidatePath('/admin/email');
  return { ok: true, message: `${event} is now ${enabled ? 'on' : 'off'}.` };
}

/** Server-side loader for the admin pages. Returns masked data only. */
export async function loadIntegration(id: IntegrationId) {
  return describeIntegration(id);
}

export async function loadEmailContent() {
  return { templates: await listTemplates(), automations: await listAutomations() };
}