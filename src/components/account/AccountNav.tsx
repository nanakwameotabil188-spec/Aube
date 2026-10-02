import type { ReactNode } from 'react';
import { getAccountSession } from '@/lib/supabase/account';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { AccountNavTabs } from './AccountNavTabs';

const TABS = [
  { href: routes.account.root, label: 'Overview', exact: true },
  { href: routes.account.orders, label: 'Orders', exact: false },
  { href: routes.account.profile, label: 'Details', exact: false },
];

/**
 * Signed-in account chrome.
 *
 * Reads the session on the server so the sign-out control is a real form action
 * and a signed-out visitor never sees a nav pointing at pages they cannot open.
 */
export async function AccountNav({
  children,
  bell,
}: {
  children: ReactNode;
  /** Rendered at the right-hand end of the tab strip. Omitted when signed out. */
  bell?: ReactNode;
}) {
  const session = await getAccountSession();

  if (!session) {
    return (
      <div className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-sand text-moss">
            <Icon name="user" size={24} aria-hidden />
          </span>
          <h1 className="mt-6 font-display text-3xl text-ink sm:text-4xl">Sign in to your account</h1>
          <p className="mt-4 text-md leading-relaxed text-muted">
            Orders, addresses and your details live here. You can always check out as a guest — an account
            is only for keeping track afterwards.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={routes.account.login}
              className="rounded-md bg-ink px-5 py-2.5 text-sm text-porcelain transition-colors hover:bg-ink-soft"
            >
              Sign in
            </a>
            <a
              href={routes.account.register}
              className="rounded-md border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-line-strong"
            >
              Create an account
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container-page py-12 sm:py-16">
        <div className="mb-10 flex items-start justify-between gap-4 border-b border-line">
          <nav aria-label="Account">
            <AccountNavTabs tabs={TABS} />
          </nav>
          {bell ? <div className="shrink-0 pt-3">{bell}</div> : null}
        </div>
        {children}
      </div>
    </>
  );
}

/** Shared heading, so every account page reads as the same section. */
export function AccountHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
      {intro ? <p className="mt-3 max-w-prose text-md leading-relaxed text-muted">{intro}</p> : null}
    </header>
  );
}

export { cn };
