/**
 * Provider catalogue — pure data, no server imports.
 *
 * Kept separate from `src/lib/supabase/integrations.ts` because the admin form
 * is a client component and needs the provider list to render. That module
 * imports `createAdminSupabaseClient`, which imports `server-only`, so importing
 * the catalogue from there pulls a server-only module into the browser bundle and
 * the build fails.
 *
 * Nothing here touches the database or the environment, so it is safe on both
 * sides. The shape of a secret is not a secret.
 */

export type IntegrationId = 'payments' | 'email';

export interface IntegrationSecretSpec {
  /** Field name in the stored secret object. */
  key: string;
  label: string;
  hint?: string;
  /** Providers where this secret is not needed. */
  optionalFor?: string[];
}

export interface IntegrationProvider {
  id: string;
  label: string;
  /** What this provider is, in one line, for the picker. */
  blurb: string;
  /** Documentation link. Shown so nobody has to guess the dashboard URL. */
  docs?: string;
  /** Secret fields this provider needs. */
  secrets: IntegrationSecretSpec[];
  /** Non-secret config fields. */
  config: IntegrationSecretSpec[];
  /**
   * How much of this provider the app actually implements.
   *
   * `'full'` — checkout/send works end to end.
   * `'credentials-only'` — credentials can be stored now and are ready, but the
   *   live flow is not implemented yet. Stated in the picker so an operator is
   *   not left believing a stored Stripe key means the shop can take money,
   *   which is the specific misunderstanding this project cares about avoiding.
   * `'none'` — no integration at all.
   */
  support: 'full' | 'credentials-only' | 'none';
  /**
   * Whether an order placed through this provider actually takes money.
   *
   * Separate from `support`, and deliberately so. `manual` is `'full'` — the shop
   * genuinely supports bank transfer end to end — and still takes no card at
   * checkout. An order placed through it is awaiting payment, not paid, and
   * conflating the two is what makes an unpaid order read like a settled one.
   *
   * Every payment provider is `false` today, which is the honest state of the
   * codebase: no gateway charge is implemented. The order row's status and
   * payment label are both derived from this, so the first provider that can
   * actually charge is a one-line change here rather than an audit of every
   * place an order status is set.
   *
   * Only meaningful for payments; email providers never move money.
   */
  collectsPayment?: boolean;
}

/**
 * Payment providers.
 *
 * `none` is a real option rather than an empty state: it is what makes "do not
 * take payments" selectable and visible, instead of something an operator
 * achieves by leaving the row broken.
 */
export const PAYMENT_PROVIDERS: IntegrationProvider[] = [
  {
    id: 'none',
    label: 'Not configured',
    blurb:
      'No payment gateway. Checkout will refuse to take an order rather than pretend one went through.',
    secrets: [],
    config: [],
    support: 'none',
    collectsPayment: false,
  },
  {
    id: 'manual',
    label: 'Manual — bank transfer',
    blurb:
      'Orders are placed as awaiting payment and marked paid by hand once the transfer clears. Nothing is charged automatically and no card is ever collected.',
    secrets: [],
    config: [],
    support: 'full',
    collectsPayment: false,
  },
  {
    id: 'stripe',
    label: 'Stripe',
    blurb:
      'Stored here so the keys are ready. The live charge flow is not implemented yet, so checkout will not take money until it is.',
    docs: 'https://dashboard.stripe.com/apikeys',
    secrets: [
      {
        key: 'secret_key',
        label: 'Secret key',
        hint: 'sk_live_… or sk_test_… from Developers → API keys. Read-only, shown once.',
      },
      {
        key: 'publishable_key',
        label: 'Publishable key',
        hint: 'pk_live_… Safe to publish; needed for Stripe.js.',
      },
      {
        key: 'webhook_secret',
        label: 'Webhook signing secret',
        hint: 'From the webhook endpoint you create. Without it, payment callbacks cannot be verified.',
      },
    ],
    config: [],
    support: 'credentials-only',
    collectsPayment: false,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    blurb: 'Stored here so the keys are ready. The live checkout redirect is not implemented yet.',
    docs: 'https://developer.paypal.com/dashboard/applications',
    secrets: [
      { key: 'client_id', label: 'Client ID' },
      { key: 'client_secret', label: 'Client secret' },
      { key: 'webhook_id', label: 'Webhook ID' },
    ],
    config: [],
    support: 'credentials-only',
    collectsPayment: false,
  },
  {
    id: 'razorpay',
    label: 'Razorpay',
    blurb: 'Stored here so the keys are ready. The live charge flow is not implemented yet.',
    docs: 'https://dashboard.razorpay.com/app/keys',
    secrets: [
      { key: 'key_id', label: 'Key ID' },
      { key: 'key_secret', label: 'Key secret' },
      { key: 'webhook_secret', label: 'Webhook secret' },
    ],
    config: [],
    support: 'credentials-only',
    collectsPayment: false,
  },
];

export const EMAIL_PROVIDERS: IntegrationProvider[] = [
  {
    id: 'none',
    label: 'Not configured',
    blurb: 'No email is sent. Every attempt is logged as skipped so the gap stays visible.',
    secrets: [],
    config: [],
    support: 'none',
  },
  {
    id: 'console',
    label: 'Log only',
    blurb:
      'Writes the rendered email to the server log instead of sending it. Nothing leaves the machine — useful for checking templates before you have a provider.',
    secrets: [],
    config: [],
    support: 'full',
  },
  {
    id: 'resend',
    label: 'Resend',
    blurb: 'Simple transactional API with good deliverability defaults.',
    docs: 'https://resend.com/api-keys',
    secrets: [{ key: 'api_key', label: 'API key', hint: 're_…' }],
    config: [{ key: 'from_email', label: 'From address', hint: 'orders@yourdomain.com' }],
    support: 'full',
  },
  {
    id: 'postmark',
    label: 'Postmark',
    blurb: 'Transactional email with per-message tagging and delivery stats.',
    docs: 'https://postmarkapp.com/developer/api/account-api',
    secrets: [{ key: 'api_token', label: 'Server API token' }],
    config: [{ key: 'from_email', label: 'From address', hint: 'orders@yourdomain.com' }],
    support: 'full',
  },
];

export function providersFor(id: IntegrationId): IntegrationProvider[] {
  return id === 'payments' ? PAYMENT_PROVIDERS : EMAIL_PROVIDERS;
}