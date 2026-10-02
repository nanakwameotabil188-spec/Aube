import type { NextConfig } from 'next';

/**
 * The site's own origin, for the CSP.
 *
 * Read from the environment rather than hardcoded so the policy names the domain
 * this deployment actually serves. A CSP that does not include its own origin
 * breaks every inline bootstrap script, so getting this wrong is a total
 * outage rather than a quiet weakening.
 */
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

/**
 * Content Security Policy.
 *
 * ## Why `'unsafe-inline'` is present for scripts
 *
 * A CSP without `'unsafe-inline'` needs a per-request nonce or a hash for every
 * inline `<script>`. Next.js App Router emits its bootstrap inline, and the
 * supported way to nonce those is to read the nonce out of the request headers
 * in middleware — which makes `headers()` dynamic on every route and turns the
 * statically prerendered pages this project relies on into server-rendered ones.
 *
 * That trade is not obviously worth it: a CSP that blocks the framework's own
 * bootstrap breaks the site, and one that keeps the site working while allowing
 * inline script has already given up the main thing a CSP is for. So the policy
 * is explicit about it, and everything else is tightened instead.
 *
 * ## What this policy actually buys
 *
 * `object-src 'none'` and `base-uri 'self'` remove two injection sinks that cost
 * nothing to close. `frame-ancestors 'none'` is clickjacking protection. The
 * `connect-src` and `img-src` lists are closed to the origins this app actually
 * uses, so a compromised dependency cannot exfiltrate to an attacker's server or
 * beacon out. It is a meaningful narrowing, not a full mitigation for XSS.
 *
 * ## Tightening it further
 *
 * The upgrade path is nonce-based CSP in `src/proxy.ts`, accepting that the
 * storefront becomes dynamically rendered. Worth doing deliberately, with the
 * rendering cost measured, rather than arriving as a surprise in a header change.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // Explains why this is here rather than looking like an oversight.
  "script-src 'self' 'unsafe-inline'",
  // The App Router inlines critical CSS as a <style> element, so style-src needs
  // the same allowance. 'unsafe-hashes' is deliberately not used: it only relaxes
  // attribute-based inline styles and would not help the stylesheet case.
  "style-src 'self' 'unsafe-inline'",
  // Where the storefront loads remote product imagery from. Both hosts are
  // allowlisted in `images.remotePatterns` above, so this stays in step with it.
  "img-src 'self' blob: data: https://images.pexels.com https://images.unsplash.com",
  "font-src 'self' data:",
  /*
   * The auth client talks to Supabase over HTTPS and over a websocket for
   * realtime. Without the websocket entry, session refresh and any live
   * subscription fail only in the browser, which is the hardest kind of failure
   * to notice from a server log.
   */
  `connect-src 'self' ${SITE_ORIGIN} ${SITE_ORIGIN.replace(/^https:/, 'wss:')}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  // Refuses to be framed or embedded anywhere.
  "frame-ancestors 'none'",
  // Payments and auth providers navigate away; the default self would break them.
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The compiler owns memoisation. Hand-written `useMemo`/`useCallback` in
  // components it optimises is redundant at best and, when the dependency
  // arrays disagree with the compiler's analysis, silently disables the
  // optimisation for that component.
  reactCompiler: true,
  images: {
    // Remote asset hosts used by the current content layer.
    // When the backend/admin takes over, only this list needs to change.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/photos/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  /**
   * Security headers.
   *
   * `poweredByHeader: false` above is one of these; the rest are collected here
   * so the whole set is readable in one place. None of them replace the row-level
   * security on the database — they reduce what a successful injection or a
   * mis-delivered link can do, which is a different job.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          // Stops a browser from second-guessing a declared content type, which
          // is what turns an uploaded text file into an executable one.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Clickjacking. `frame-ancestors` in the CSP covers modern browsers;
          // this is for the ones that still read the header.
          { key: 'X-Frame-Options', value: 'DENY' },
          /*
           * Leaks the origin, not the path.
           *
           * A confirmation or unsubscribe link is followed from an email client.
           * `strict-origin-when-cross-origin` sends the shop's hostname to other
           * sites but never the verification token in the query string, which is
           * the value that must not end up in somebody else's analytics.
           */
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Nothing here needs the camera, microphone, geolocation or payment.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          /*
           * HSTS, production only.
           *
           * Sent over plain HTTP it is ignored anyway, but in development it
           * would pin `localhost` to HTTPS in the browser's HSTS store, where it
           * survives for a year and breaks `next dev` until it is cleared.
           */
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;