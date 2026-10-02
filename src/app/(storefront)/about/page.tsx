import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentService } from '@/lib/services/content-service';
import { ContentPageTemplate } from '@/components/content/ContentPageTemplate';
import { routes } from '@/lib/routes';
import { catalogMetadata } from '@/components/catalog/CatalogPage';

/**
 * About and contact.
 *
 * Both come from the same content records as the policies, so they share the
 * template and the metadata builder.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await contentService.getPage('about');
  if (!page) return { title: 'About' };

  return {
    ...catalogMetadata({
      title: page.seo.title,
      description: page.seo.description,
      path: routes.about,
      image: page.heroImage?.url,
    }),
    ...(page.seo.noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function AboutPage() {
  const page = await contentService.getPage('about');
  if (!page) notFound();

  return <ContentPageTemplate page={page} crumbLabel="About" />;
}
