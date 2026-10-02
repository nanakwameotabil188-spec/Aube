import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  productService,
  reviewService,
  categoryService,
  skinTypeService,
  skinConcernService,
  ingredientService,
} from '@/lib/services/catalog-service';
import { contentService } from '@/lib/services/content-service';
import { routes } from '@/lib/routes';
import { Breadcrumbs } from '@/components/ui/states';
import { ProductGallery } from '@/components/commerce/ProductGallery';
import { ProductPurchase } from '@/components/commerce/ProductPurchase';
import { ProductGrid } from '@/components/commerce/ProductCard';
import { ReviewList } from '@/components/commerce/Reviews';
import { JsonLd, SITE_URL, breadcrumbLd, faqLd, productLd } from '@/lib/seo/structured-data';
import { ProductDetailSections } from '@/components/commerce/ProductDetailSections';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const products = await productService.getAll();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const result = await productService.getBySlug((await params).slug);
  if (!result.data) return { title: 'Product not found' };

  const product = result.data;
  const path = routes.product(product.slug);

  return {
    title: `${product.name} — ${product.subtitle}`,
    description: product.shortDescription,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      type: 'website',
      title: `${product.name} — ${product.subtitle}`,
      description: product.shortDescription,
      url: `${SITE_URL}${path}`,
      images: product.images.slice(0, 2).map((image) => ({ url: image.url, alt: image.alt })),
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const result = await productService.getBySlug(slug);
  if (!result.data) notFound();

  const product = result.data;

  const [reviews, category, skinTypes, concerns, ingredients, related, bundle, shippingMethods, settings, productFaqs] =
    await Promise.all([
      reviewService.listForProduct(product.id),
      categoryService.getById(product.categoryId),
      skinTypeService.getAll(),
      skinConcernService.getManyByIds(product.skinConcernIds),
      ingredientService.getManyByIds(product.ingredientIds),
      productService.getRelated(product, 4),
      productService.getFrequentlyBoughtWith(product, 3),
      contentService.getShippingMethods(),
      contentService.getSettings(),
      contentService.getFaqItems('products'),
    ]);

  // These services expose the full visible list, not a bulk getter, so the
  // product's own references are intersected here.
  const allSkinTypes = skinTypes;
  const matchedSkinTypes = allSkinTypes.filter((type) => product.skinTypeIds.includes(type.id));

  // Only publish FAQ schema for questions this page actually answers.
  const relevantFaqs = productFaqs.filter((item) =>
    product.usage.some((step) => step.toLowerCase().includes(item.question.toLowerCase().slice(0, 12))),
  );

  const crumbs = [
    { label: 'Home', href: routes.home },
    { label: 'Shop', href: routes.shop },
    ...(category ? [{ label: category.name, href: routes.category(category.slug) }] : []),
    { label: product.name },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd
        data={productLd(product, {
          reviews: reviews.map((review) => ({ rating: review.rating })),
          rating: product.rating.average ?? undefined,
        })}
      />
      {relevantFaqs.length > 0 && <JsonLd data={faqLd(relevantFaqs)} />}

      <div className="container-page py-6 sm:py-10">
        <Breadcrumbs items={crumbs} className="mb-8" />

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 xl:gap-24">
          <ProductGallery product={product} className="lg:sticky lg:top-28" />

          <ProductPurchase
            product={product}
            skinTypes={matchedSkinTypes}
            concerns={concerns}
            settings={settings}
            shippingMethods={shippingMethods}
          />
        </div>

        <ProductDetailSections
          product={product}
          concerns={concerns}
          ingredients={ingredients}
          reviews={reviews}
        />

        {bundle.length > 0 && (
          <section className="mt-24 border-t border-line pt-16">
            <h2 className="mb-2 font-display text-2xl text-ink sm:text-3xl">Works well with</h2>
            <p className="mb-8 text-sm text-muted">Curated by our formulators, not by a recommendation engine.</p>
            <ProductGrid products={bundle} />
          </section>
        )}

        <div id="reviews" className="mt-24 scroll-mt-28 border-t border-line pt-16">
          <h2 className="mb-8 font-display text-2xl text-ink sm:text-3xl">
            Reviews{product.rating.count > 0 ? ` (${product.rating.count})` : ''}
          </h2>
          <ReviewList reviews={reviews} skinTypes={matchedSkinTypes} concerns={concerns} />
        </div>

        {related.length > 0 && (
          <section className="mt-24 border-t border-line pt-16">
            <h2 className="mb-8 font-display text-2xl text-ink sm:text-3xl">You may also like</h2>
            <ProductGrid products={related} />
          </section>
        )}
      </div>
    </>
  );
}
