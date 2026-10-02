import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentService } from '@/lib/services/content-service';
import { ContentPageTemplate } from '@/components/content/ContentPageTemplate';
import { routes } from '@/lib/routes';

type Params = { params: Promise<{ slug: string }> };

/**
 * Policy pages.
 *
 * All five share one route and one template. The slug is validated against the
 * content layer rather than a hand-maintained list, so a new policy only needs
 * a record.
 */
export async function generateStaticParams() {
  const pages = await contentService.getPages();
  return pages
    .filter((page) => ROUTES[page.slug])
    .map((page) => ({ slug: page.slug }));
}

/** Policy slug → public path. The content record is the source of the copy. */
const ROUTES: Record<string, string> = {
  shipping: routes.shipping,
  returns: routes.returns,
  privacy: routes.privacy,
  terms: routes.terms,
  accessibility: routes.accessibility,
};

const LABELS: Record<string, string> = {
  shipping: 'Shipping',
  returns: 'Returns',
  privacy: 'Privacy',
  terms: 'Terms',
  accessibility: 'Accessibility',
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await contentService.getPage(slug);
  if (!page || !ROUTES[slug]) return { title: 'Page not found' };

  return {
    title: page.seo.title,
    description: page.seo.description,
    ...(page.seo.noIndex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: ROUTES[slug] },
  };
}

export default async function PolicyPage({ params }: Params) {
  const { slug } = await params;
  const page = await contentService.getPage(slug);
  const label = LABELS[slug];
  if (!page || !ROUTES[slug] || !label) notFound();

  return <ContentPageTemplate page={page} crumbLabel={label} />;
}
