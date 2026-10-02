import type { Metadata } from 'next';
import { ingredientService } from '@/lib/services/catalog-service';
import { routes } from '@/lib/routes';
import { TermIndex } from '@/components/catalog/TermIndex';
import { catalogMetadata } from '@/components/catalog/CatalogPage';

export const metadata: Metadata = catalogMetadata({
  title: 'Ingredients',
  description:
    'The actives we formulate with, what each one does, the concentration we use it at, and where to find it in the range.',
  path: routes.ingredients,
});

export default async function IngredientsPage() {
  const ingredients = await ingredientService.getAll();

  return (
    <TermIndex
      eyebrow="Formulation"
      title="What goes in, and at what dose"
      description="An ingredient is only useful at a dose that does something. These are the concentrations we actually use."
      crumb={{ label: 'Ingredients', href: routes.ingredients }}
      buildHref={routes.ingredient}
      items={ingredients.map((ingredient) => ({
        ...ingredient,
        note: ingredient.concentration ? `Used at ${ingredient.concentration}` : ingredient.aka.slice(0, 2).join(', '),
      }))}
    />
  );
}
