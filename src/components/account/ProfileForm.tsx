'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signOutCustomer, updateProfile, type AuthResult } from '@/lib/actions/customer-auth';

/** Profile editing and sign-out. Both post to server actions. */

const inputClass =
  'mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2.5 text-sm outline-none focus:border-line-strong';

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-ink px-4 py-2.5 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ProfileForm({
  firstName,
  lastName,
  phone,
  email,
  emailConfirmed,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  emailConfirmed: boolean;
}) {
  const [state, action] = useActionState<AuthResult | null, FormData>(updateProfile, null);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="first_name" className="block text-sm font-medium text-ink">
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            defaultValue={firstName}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="last_name" className="block text-sm font-medium text-ink">
            Last name
          </label>
          <input
            id="last_name"
            name="last_name"
            autoComplete="family-name"
            defaultValue={lastName}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-ink">
          Phone
        </label>
        <p className="mt-0.5 text-xs text-muted">Only used if the courier needs to reach you.</p>
        <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={phone} className={inputClass} />
      </div>

      {/*
        The email is the account identity, so it is shown and not editable here.
        Changing it is an authentication concern — it needs re-verification at the
        new address — not a profile field, and offering an input that silently
        does nothing would be worse than saying so.
      */}
      <div>
        <span className="block text-sm font-medium text-ink">Email address</span>
        <p className="mt-0.5 text-sm text-muted">{email}</p>
        {emailConfirmed ? null : (
          <p className="mt-1 text-xs text-muted">
            Not yet confirmed. Order confirmations and password resets go to this address, so it is worth
            confirming.
          </p>
        )}
      </div>

      {state ? (
        <p
          role="status"
          className={
            state.ok
              ? 'rounded-md border border-line bg-success-soft px-4 py-3 text-sm text-success'
              : 'rounded-md border border-line bg-danger-soft px-4 py-3 text-sm text-danger'
          }
        >
          {state.message}
        </p>
      ) : null}

      <Submit label="Save details" pendingLabel="Saving…" />
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutCustomer}>
      <Submit label="Sign out" pendingLabel="Signing out…" />
    </form>
  );
}
