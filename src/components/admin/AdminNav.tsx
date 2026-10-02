'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const LINKS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/homepage', label: 'Homepage' },
  { href: '/admin/onboarding', label: 'Intro' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/media', label: 'Media' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/subscribers', label: 'Subscribers' },
  { href: '/admin/messaging', label: 'Messaging' },
  { href: '/admin/email', label: 'Email' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/settings', label: 'Branding' },
];

/** Highlights the section matching the current path. Client-only for `usePathname`. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex flex-wrap gap-x-5 gap-y-1">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded text-sm transition-colors',
              active ? 'font-medium text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
