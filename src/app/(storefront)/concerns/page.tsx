import type { Metadata } from 'next';
import { skinConcernService } from '@/lib/services/catalog-service';
import { routes } from '@/lib/routes';
import { TermIndex } from '@/components/catalog/TermIndex';
import { catalogMetadata } from '@/components/catalog/CatalogPage';

export const metadata: Metadata = catalogMetadata({
  title: 'Shop by concern',
  description:
    'Start from what your skin is actually doing — barrier damage, uneven tone, dehydration, breakouts — and see the products formulated for it.',
  path: routes.concerns,
});

export default async function ConcernsPage() {
  const concerns = await skinConcernService.getWithCounts();

  return (
    <TermIndex
      eyebrow="Shop by concern"
      title="Start with what your skin is doing"
      description="Six concerns, each with the products formulated for it and a plain explanation of why they work."
      crumb={{ label: 'Concerns', href: routes.concerns }}
      buildHref={routes.concern}
      items={concerns.map((concern) => ({
        ...concern,
        note: `${concern.productCount} ${concern.productCount === 1 ? 'product' : 'products'}`,
      }))}
    />
  );
}
