import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { skinConcernService } from '@/lib/services/catalog-service';
import { CatalogPage, catalogMetadata } from '@/components/catalog/CatalogPage';
import { routes } from '@/lib/routes';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const concerns = await skinConcernService.getAll();
  return concerns.map((concern) => ({ slug: concern.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const concern = await skinConcernService.getBySlug((await params).slug);
  if (!concern) return { title: 'Concern not found' };

  return catalogMetadata({
    title: `${concern.name} skincare`,
    description: concern.description || concern.shortDescription,
    path: routes.concern(concern.slug),
    image: concern.image?.url,
  });
}

export default async function ConcernPage({ params, searchParams }: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const concern = await skinConcernService.getBySlug(slug);
  if (!concern) notFound();

  return (
    <CatalogPage
      searchParams={searchParams}
      scope={{ skinConcernIds: [concern.id], perPage: 12 }}
      crumbs={[
        { label: 'Home', href: routes.home },
        { label: 'Concerns', href: routes.concerns },
        { label: concern.name },
      ]}
      header={{
        eyebrow: 'Skin concern',
        title: concern.name,
        description: concern.description || concern.shortDescription,
        image: concern.image,
        footer: concern.promise,
      }}
    />
  );
}
