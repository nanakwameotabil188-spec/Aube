import Link from 'next/link';
import type { TaxonomyTerm } from '@/types';
import { routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { Breadcrumbs } from '@/components/ui/states';
import { MediaImage } from '@/components/commerce/ProductGallery';
import { JsonLd, SITE_URL, breadcrumbLd, itemListLd } from '@/lib/seo/structured-data';

/**
 * Taxonomy index.
 *
 * Shared by `/concerns`, `/skin-types` and `/ingredients`: three pages with
 * one job — introduce the terms, then link into the filtered listing each one
 * owns. Adding a taxonomy means adding a route that calls this, not another
 * near-identical template.
 */
export function TermIndex({
  eyebrow,
  title,
  description,
  crumb,
  buildHref,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** The index page's own label and path, also the parent of every term page. */
  crumb: { label: string; href: string };
  /**
   * Where a term's own page lives. Passed in rather than derived from
   * `crumb.href`: every taxonomy index is plural (`/skin-types`) while its term
   * route is singular (`/skin-type/[slug]`), so concatenating the slug onto the
   * index path produced a 404 for every tile on the page.
   */
  buildHref: (slug: string) => string;
  items: (TaxonomyTerm & { note?: string })[];
}) {
  const crumbs = [
    { label: 'Home', href: routes.home },
    { label: crumb.label, href: crumb.href },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd
        data={itemListLd(
          title,
          items.map((item) => ({ name: item.name, href: `${SITE_URL}${buildHref(item.slug)}` })),
        )}
      />

      <div className="container-page py-10 sm:py-16">
        <Breadcrumbs items={crumbs} className="mb-10" />

        <header className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">{title}</h1>
          <p className="mt-4 text-md leading-relaxed text-muted">{description}</p>
        </header>

        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.slug}>
              <Link href={buildHref(item.slug)} className="group/tile flex h-full flex-col">
                {item.image && (
                  <MediaImage
                    image={item.image}
                    aspect="4/3"
                    rounded="rounded-xs"
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    className="transition-transform duration-500 ease-[var(--ease-soft)] group-hover/tile:scale-[1.02]"
                  />
                )}
                <div className="mt-4 flex flex-1 flex-col gap-2 border-t border-line pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl leading-snug text-ink transition-colors group-hover/tile:text-moss">
                      {item.name}
                    </h2>
                    {item.icon && <Icon name={item.icon} size={18} aria-hidden className="mt-1 shrink-0 text-moss" />}
                  </div>
                  <p className="text-sm leading-relaxed text-muted">{item.shortDescription}</p>
                  {item.note && <p className="mt-auto pt-3 text-xs italic text-muted-light">{item.note}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
