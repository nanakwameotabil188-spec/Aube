import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

/**
 * Account root layout.
 *
 * Deliberately does nothing but set metadata. The gate lives in `(pages)` so
 * that `/account/login` and `/account/register` — which are how someone *gets*
 * a session — are not themselves behind one. Gating here would make the sign-in
 * form unreachable.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
