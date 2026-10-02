'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  registerCustomer,
  requestPasswordReset,
  resendVerificationEmail,
  signInCustomer,
  updatePassword,
  type AuthResult,
} from '@/lib/actions/customer-auth';

/**
 * Account forms.
 *
 * One module for all four because they are four variations on the same shape:
 * a labelled field list, a result message, and a submit button that reflects
 * its pending state. Splitting them would duplicate that three more times.
 *
 * Every action is a server action taking `FormData`, so none of this ships a
 * credential, a Supabase key or an auth call into the browser bundle.
 */

const inputClass =
  'mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2.5 text-sm outline-none focus:border-line-strong';

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-ink px-4 py-2.5 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Result({ state }: { state: AuthResult | null }) {
  if (!state) return null;
  return (
    <p
      // `status` rather than `alert`: a failed submit is a normal outcome of a
      // form, and interrupting a screen reader mid-entry is worse than polite.
      role="status"
      className={
        state.ok
          ? 'rounded-md border border-line bg-success-soft px-4 py-3 text-sm text-success'
          : 'rounded-md border border-line bg-danger-soft px-4 py-3 text-sm text-danger'
      }
    >
      {state.message}
    </p>
  );
}

function Field({
  id,
  label,
  type = 'text',
  autoComplete,
  hint,
  minLength,
  defaultValue,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  minLength?: number;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <input
        id={id}
        name={id}
        type={type}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthResult | null, FormData>(signInCustomer, null);
  const [resendState, resendAction] = useActionState<AuthResult | null, FormData>(
    resendVerificationEmail,
    null,
  );

  /*
   * Resend, shown only for an unconfirmed address.
   *
   * The alternative is making somebody who cannot sign in also go and find the
   * "forgotten password" page to ask for something that is not a password
   * problem. The button posts the address the failed attempt already used, so it
   * cannot be used to mail an arbitrary person.
   */
  const showResend = state?.needsVerification === true;
  const verified = resendState?.ok === true;

  return (
    <form action={action} className="mt-8 space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {/*
        The email is re-seeded from the failed attempt. React clears an
        uncontrolled form once the action returns, so without this a rejected
        password would also wipe the address and make the shopper start over.
      */}
      <Field id="email" label="Email address" type="email" autoComplete="username" defaultValue={state?.email} />
      <Field id="password" label="Password" type="password" autoComplete="current-password" />

      <Result state={state} />

      {showResend ? (
        <>
          <ResendButton address={state?.email ?? ''} action={resendAction} />
          <Result state={resendState} />
          {verified ? (
            <p className="text-sm text-muted">
              Once you have confirmed, <Link href="/account/login" className="underline underline-offset-4">sign in</Link>.
            </p>
          ) : null}
        </>
      ) : null}

      <Submit label="Sign in" pendingLabel="Signing in…" />

      <div className="flex flex-wrap justify-between gap-3 pt-1 text-sm">
        <Link href="/account/forgot-password" className="text-muted underline underline-offset-4 hover:text-ink">
          Forgotten your password?
        </Link>
        <Link href="/account/register" className="text-muted underline underline-offset-4 hover:text-ink">
          Create an account
        </Link>
      </div>
    </form>
  );
}

/**
 * Its own form, nested as a sibling rather than inside the sign-in form.
 *
 * HTML forbids nesting one form inside another, and the resend is a different
 * action with a different result, so sharing the sign-in `FormData` would post a
 * password field it has no business posting.
 */
function ResendButton({ address, action }: { address: string; action: (formData: FormData) => void }) {
  const { pending } = useFormStatus();

  if (!address) return null;

  return (
    <form action={action} className="rounded-md border border-line bg-sand px-4 py-3">
      <input type="hidden" name="email" value={address} />
      <p className="text-sm text-muted">
        Did not get the confirmation link? We can send it again.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 text-sm text-ink underline underline-offset-4 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Resend confirmation email'}
      </button>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthResult | null, FormData>(registerCustomer, null);
  // What the shopper typed before a rejected attempt. React clears the form
  // once the action returns, so without this a single validation slip would
  // discard their name and address as well.
  const retry = state?.retry;

  return (
    <form action={action} className="mt-8 space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="first_name"
          label="First name"
          autoComplete="given-name"
          defaultValue={retry?.firstName}
        />
        <Field
          id="last_name"
          label="Last name"
          autoComplete="family-name"
          defaultValue={retry?.lastName}
        />
      </div>

      <Field
        id="email"
        label="Email address"
        type="email"
        autoComplete="username"
        defaultValue={retry?.email}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        hint="At least 10 characters. A short phrase you will remember beats a complex one you will not."
      />
      <Field id="confirm_password" label="Confirm password" type="password" autoComplete="new-password" />

      <Result state={state} />

      <Submit label="Create account" pendingLabel="Creating…" />

      <p className="pt-1 text-sm">
        <span className="text-muted">Already have an account? </span>
        <Link href="/account/login" className="text-muted underline underline-offset-4 hover:text-ink">
          Sign in instead
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthResult | null, FormData>(requestPasswordReset, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field id="email" label="Email address" type="email" autoComplete="username" />
      <Result state={state} />

      <Submit label="Send reset link" pendingLabel="Sending…" />

      <p className="pt-1 text-sm">
        <Link href="/account/login" className="text-muted underline underline-offset-4 hover:text-ink">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/**
 * Set a new password from a reset link.
 *
 * The recovery material arrives in the URL fragment, which the browser keeps and
 * the server never receives, so it is read here and posted through the action.
 * It is a single-use, short-lived token that Supabase validates; this component
 * only carries it.
 */
export function ResetPasswordForm({
  tokenHash,
  accessToken,
  refreshToken,
}: {
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}) {
  const [state, action] = useActionState<AuthResult | null, FormData>(updatePassword, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      {tokenHash ? <input type="hidden" name="token_hash" value={tokenHash} /> : null}
      {accessToken ? <input type="hidden" name="access_token" value={accessToken} /> : null}
      {refreshToken ? <input type="hidden" name="refresh_token" value={refreshToken} /> : null}

      <Field
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        hint="At least 10 characters."
      />
      <Field id="confirm_password" label="Confirm new password" type="password" autoComplete="new-password" />

      <Result state={state} />

      <Submit label="Change password" pendingLabel="Changing…" />
    </form>
  );
}
