'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

/**
 * Account navigation.
 *
 * A client component only because "which tab am I on" depends on the pathname,
 * which a server layout cannot read. The links themselves are ordinary `Link`s,
 * so this costs no more than the one value it needs.
 */
export function AccountNavTabs({
  tabs,
}: {
  tabs: { href: string; label: string; exact: boolean }[];
}) {
  const pathname = usePathname();

  return (
    <ul className="-mb-px flex flex-wrap gap-6">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

        return (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-block border-b-2 pb-3 text-sm transition-colors',
                active
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {tab.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
