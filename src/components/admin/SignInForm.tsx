'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, type SignInResult } from '@/lib/actions/auth';

/** Email and password only. An access token pasted into a form is a bad habit. */

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-ink px-4 py-2.5 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-60"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function SignInForm() {
  const [state, action] = useActionState<SignInResult | null, FormData>(signIn, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2.5 text-sm outline-none focus:border-line-strong"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2.5 text-sm outline-none focus:border-line-strong"
        />
      </div>

      {state && !state.ok ? (
        <p role="alert" className="rounded-md border border-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
