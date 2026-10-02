import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentService } from '@/lib/services/content-service';
import { ContentPageTemplate } from '@/components/content/ContentPageTemplate';
import { routes } from '@/lib/routes';
import { catalogMetadata } from '@/components/catalog/CatalogPage';

export async function generateMetadata(): Promise<Metadata> {
  const page = await contentService.getPage('contact');
  if (!page) return { title: 'Contact' };

  return catalogMetadata({
    title: page.seo.title,
    description: page.seo.description,
    path: routes.contact,
    image: page.heroImage?.url,
  });
}

export default async function ContactPage() {
  const page = await contentService.getPage('contact');
  if (!page) notFound();

  return <ContentPageTemplate page={page} crumbLabel="Contact" />;
}
