import 'server-only';
import { headers } from 'next/headers';

/**
 * The site's own origin, for links that get emailed.
 *
 * ## Why one function
 *
 * This was written three times with three different fallbacks: the auth actions
 * trusted the `Host` header, the broadcast footer produced an empty string, and
 * the SEO helpers defaulted to a fictional `https://aube.com`. An emailed
 * confirmation link and an unsubscribe link that disagree about the domain are
 * both a broken link and a phishing signal, so the three paths now share one
 * answer.
 *
 * ## The `Host` header is only a last resort
 *
 * It is supplied by the caller. Trusting it in production would let an attacker
 * request a password-reset email and have the link point at a domain they
 * control, while the mail still arrived carrying this shop's name. So a
 * configured `NEXT_PUBLIC_SITE_URL` always wins, and the header is consulted only
 * when nothing is configured — which in practice means local development.
 *
 * Returns `null` rather than an empty string when neither is available, so a
 * caller has to decide what to do about a missing link base instead of silently
 * mailing somebody a relative URL.
 */
export async function siteOrigin(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  if (!host) return null;

  const protocol =
    headerList.get('x-forwarded-proto') ??
    // A host without a protocol is only meaningful behind TLS in production.
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');

  return `${protocol}://${host}`;
}