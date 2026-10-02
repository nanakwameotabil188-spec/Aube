'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveEmailIntegration,
  savePaymentIntegration,
  testEmailConnection,
  type ActionResult,
} from '@/lib/actions/integrations';
import {
  providersFor,
  type IntegrationId,
  type IntegrationProvider,
} from '@/lib/integrations/providers';
// Type-only, so it is erased at compile time and the `server-only` module is
// never reached from the browser. The value side of that module stays server-side.
import type { IntegrationView } from '@/lib/supabase/integrations';
import { cn } from '@/lib/utils/cn';

/**
 * Provider configuration form.
 *
 * ## The secret fields are write-only, and the UI says so
 *
 * There is no code path that returns a stored credential to this component, so
 * each secret input renders empty with a mask above it. Two alternatives were
 * rejected: showing a masked value *in* the input (which looks editable and is
 * not — saving would silently write the mask) and round-tripping the real value
 * (which puts a live gateway key in the page HTML).
 *
 * Leaving every secret blank keeps what is stored. Saving with one field filled
 * replaces the whole secret set, because a partial merge would need the old
 * value decrypted to work at all.
 */

const inputClass =
  'mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm outline-none focus:border-line-strong';

function Submit({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-md bg-ink px-4 py-2 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-60',
        className,
      )}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={cn(
        'rounded-md border px-4 py-3 text-sm',
        state.ok
          ? 'border-line bg-success-soft text-success'
          : 'border-line bg-danger-soft text-danger',
      )}
    >
      {state.message}
    </p>
  );
}

function ProviderPicker({
  name,
  providers,
  selected,
  onSelect,
}: {
  name: string;
  providers: IntegrationProvider[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Provider">
      {providers.map((provider) => (
        <label
          key={provider.id}
          className={cn(
            'flex cursor-pointer gap-3 rounded-md border p-3 transition',
            selected === provider.id ? 'border-ink bg-shell ring-1 ring-ink' : 'border-line hover:bg-sand',
          )}
        >
          <input
            type="radio"
            name={name}
            value={provider.id}
            checked={selected === provider.id}
            onChange={() => onSelect(provider.id)}
            className="mt-1 size-4 shrink-0 accent-moss"
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{provider.label}</span>
              {provider.support === 'full' ? (
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">
                  Working
                </span>
              ) : provider.support === 'credentials-only' ? (
                <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-muted">
                  Keys stored only — checkout not wired up yet
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs text-muted">{provider.blurb}</span>
            {provider.docs ? (
              <a
                href={provider.docs}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-block text-xs underline underline-offset-4"
              >
                Where to find the keys
              </a>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}

function Field({
  label,
  name,
  hint,
  type = 'text',
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  hint?: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const id = `${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={inputClass}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

export function IntegrationForm({
  id,
  view,
  encryptionReady,
  encryptionMessage,
}: {
  id: IntegrationId;
  view: IntegrationView;
  encryptionReady: boolean;
  encryptionMessage: string;
}) {
  const providers = providersFor(id);
  const [provider, setProvider] = useState(view.provider || 'none');
  const [state, action] = useActionState<ActionResult | null, FormData>(
    id === 'payments' ? savePaymentIntegration : saveEmailIntegration,
    null,
  );

  const active =
    providers.find((p) => p.id === provider) ??
    // Both lists start with `none`, so this is unreachable in practice. The
    // fallback exists so a provider removed from the list in a later release
    // renders an empty form rather than crashing the page.
    { id: provider, label: provider, blurb: 'Unknown provider.', secrets: [], config: [], support: 'none' as const };

  const showSecrets = active.secrets.length > 0;
  const needsEncryption = showSecrets && !encryptionReady;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="enabled" value={view.enabled ? 'true' : 'false'} />

      <ProviderPicker name={`provider-picker-${id}`} providers={providers} selected={provider} onSelect={setProvider} />

      {active.support === 'credentials-only' ? (
        <p className="rounded-md border border-line bg-sand px-4 py-3 text-sm leading-relaxed text-muted">
          <strong className="font-medium text-ink">Stored, but not yet taking payments.</strong> You can
          paste {active.label} credentials now and they will be encrypted and kept ready. The checkout
          flow that would charge a card is not implemented yet, so until it is, orders are recorded
          without money being taken and checkout says so plainly.
        </p>
      ) : null}

      {active.config.length > 0 ? (
        <fieldset className="space-y-3 rounded-md border border-line bg-shell p-4">
          <legend className="px-1 text-sm font-semibold">Settings</legend>
          {active.config.map((field) => (
            <Field
              key={field.key}
              name={`config_${field.key}`}
              label={field.label}
              hint={field.hint}
              defaultValue={view.config[field.key] ?? ''}
            />
          ))}
        </fieldset>
      ) : null}

      {showSecrets ? (
        <fieldset className="space-y-4 rounded-md border border-line bg-shell p-4">
          <legend className="px-1 text-sm font-semibold">Credentials</legend>

          <div className="rounded-md border border-line bg-porcelain px-3 py-2.5 text-xs leading-relaxed text-muted">
            <p>
              Saved credentials are <strong className="font-medium text-ink">encrypted</strong> and can
              never be read back — not by you, not by this app. The panel shows a masked fingerprint so
              you can tell which key is stored.
            </p>
            <p className="mt-1.5">
              Leave every field blank to keep what is already stored. Filling any field replaces the
              whole set, which is what you want when rotating a key.
            </p>
          </div>

          {view.unreadable ? (
            <p className="rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger">
              The stored credentials cannot be read: {view.unreadableReason}. Replace them below, or
              clear them by saving with every field blank.
            </p>
          ) : null}

          {Object.keys(view.secretMasks).length > 0 ? (
            <dl className="space-y-1">
              {Object.entries(view.secretMasks).map(([key, mask]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <dt className="font-medium text-ink">{key}</dt>
                  <dd className="font-mono text-muted">{mask}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {!encryptionReady ? (
            <p className="rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger">
              {encryptionMessage}
            </p>
          ) : null}

          {active.secrets.map((field) => (
            <Field
              key={field.key}
              name={`secret_${field.key}`}
              label={field.label}
              hint={field.hint}
              // `password` rather than `text`: it keeps the value out of a
              // screen recording and out of browser autofill, both of which are
              // likely when pasting a key.
              type="password"
            />
          ))}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Submit
          label="Save"
          pendingLabel="Saving…"
          className={cn(needsEncryption && 'opacity-60')}
        />
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** "Test connection" lives in its own form so it never posts the saved config. */
export function TestEmailConnectionForm({ provider }: { provider: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    testEmailConnection,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="provider" value={provider} />
      <div className="min-w-[18rem] flex-1">
        <label htmlFor="test_api_key" className="block text-sm font-medium">
          API key to test
        </label>
        <p className="mt-0.5 text-xs text-muted">
          Paste the key to check. Leave blank to test what is already stored. Nothing is saved.
        </p>
        <input
          id="test_api_key"
          name="secret_api_key"
          type="password"
          className={inputClass}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <Submit label="Test connection" pendingLabel="Testing…" />
      <Feedback state={state} />
    </form>
  );
}