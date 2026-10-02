import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoryService } from '@/lib/services/catalog-service';
import { CatalogPage, catalogMetadata } from '@/components/catalog/CatalogPage';
import { routes } from '@/lib/routes';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const categories = await categoryService.getAll();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = await categoryService.getBySlug((await params).slug);
  if (!category) return { title: 'Category not found' };

  return catalogMetadata({
    title: category.seoTitle ?? category.name,
    description: category.description || category.shortDescription,
    path: routes.category(category.slug),
    image: category.image?.url,
  });
}

export default async function CategoryPage({ params, searchParams }: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const category = await categoryService.getBySlug(slug);
  if (!category) notFound();

  return (
    <CatalogPage
      searchParams={searchParams}
      // Locked to this category: the filter panel must not offer a way out.
      scope={{ categoryIds: [category.id], perPage: 12 }}
      crumbs={[{ label: 'Home', href: routes.home }, { label: 'Shop', href: routes.shop }, { label: category.name }]}
      header={{
        eyebrow: 'Category',
        title: category.name,
        description: category.description || category.shortDescription,
        image: category.image,
      }}
    />
  );
}
