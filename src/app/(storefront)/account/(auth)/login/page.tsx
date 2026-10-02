import type { Metadata } from 'next';
import { SignInForm } from '@/components/account/AccountForms';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

type Search = { next?: string | string[] };

/**
 * Sign-in page.
 *
 * Outside the gated group, so it is reachable without a session. `next` is
 * passed through as a hidden field and validated inside the action against the
 * app's own route table — an unvalidated `next` is an open redirect.
 */
export default async function AccountLoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const value = (await searchParams).next;
  const next = Array.isArray(value) ? value[0] : value;

  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">Sign in</h1>
        <p className="mt-4 text-md leading-relaxed text-muted">
          Welcome back. Your orders and addresses are waiting.
        </p>

        <SignInForm next={next} />
      </div>
    </div>
  );
}
