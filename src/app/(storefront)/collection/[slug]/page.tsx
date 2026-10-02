import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { collectionService } from '@/lib/services/catalog-service';
import { CatalogPage, catalogMetadata } from '@/components/catalog/CatalogPage';
import { routes } from '@/lib/routes';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const collections = await collectionService.getAll();
  return collections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const collection = await collectionService.getBySlug((await params).slug);
  if (!collection) return { title: 'Collection not found' };

  return catalogMetadata({
    title: collection.name,
    description: collection.description || collection.story || collection.shortDescription,
    path: routes.collection(collection.slug),
    image: collection.image?.url,
  });
}

export default async function CollectionPage({ params, searchParams }: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const collection = await collectionService.getBySlug(slug);
  if (!collection) notFound();

  return (
    <CatalogPage
      searchParams={searchParams}
      scope={{ collectionIds: [collection.id], perPage: 12 }}
      crumbs={[
        { label: 'Home', href: routes.home },
        { label: 'Shop', href: routes.shop },
        { label: collection.name },
      ]}
      header={{
        eyebrow: 'Collection',
        title: collection.name,
        description: collection.shortDescription,
        image: collection.image,
        footer: collection.story,
      }}
    />
  );
}
