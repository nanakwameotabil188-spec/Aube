import type { Metadata } from 'next';
import { CatalogPage } from '@/components/catalog/CatalogPage';
import { pageMetadata } from '@/lib/seo/metadata';
import { contentService } from '@/lib/services/content-service';
import { routes } from '@/lib/routes';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await contentService.getSettings();
  return pageMetadata(settings, {
    title: 'Shop all',
    description: `The full ${settings.brandName} range: cleansers, essences, serums, moisturisers, sunscreens and tools. Every formula is built around a short ingredient list.`,
    path: routes.shop,
  });
}

export default function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <CatalogPage
      searchParams={searchParams}
      scope={{}}
      crumbs={[{ label: 'Home', href: routes.home }, { label: 'Shop' }]}
      header={{
        eyebrow: 'The range',
        title: 'Everything we make',
        description:
          'Twenty-eight products, no line extensions and nothing held back for a season. What is here is the whole range.',
      }}
    />
  );
}
