import Link from 'next/link';
import type { FooterColumn, NavLink, StoreSettings } from '@/types';
import { cn } from '@/lib/utils/cn';
import { routes } from '@/lib/routes';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Wordmark } from './Wordmark';

/**
 * Footer.
 *
 * Columns, social links and the value props are all content records.
 * Reordering a footer column is a data operation.
 *
 * There is deliberately no signup form here. The footer form used to repeat the
 * promotional "15% off" capture that the homepage newsletter section already
 * carries, so a visitor landing on any page saw two competing forms. The
 * homepage section is the single capture point; this file only links to it.
 */

export interface FooterValueProp {
  id: string;
  icon: IconName;
  title: string;
  body: string;
}

const SOCIAL_ICONS: Record<string, IconName> = {
  Instagram: 'instagram',
  TikTok: 'instagram',
  YouTube: 'instagram',
  Pinterest: 'instagram',
};

export function Footer({
  settings,
  columns,
  valueProps,
  concernLinks,
  skinTypeLinks,
}: {
  settings: StoreSettings;
  columns: FooterColumn[];
  valueProps: FooterValueProp[];
  concernLinks: NavLink[];
  skinTypeLinks: NavLink[];
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-sand">
      <div className="border-b border-line">
        <div className="container-page grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {valueProps.map((prop) => (
            <div key={prop.id} className="flex gap-3.5">
              <Icon name={prop.icon} size={20} aria-hidden className="mt-0.5 shrink-0 text-moss" />
              <div>
                <p className="text-sm font-medium text-ink">{prop.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{prop.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.1fr_2fr] lg:gap-16">
        <div className="flex max-w-md flex-col gap-6">
          <div>
            <Link href={routes.home} className="inline-block" aria-label={`${settings.brandName} — home`}>
              <Wordmark name={settings.brandName} logo={settings.logo} />
            </Link>
            <p className="mt-4 text-base leading-relaxed text-muted">{settings.tagline}</p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <a href={`mailto:${settings.supportEmail}`} className="w-fit text-ink transition-colors hover:text-moss">
              {settings.supportEmail}
            </a>
            <a
              href={`tel:${settings.supportPhone.replace(/[^\d+]/g, '')}`}
              className="w-fit text-ink transition-colors hover:text-moss"
            >
              {settings.supportPhone}
            </a>
            <p className="text-xs leading-relaxed text-muted">Monday to Friday, 9am–5pm PT</p>
            {/* Shown only once the admin supplies one; a placeholder address
                would be worse than no address. */}
            {settings.address && (
              <address className="mt-1 not-italic text-xs leading-relaxed text-muted">
                {settings.address}
              </address>
            )}
          </div>

          <ul className="flex items-center gap-2">
            {settings.social.map((social) => (
              <li key={social.id}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${settings.brandName} on ${social.label}`}
                  className="grid size-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink hover:bg-ink hover:text-shell"
                >
                  <Icon name={SOCIAL_ICONS[social.label] ?? 'arrow-right'} size={16} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {columns.map((column) => (
            <nav key={column.id} aria-labelledby={`footer-${column.id}`}>
              <h2 id={`footer-${column.id}`} className="eyebrow mb-4">
                {column.heading}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {column.links
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((link) => (
                    <li key={link.id}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-6 py-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <TaxonomyLinks heading="Shop by concern" links={concernLinks} />
            <TaxonomyLinks heading="Shop by skin type" links={skinTypeLinks} />
            <div>
              <h2 className="eyebrow mb-4">We accept</h2>
              <ul className="flex flex-wrap gap-1.5">
                {settings.payments
                  .filter((method) => method.enabled)
                  .map((method) => (
                    <li
                      key={method.id}
                      className="rounded-xs border border-line bg-shell px-2.5 py-1.5 text-2xs uppercase tracking-[0.1em] text-muted"
                    >
                      {method.label}
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              &copy; {year} {settings.legalName}. All rights reserved.
            </p>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[
                { href: routes.privacy, label: 'Privacy' },
                { href: routes.terms, label: 'Terms' },
                { href: routes.accessibility, label: 'Accessibility' },
                { href: routes.returns, label: 'Returns' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-muted transition-colors hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

function TaxonomyLinks({ heading, links }: { heading: string; links: NavLink[] }) {
  if (links.length === 0) return null;
  return (
    <nav aria-labelledby={`footer-taxonomy-${heading.replace(/\s+/g, '-').toLowerCase()}`}>
      <h2
        id={`footer-taxonomy-${heading.replace(/\s+/g, '-').toLowerCase()}`}
        className="eyebrow mb-4"
      >
        {heading}
      </h2>
      <ul className="flex flex-col gap-2">
        {links.slice(0, 6).map((link) => (
          <li key={link.id}>
            <Link href={link.href} className="text-sm text-muted transition-colors hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Compact band used above the footer on narrower layouts. */
export function FooterNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('border-t border-line py-6 text-xs leading-relaxed text-muted', className)}>{children}</div>;
}
