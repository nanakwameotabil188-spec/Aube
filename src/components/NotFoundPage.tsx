import Link from 'next/link';
import { routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { LinkButton } from '@/components/ui/Button';
import { ProductRail } from '@/components/commerce/ProductCard';
import { productService, categoryService } from '@/lib/services/catalog-service';

/**
 * 404 content.
 *
 * Offers a way out rather than an apology: the most-visited collections and
 * the bestsellers are the destinations a lost shopper most likely wanted.
 *
 * Shared by two `not-found.tsx` boundaries. Next.js only prerenders a custom
 * not-found page at the app root for URLs that match no route at all, while
 * `notFound()` calls from inside a storefront route are served by the group
 * boundary — and that one renders inside the full shell.
 *
 * `showBestsellers` is off for the root boundary: `ProductRail` reads the
 * cart and wishlist contexts, and the root layout has no storefront providers.
 *
 * The rail is driven by the curated `isBestSeller` merchandising flag, so the
 * heading says "Featured" rather than a sales claim. Nothing here is derived
 * from order data, and nothing may be worded as if it were.
 */
export async function NotFoundPage({ showBestsellers = true }: { showBestsellers?: boolean } = {}) {
  const [bestsellers, categories] = await Promise.all([
    showBestsellers ? productService.getByFlags('isBestSeller', 4) : Promise.resolve([]),
    categoryService.getAll(),
  ]);

  return (
    <div className="container-page py-20 sm:py-28">
      <div className="mx-auto max-w-xl text-center">
        <p className="eyebrow mb-4">404</p>
        <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">This page has moved on</h1>
        <p className="mt-5 text-md leading-relaxed text-muted">
          The link is broken or the product is no longer sold. Everything currently in the range is one click away.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href={routes.shop} size="lg">
            Shop all products
          </LinkButton>
          <LinkButton href={routes.home} variant="secondary" size="lg">
            Back to home
          </LinkButton>
        </div>

        <nav aria-label="Popular categories" className="mt-12">
          <p className="eyebrow mb-4">Popular categories</p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {categories.slice(0, 6).map((category) => (
              <li key={category.id}>
                <Link
                  href={routes.category(category.slug)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-shell px-4 text-sm text-ink transition-colors hover:border-ink"
                >
                  {category.name}
                  <Icon name="arrow-right" size={13} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {bestsellers.length > 0 && (
        <section className="mt-24 border-t border-line pt-16">
          <h2 className="mb-8 font-display text-2xl text-ink sm:text-3xl">Featured products</h2>
          <ProductRail products={bestsellers} />
        </section>
      )}
    </div>
  );
}
