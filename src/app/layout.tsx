import type { Metadata, Viewport } from 'next';
import './globals.css';
import { fontVariables } from './fonts';

/**
 * Root layout.
 *
 * Deliberately thin: just the document, the typefaces, and the stylesheet. The
 * storefront header, footer, cart drawer, and the nine service calls behind
 * them live in the `(storefront)` group layout, so the admin panel does not
 * inherit shopper chrome or pay to resolve navigation it never renders.
 */

export const metadata: Metadata = {
  /**
   * A fixed URL that redirects to whatever icon the admin has chosen.
   *
   * Pointing metadata straight at the stored image would work too, but the
   * root layout would then have to read brand settings — and it is
   * intentionally free of service calls. The redirect keeps this layout
   * stateless and lets the icon change without a rebuild.
   */
  icons: {
    icon: [{ url: '/branding/favicon' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1a17' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
