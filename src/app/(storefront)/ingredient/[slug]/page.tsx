import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ingredientService, productService } from '@/lib/services/catalog-service';
import { routes } from '@/lib/routes';
import { catalogMetadata } from '@/components/catalog/CatalogPage';
import { Breadcrumbs, EmptyState } from '@/components/ui/states';
import { ProductGrid } from '@/components/commerce/ProductCard';
import { MediaImage } from '@/components/commerce/ProductGallery';
import { Icon } from '@/components/ui/Icon';
import { JsonLd, SITE_URL, breadcrumbLd } from '@/lib/seo/structured-data';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const ingredients = await ingredientService.getAll();
  return ingredients.map((ingredient) => ({ slug: ingredient.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const ingredient = await ingredientService.getBySlug((await params).slug);
  if (!ingredient) return { title: 'Ingredient not found' };

  return catalogMetadata({
    title: `${ingredient.name} — what it does`,
    description: ingredient.description || ingredient.shortDescription,
    path: routes.ingredient(ingredient.slug),
    image: ingredient.image?.url,
  });
}

/**
 * Ingredient page.
 *
 * An ingredient is an explanation first and a shop second: the evidence and
 * what to look for come before the products, because a shopper who does not
 * yet know why they need it should not be sold to it.
 */
export default async function IngredientPage({ params }: Params) {
  const { slug } = await params;
  const ingredient = await ingredientService.getBySlug(slug);
  if (!ingredient) notFound();

  const [hero, products] = await Promise.all([
    ingredientService.getHero(ingredient),
    productService.getByIngredient(ingredient.id),
  ]);

  const crumbs = [
    { label: 'Home', href: routes.home },
    { label: 'Ingredients', href: routes.ingredients },
    { label: ingredient.name },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />

      <div className="container-page py-8 sm:py-12">
        <Breadcrumbs items={crumbs} className="mb-8" />

        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
          <div className="flex flex-col gap-5">
            <p className="eyebrow">Ingredient</p>
            <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">{ingredient.name}</h1>
            {ingredient.aka.length > 0 && (
              <p className="text-sm text-muted">
                Also known as {ingredient.aka.join(', ').toLowerCase()}
              </p>
            )}
            <p className="text-md leading-relaxed text-muted">
              {ingredient.description || ingredient.shortDescription}
            </p>
            {ingredient.concentration && (
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-xs text-ink">
                <Icon name="flask" size={13} aria-hidden className="text-moss" />
                Used at {ingredient.concentration}
              </p>
            )}
          </div>

          {ingredient.image && (
            <MediaImage
              image={ingredient.image}
              aspect="4/3"
              priority
              rounded="rounded-md"
              sizes="(min-width: 1024px) 44vw, 100vw"
            />
          )}
        </div>

        {ingredient.benefits.length > 0 && (
          <section className="mt-20">
            <h2 className="mb-8 font-display text-2xl text-ink sm:text-3xl">What it does</h2>
            <dl className="grid gap-px overflow-hidden rounded-xs border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {ingredient.benefits.map((benefit) => (
                <div key={benefit} className="flex gap-3 bg-porcelain p-6">
                  <Icon name="check" size={16} aria-hidden className="mt-0.5 shrink-0 text-moss" />
                  <dd className="text-sm leading-relaxed text-ink">{benefit}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {hero && (
          <section className="mt-20 overflow-hidden rounded-md bg-moss text-shell">
            <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <p className="eyebrow text-shell/70">The one to start with</p>
                <h2 className="font-display text-3xl leading-tight">{hero.name}</h2>
                <p className="max-w-md leading-relaxed text-shell/80">{hero.shortDescription}</p>
                <Link
                  href={routes.product(hero.slug)}
                  className="mt-2 inline-flex w-fit items-center gap-2 border-b border-shell/40 pb-1 text-sm transition-colors hover:border-shell"
                >
                  View {hero.name}
                  <Icon name="arrow-right" size={14} aria-hidden />
                </Link>
              </div>
              <Link href={routes.product(hero.slug)} className="group/hero block">
                <MediaImage
                  image={hero.thumbnail}
                  aspect="4/3"
                  rounded="rounded-xs"
                  sizes="(min-width: 1024px) 44vw, 100vw"
                  className="transition-transform duration-500 ease-[var(--ease-soft)] group-hover/hero:scale-[1.02]"
                />
              </Link>
            </div>
          </section>
        )}

        {products.length > 0 && (
          <section className="mt-20">
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl text-ink sm:text-3xl">Formulated with {ingredient.name}</h2>
              <p className="text-sm text-muted">
                {products.length} {products.length === 1 ? 'product' : 'products'}
              </p>
            </div>
            <ProductGrid products={products} />
          </section>
        )}

        {products.length === 0 && (
          <EmptyState
            title="No products use this ingredient yet"
            body="It is on our list for the next formulation round. Browse the full range in the meantime."
            icon="flask"
            action={{ label: 'Shop all products', href: routes.shop }}
          />
        )}

        <p className="mt-20 border-t border-line pt-6 text-xs text-muted-light">
          Statements on this page are general information about an ingredient, not medical advice. If you are managing a skin
          condition, speak to a clinician.{' '}
          <a href={`${SITE_URL}${routes.contact}`} className="underline underline-offset-2">
            Contact us
          </a>
          .
        </p>
      </div>
    </>
  );
}
