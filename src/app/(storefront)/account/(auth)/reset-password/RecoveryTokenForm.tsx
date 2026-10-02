'use client';

import { useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/components/account/AccountForms';

/**
 * Hands the recovery material to the password form.
 *
 * Reads two places, because Supabase uses two depending on the project's auth
 * settings:
 *
 *  * the query string, for a PKCE link (`token_hash` + `type=recovery`);
 *  * the fragment, for an implicit link (`access_token` / `refresh_token`).
 *
 * The fragment is read through `useSyncExternalStore` rather than an effect. The
 * URL is a genuine external system — it can change without a re-render, via
 * `hashchange` or a back button — so this is the case the hook exists for, and
 * it avoids the cascading render an effect plus state would cause.
 *
 * Reading it in the browser is also the point: a page that took the token from
 * the query string would put a live credential in the access log, in the
 * `Referer` header of the next navigation, and in any analytics script on the
 * site.
 */

interface FragmentTokens {
  accessToken: string;
  refreshToken: string;
}

const EMPTY: FragmentTokens | null = null;

function readFragment(): FragmentTokens | null {
  if (typeof window === 'undefined') return EMPTY;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  return accessToken && refreshToken ? { accessToken, refreshToken } : EMPTY;
}

/** Fires on `hashchange`; the fragment is the only part of the URL that matters. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function RecoveryTokenForm() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  const fragment = useSyncExternalStore(subscribe, readFragment, () => EMPTY);

  /*
   * A `token_hash` is only valid for the type it was issued for. A link minted
   * for a signup confirmation must not be accepted here to set a password, so
   * the type is checked rather than assumed.
   */
  const usableHash = tokenHash && (type === 'recovery' || type === null) ? tokenHash : null;

  if (!usableHash && !fragment) {
    return (
      <div className="mt-8 space-y-4">
        <p role="alert" className="rounded-md border border-line bg-danger-soft px-4 py-3 text-sm text-danger">
          That reset link is incomplete or has already been used. Request a new one and open it directly
          from the email.
        </p>
        <a
          href="/account/forgot-password"
          className="inline-block text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          Request a new link
        </a>
      </div>
    );
  }

  return (
    <ResetPasswordForm
      tokenHash={usableHash}
      accessToken={fragment?.accessToken ?? null}
      refreshToken={fragment?.refreshToken ?? null}
    />
  );
}
