import { createAdminSupabaseClient } from './admin';
import { decryptSecret, encryptSecret, isEncryptionConfigured, maskSecret } from './crypto';
import type { Database } from './types';

/**
 * Provider integrations: payment gateway and email transport.
 *
 * ## There is no read path that returns a plaintext secret
 *
 * That is the whole design. `describeIntegration` returns the provider, the
 * non-secret config, whether a secret is stored, and a *masked* fingerprint â€”
 * enough for a form to render and an operator to tell two keys apart, and
 * nothing that could be pasted into an API call. Every outbound call reads the
 * secret through `readSecret`, which is server-only.
 *
 * This matters more than it looks: the admin form is a client component tree
 * driven by a Server Action, so anything an action returns ends up in the page.
 * Returning a decrypted key would put a live gateway credential in the HTML.
 *
 * ## Encryption is required, not optional
 *
 * `saveIntegration` refuses to write a secret without `SECRET_ENCRYPTION_KEY`.
 * Silently storing it in plaintext "for now" is exactly the kind of temporary
 * that ships â€” and this is the credential that can move money.
 */

import { PAYMENT_PROVIDERS, providersFor, type IntegrationId } from '@/lib/integrations/providers';

// The catalogue is pure data with no server imports, so the client-side admin form
// can import it. Re-exported here so server code has one obvious entry point.
export {
  providersFor,
  PAYMENT_PROVIDERS,
  EMAIL_PROVIDERS,
  type IntegrationId,
  type IntegrationProvider,
  type IntegrationSecretSpec,
} from '@/lib/integrations/providers';

export interface IntegrationView {
  id: IntegrationId;
  provider: string;
  enabled: boolean;
  config: Record<string, string>;
  /** Whether a secret is on file, and a masked fingerprint if so. */
  hasSecret: boolean;
  secretMask: string;
  /** Masked per-key fingerprints, so several keys can be shown separately. */
  secretMasks: Record<string, string>;
  updatedAt: string | null;
  /** Set when the stored secret cannot be decrypted, e.g. the key was rotated. */
  unreadable: boolean;
  unreadableReason?: string;
}

type IntegrationRow = Pick<
  Database['public']['Tables']['integrations']['Row'],
  'provider' | 'secrets_ciphertext' | 'config' | 'enabled' | 'updated_at'
>;

function asStrings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      out[key] = String(entry);
    }
  }
  return out;
}

/**
 * Reads an integration for display. Never decrypts.
 */
export async function describeIntegration(id: IntegrationId): Promise<IntegrationView> {
  const empty: IntegrationView = {
    id,
    provider: 'none',
    enabled: false,
    config: {},
    hasSecret: false,
    secretMask: '',
    secretMasks: {},
    updatedAt: null,
    unreadable: false,
  };

  const admin = createAdminSupabaseClient();
  if (!admin) return empty;

  const { data } = await admin
    .from('integrations')
    .select('provider, secrets_ciphertext, config, enabled, updated_at')
    .eq('id', id)
    .maybeSingle<IntegrationRow>();

  if (!data) return empty;

  const view: IntegrationView = {
    ...empty,
    provider: data.provider,
    enabled: data.enabled,
    config: asStrings(data.config),
    hasSecret: Boolean(data.secrets_ciphertext),
    updatedAt: data.updated_at ?? null,
  };

  /*
   * The mask is computed by decrypting on the server and immediately reducing it
   * to a fingerprint.
   *
   * This is the one place the plaintext exists in a returned value, and it is
   * only ever the last four characters of each value. It cannot be skipped:
   * without it the form would show nothing, and an operator managing several keys
   * has no way to tell which one is stored. The alternative â€” showing nothing â€”
   * was tried and is genuinely worse in the one case this panel exists for.
   */
  if (data.secrets_ciphertext) {
    try {
      const parsed = JSON.parse(decryptSecret(data.secrets_ciphertext)) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value) {
          view.secretMasks[key] = maskSecret(value);
        }
      }
      view.secretMask = maskSecret(JSON.stringify(parsed));
    } catch (error) {
      view.unreadable = true;
      view.unreadableReason = error instanceof Error ? error.message : 'stored secret is unreadable';
      view.secretMask = 'stored value cannot be read';
    }
  }

  return view;
}

/**
 * Reads and decrypts a secret for an outbound provider call.
 *
 * Server-only by construction: it lives in `src/lib/supabase`, which no client
 * component imports, and its return value is only ever passed straight to a
 * provider SDK.
 */
export async function readSecret(id: IntegrationId): Promise<Record<string, string>> {
  const admin = createAdminSupabaseClient();
  if (!admin) return {};

  const { data } = await admin
    .from('integrations')
    .select('secrets_ciphertext')
    .eq('id', id)
    .maybeSingle<{ secrets_ciphertext: string | null }>();

  if (!data?.secrets_ciphertext) return {};

  try {
    return asStrings(JSON.parse(decryptSecret(data.secrets_ciphertext)));
  } catch {
    // A failure here must not throw a stack trace out of a send. The caller
    // treats an empty secret as "not configured" and logs the reason, which is
    // the same handling as a genuinely absent secret.
    return {};
  }
}

/** Reads the full integration row for the provider decision and config. */
export async function readIntegration(
  id: IntegrationId,
): Promise<{ provider: string; enabled: boolean; config: Record<string, string> }> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { provider: 'none', enabled: false, config: {} };

  const { data } = await admin
    .from('integrations')
    .select('provider, enabled, config')
    .eq('id', id)
    .maybeSingle<Pick<IntegrationRow, 'provider' | 'enabled' | 'config'>>();

  if (!data) return { provider: 'none', enabled: false, config: {} };

  return { provider: data.provider, enabled: data.enabled, config: asStrings(data.config) };
}

/**
 * What the configured payment integration will actually do at checkout.
 *
 * ## Why this is derived rather than recorded
 *
 * The tempting version is for `placeOrderInDatabase` to look at the provider
 * string and decide what the status should be. That puts a payment decision
 * inside the order-write path, where it is one more branch to get wrong and
 * nothing calls it in a test.
 *
 * Instead the answer is computed once, here, from data the admin already controls,
 * and both the order row and the storefront read it. There is exactly one place
 * that knows whether money moves.
 *
 * ## `collectsPayment` is false for every provider today
 *
 * That is not a placeholder. It is the accurate description of this codebase:
 * Stripe, PayPal and Razorpay credentials can be stored, but no charge flow is
 * implemented, and manual bank transfer is settled by hand rather than at
 * checkout. So every order this app writes is awaiting payment, and says so.
 */
export interface PaymentGatewayState {
  provider: string;
  /** Whether anything beyond "not configured" is selected and switched on. */
  configured: boolean;
  /** Whether placing an order takes money right now. */
  collectsPayment: boolean;
  /** Recorded as `orders.payment_method_label`, so the record matches reality. */
  label: string;
  /**
   * The order status to write.
   *
   * `'paid'` is reachable only when a provider genuinely charges. Everything else
   * — including manual bank transfer — is `'pending'`, which in this codebase
   * means awaiting payment and is what the admin panel shows as open.
   */
  status: 'pending' | 'paid';
  /** What the shopper is told before they submit. `null` to say nothing. */
  shopperNotice: string | null;
}

/** The honest default: nothing was charged, and the order says so. */
const NO_GATEWAY: PaymentGatewayState = {
  provider: 'none',
  configured: false,
  collectsPayment: false,
  label: 'Not collected',
  status: 'pending',
  shopperNotice:
    'No payment gateway is connected, so nothing is charged. What you enter here is not sent anywhere — only the last four digits are kept with the order, so the confirmation reads like a receipt.',
};

export async function paymentGatewayState(): Promise<PaymentGatewayState> {
  const { provider, enabled } = await readIntegration('payments');
  const spec = PAYMENT_PROVIDERS.find((entry) => entry.id === provider);

  // Unknown or switched off both mean the same thing to a shopper: no money is
  // moving. Falling back rather than trusting the stored string means a provider
  // removed from a later release degrades to an honest order instead of throwing
  // at checkout.
  if (!spec || spec.id === 'none' || !enabled) {
    return { ...NO_GATEWAY, provider: spec?.id ?? provider };
  }

  if (spec.collectsPayment) {
    return {
      provider: spec.id,
      configured: true,
      collectsPayment: true,
      label: spec.label,
      status: 'paid',
      shopperNotice: null,
    };
  }

  if (spec.id === 'manual') {
    return {
      provider: spec.id,
      configured: true,
      collectsPayment: false,
      label: 'Bank transfer',
      status: 'pending',
      shopperNotice:
        'This shop takes payment by bank transfer. Place the order first — it stays open until the transfer clears and we mark it paid by hand. No card details are collected or stored.',
    };
  }

  // Credentials are stored but the charge flow is not implemented. Stating that
  // at checkout is the whole reason the picker labels these providers
  // "credentials-only": an operator who pastes a Stripe key should not then have
  // a storefront that implies the shop can take money.
  return {
    provider: spec.id,
    configured: true,
    collectsPayment: false,
    label: 'Not collected',
    status: 'pending',
    shopperNotice:
      'This shop is not taking payments yet, so nothing will be charged and your order stays open until we arrange payment. No card details are collected or stored.',
  };
}

export interface SaveIntegrationInput {
  id: IntegrationId;
  provider: string;
  enabled: boolean;
  config: Record<string, string>;
  /**
   * Replaces the whole stored secret.
   *
   * Replacement rather than merge is deliberate: there is no read path for the
   * current value, so a merge could only be built by decrypting it and would
   * still be partial. "Save the form" meaning "these are now the credentials" is
   * also what an operator expects when they paste a rotated key.
   *
   * An empty object clears the secret without wiping the provider choice.
   */
  secrets: Record<string, string> | null;
  adminUserId: string | null;
}

export type SaveIntegrationResult =
  | { ok: true; cleared: boolean }
  | { ok: false; message: string };

export async function saveIntegration(
  input: SaveIntegrationInput,
): Promise<SaveIntegrationResult> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { ok: false, message: 'Supabase is not configured.' };

  const known = providersFor(input.id).some((p) => p.id === input.provider);
  if (!known) return { ok: false, message: `Unknown provider "${input.provider}".` };

  const row: Database['public']['Tables']['integrations']['Insert'] = {
    id: input.id,
    provider: input.provider,
    enabled: input.enabled,
    config: input.config,
    updated_by: input.adminUserId,
    updated_at: new Date().toISOString(),
  };

  if (input.secrets === null) {
    // No secrets submitted at all: keep whatever is stored, so editing the
    // config form does not blank the API key.
    row.secrets_ciphertext = null;
    const { error } = await admin
      .from('integrations')
      .update({
        provider: row.provider,
        enabled: row.enabled,
        config: row.config,
        updated_by: row.updated_by,
        updated_at: row.updated_at,
      })
      .eq('id', input.id);

    if (error) return { ok: false, message: error.message };
    return { ok: true, cleared: false };
  }

  const entries = Object.entries(input.secrets).filter(([, value]) => value.trim() !== '');

  if (entries.length === 0) {
    // Explicitly submitted and all blank: clear.
    const { error } = await admin
      .from('integrations')
      .update({
        provider: row.provider,
        enabled: row.enabled,
        config: row.config,
        secrets_ciphertext: null,
        updated_by: row.updated_by,
        updated_at: row.updated_at,
      })
      .eq('id', input.id);

    if (error) return { ok: false, message: error.message };
    return { ok: true, cleared: true };
  }

  if (!isEncryptionConfigured()) {
    return {
      ok: false,
      message:
        'SECRET_ENCRYPTION_KEY is not set, so credentials cannot be stored. Set it in the deployment environment first.',
    };
  }

  let ciphertext: string;
  try {
    ciphertext = encryptSecret(JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'could not encrypt the credentials',
    };
  }

  const { error } = await admin
    .from('integrations')
    .update({
      provider: row.provider,
      enabled: row.enabled,
      config: row.config,
      secrets_ciphertext: ciphertext,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
    })
    .eq('id', input.id);

  if (error) return { ok: false, message: error.message };
  return { ok: true, cleared: false };
}

/** Whether a secret is on file, without decrypting. Used to gate the send path. */
export async function hasStoredSecret(id: IntegrationId): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  if (!admin) return false;

  const { data } = await admin
    .from('integrations')
    .select('secrets_ciphertext')
    .eq('id', id)
    .maybeSingle<{ secrets_ciphertext: string | null }>();

  return Boolean(data?.secrets_ciphertext);
}
