import type { Metadata } from 'next';
import { skinTypeService } from '@/lib/services/catalog-service';
import { routes } from '@/lib/routes';
import { TermIndex } from '@/components/catalog/TermIndex';
import { catalogMetadata } from '@/components/catalog/CatalogPage';

export const metadata: Metadata = catalogMetadata({
  title: 'Shop by skin type',
  description:
    'Oily, dry, combination, sensitive or somewhere in between. Shop the range by what your skin does, not by a trend.',
  path: routes.skinTypes,
});

export default async function SkinTypesPage() {
  const types = await skinTypeService.getAll();

  return (
    <TermIndex
      eyebrow="Shop by skin type"
      title="Your skin type, without the guesswork"
      description="Skin type changes with the season and with what you are using. Start here, then adjust."
      crumb={{ label: 'Skin types', href: routes.skinTypes }}
      buildHref={routes.skinType}
      items={types.map((type) => ({ ...type, note: type.description }))}
    />
  );
}
