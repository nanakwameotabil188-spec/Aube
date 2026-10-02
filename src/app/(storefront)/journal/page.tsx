import type { Metadata } from 'next';
import Link from 'next/link';
import { contentService } from '@/lib/services/content-service';
import { routes } from '@/lib/routes';
import { formatDate } from '@/lib/utils/format';
import { Breadcrumbs } from '@/components/ui/states';
import { MediaImage } from '@/components/commerce/ProductGallery';
import { NewsletterForm } from '@/components/layout/NewsletterForm';
import { JsonLd, breadcrumbLd, itemListLd } from '@/lib/seo/structured-data';
import { catalogMetadata } from '@/components/catalog/CatalogPage';

export const metadata: Metadata = catalogMetadata({
  title: 'Journal',
  description:
    'Notes on formulation, skin biology and the unglamorous work of making a product that does what it claims.',
  path: routes.journal.index,
});


export default async function JournalIndexPage() {
  const posts = await contentService.getJournalPosts();
  const crumbs = [
    { label: 'Home', href: routes.home },
    { label: 'Journal' },
  ];

  const [lead, ...rest] = posts;

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd
        data={itemListLd(
          'Journal',
          posts.map((post) => ({ name: post.title, href: routes.journal.post(post.slug) })),
        )}
      />

      <div className="container-page py-10 sm:py-14">
        <Breadcrumbs items={crumbs} className="mb-10" />

        <header className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3">Journal</p>
          <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
            Notes from the formulation room
          </h1>
          <p className="mt-4 text-md leading-relaxed text-muted">
            Longer answers to the questions the product pages cannot hold: what an ingredient actually does at a given dose, and
            why some of it is worth the money.
          </p>
        </header>

        {lead && (
          <article className="mb-16 grid gap-8 border-b border-line pb-16 lg:grid-cols-2 lg:items-center lg:gap-14">
            <Link href={routes.journal.post(lead.slug)} className="group/lead block">
              <MediaImage
                image={lead.image}
                aspect="4/3"
                priority
                rounded="rounded-md"
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="transition-transform duration-500 ease-[var(--ease-soft)] group-hover/lead:scale-[1.02]"
              />
            </Link>
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-2 text-2xs uppercase tracking-[0.14em] text-muted">
                <span className="text-moss">Latest</span>
                <span aria-hidden className="text-line-strong">
                  ·
                </span>
                <span>{lead.readingTimeMinutes} min read</span>
              </p>
              <h2 className="font-display text-3xl leading-[1.15] text-ink sm:text-4xl">
                <Link href={routes.journal.post(lead.slug)} className="transition-colors hover:text-moss">
                  {lead.title}
                </Link>
              </h2>
              <p className="text-md leading-relaxed text-muted">{lead.excerpt}</p>
              <p className="text-sm text-muted-light">
                {lead.author} · {formatDate(lead.publishedAt)}
              </p>
            </div>
          </article>
        )}

        <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <li key={post.id}>
              <article className="group/post">
                <Link href={routes.journal.post(post.slug)} className="block">
                  <MediaImage
                    image={post.image}
                    aspect="4/3"
                    rounded="rounded-xs"
                    sizes="(min-width: 1024px) 30vw, 90vw"
                    className="transition-transform duration-500 ease-[var(--ease-soft)] group-hover/post:scale-[1.02]"
                  />
                </Link>
                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-2xs uppercase tracking-[0.14em] text-moss">{post.category.replace('-', ' ')}</p>
                  <h2 className="font-display text-xl leading-snug text-ink">
                    <Link href={routes.journal.post(post.slug)} className="transition-colors hover:text-moss">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-sm leading-relaxed text-muted">{post.excerpt}</p>
                  <p className="pt-1 text-xs text-muted-light">
                    {post.readingTimeMinutes} min read · {formatDate(post.publishedAt)}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>

        <div className="mt-24 border-t border-line pt-16">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">One letter a month</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Formulation notes, early access to new products, and the occasional correction. No more than that.
            </p>
            <div className="mt-8 text-left">
              <NewsletterForm incentive="15% off your first order" consentCopy="Unsubscribe in one click. We never share your details." />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

