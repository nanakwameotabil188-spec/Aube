import type { Metadata } from 'next';
import Link from 'next/link';
import { consumeVerificationToken } from '@/lib/supabase/email-verification';
import { routes } from '@/lib/routes';
import { LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

type Search = { token?: string | string[] };

/**
 * Consumes a signup confirmation token.
 *
 * ## Why this is a Server Component rather than a form
 *
 * The link is clicked once, from an email client, and there is nothing to
 * collect. Doing it on the server means one render, one lookup and one honest
 * answer — there is no pending state, no double-click risk, and no second visit
 * with a different result.
 *
 * ## No token echo
 *
 * The failure branch deliberately does not show the URL, and does not offer a
 * retry button that would resubmit an expired token. Somebody who lands here
 * because their client mangled the link is sent to the login page, where a fresh
 * one can be requested, rather than being told which part of the token was wrong.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = (await searchParams).token;
  const token = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');

  const result = token ? await consumeVerificationToken(token) : null;

  if (result?.ok) {
    return (
      <div className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-moss text-shell">
            <Icon name="check" size={24} aria-hidden />
          </span>
          <h1 className="mt-6 font-display text-3xl text-ink sm:text-4xl">Address confirmed</h1>
          <p className="mt-4 text-md leading-relaxed text-muted">
            Your account is ready. Sign in with the address you registered.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href={routes.account.login} size="lg">
              Sign in
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  const message =
    result?.message ?? 'That link is incomplete. Request a new confirmation email from the sign-in page.';

  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">We could not confirm that</h1>
        <p className="mt-4 text-md leading-relaxed text-muted">{message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href={routes.account.login} variant="secondary" size="lg">
            Back to sign in
          </LinkButton>
        </div>
        <p className="mt-6 text-sm text-muted">
          Still stuck?{' '}
          <Link href={routes.account.register} className="underline underline-offset-4">
            Register again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}