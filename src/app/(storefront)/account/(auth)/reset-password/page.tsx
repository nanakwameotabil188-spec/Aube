import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RecoveryTokenForm } from './RecoveryTokenForm';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

/**
 * Password reset landing page.
 *
 * ## Why the token is read in the browser
 *
 * Supabase sends recovery links in the URL *fragment* — `#access_token=…` — or,
 * under PKCE, a `token_hash` in the query. The fragment is never transmitted to
 * a server, so the token has to be read client-side and posted to the action.
 *
 * A page that read it from the query string would put a live credential in the
 * access log, the `Referer` header sent to any third-party asset on the next
 * navigation, and any analytics script on the site. Reading the fragment is the
 * reason this is a client component inside a `Suspense` boundary.
 */
export default function ResetPasswordPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">Choose a new password</h1>
        <p className="mt-4 text-md leading-relaxed text-muted">
          Pick something you will remember. At least 10 characters.
        </p>

        <Suspense fallback={null}>
          <RecoveryTokenForm />
        </Suspense>
      </div>
    </div>
  );
}
