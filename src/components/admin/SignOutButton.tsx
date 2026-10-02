'use client';

import { useFormStatus } from 'react-dom';
import { signOut } from '@/lib/actions/auth';

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:bg-sand hover:text-ink disabled:opacity-60"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

/** A form, not a link: signing out has to clear the cookie server-side. */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button />
    </form>
  );
}
