import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { skinTypeService } from '@/lib/services/catalog-service';
import { CatalogPage, catalogMetadata } from '@/components/catalog/CatalogPage';
import { routes } from '@/lib/routes';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const types = await skinTypeService.getAll();
  return types.map((type) => ({ slug: type.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const skinType = await skinTypeService.getBySlug((await params).slug);
  if (!skinType) return { title: 'Skin type not found' };

  return catalogMetadata({
    title: `Products for ${skinType.name.toLowerCase()} skin`,
    description: skinType.description || skinType.shortDescription,
    path: routes.skinType(skinType.slug),
    image: skinType.image?.url,
  });
}

export default async function SkinTypePage({ params, searchParams }: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const skinType = await skinTypeService.getBySlug(slug);
  if (!skinType) notFound();

  return (
    <CatalogPage
      searchParams={searchParams}
      scope={{ skinTypeIds: [skinType.id], perPage: 12 }}
      crumbs={[
        { label: 'Home', href: routes.home },
        { label: 'Skin types', href: routes.skinTypes },
        { label: skinType.name },
      ]}
      header={{
        eyebrow: 'Skin type',
        title: skinType.name,
        description: skinType.description || skinType.shortDescription,
        image: skinType.image,
      }}
    />
  );
}
