'use client';

import Link from 'next/link';
import type { Ingredient, Product, Review, SkinConcern } from '@/types';
import { routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { Accordion } from '@/components/ui/overlays';
import { Rating } from '@/components/ui/primitives';

/**
 * Product detail sections.
 *
 * The content a shopper actually needs before buying, in the order they need
 * it: what it does, what is in it, how to use it, and what to expect from the
 * delivery. Client-side only because the accordion and "see all reviews"
 * toggles are interactive; the content itself is passed in already resolved.
 */

export function ProductDetailSections({
  product,
  concerns,
  ingredients,
  reviews,
}: {
  product: Product;
  concerns: SkinConcern[];
  ingredients: Ingredient[];
  reviews: Review[];
}) {
  const keyIngredients = product.keyIngredients
    .map((entry) => ({ entry, ingredient: ingredients.find((item) => item.id === entry.ingredientId) }))
    .filter((pair): pair is { entry: { ingredientId: string; note: string }; ingredient: Ingredient } =>
      Boolean(pair.ingredient),
    );

  const distribution = ratingDistribution(reviews);

  return (
    <div className="mt-20 grid gap-16 border-t border-line pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
      <div className="flex flex-col gap-14">
        {product.benefits.length > 0 && (
          <section>
            <h2 className="mb-6 font-display text-2xl text-ink sm:text-3xl">What it does</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {product.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
                  <Icon name="check" size={15} aria-hidden className="mt-0.5 shrink-0 text-moss" />
                  {benefit}
                </li>
              ))}
            </ul>
          </section>
        )}

        {keyIngredients.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-2xl text-ink sm:text-3xl">Key ingredients</h2>
            <p className="mb-6 text-sm text-muted">Listed in the order they appear in the formula.</p>
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {keyIngredients.map(({ entry, ingredient }) => (
                <li key={entry.ingredientId} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={routes.ingredient(ingredient.slug)}
                      className="font-display text-lg text-ink transition-colors hover:text-moss"
                    >
                      {ingredient.name}
                    </Link>
                    {ingredient.concentration && (
                      <span className="rounded-full bg-sand px-2.5 py-1 text-2xs tracking-[0.1em] text-ink uppercase">
                        {ingredient.concentration}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{entry.note}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-6 font-display text-2xl text-ink sm:text-3xl">The full formulation</h2>
          <p className="text-sm leading-relaxed text-muted">{product.ingredients}</p>
        </section>

        {concerns.length > 0 && (
          <section>
            <h2 className="mb-5 font-display text-2xl text-ink sm:text-3xl">Works on</h2>
            <ul className="flex flex-wrap gap-2">
              {concerns.map((concern) => (
                <li key={concern.id}>
                  <Link
                    href={routes.concern(concern.slug)}
                    className="inline-flex h-8 items-center rounded-full border border-line bg-shell px-3.5 text-xs text-ink transition-colors hover:border-ink"
                  >
                    {concern.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-10">
        {/*
          Only rendered when there is at least one real review to summarise.
          The histogram and the headline count are both derived from the same
          `reviews` list, so they cannot disagree — previously the headline
          used a catalogue aggregate while the bars used the review list.
        */}
        {reviews.length > 0 && product.rating.average != null && (
          <section className="rounded-xs bg-sand p-6">
            <h2 className="font-display text-xl text-ink">
              Rated {product.rating.average.toFixed(1)} out of 5
            </h2>
            <p className="mt-1 text-sm text-muted">
              Based on {reviews.length} published{' '}
              {reviews.length === 1 ? 'review' : 'reviews'}
            </p>
            <Rating value={product.rating.average} count={reviews.length} className="mt-3" />
            <ul className="mt-5 flex flex-col gap-1.5">
              {distribution.map(({ stars, count }) => (
                <li key={stars} className="flex items-center gap-3 text-xs text-muted">
                  <span className="w-12 shrink-0 tabular-nums">{stars} star</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-shell">
                    <span
                      className="block h-full rounded-full bg-ink"
                      style={{ width: `${(count / Math.max(1, reviews.length)) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Accordion
          allowMultiple
          items={[
            {
              id: 'how-to-use',
              title: 'How to use',
              defaultOpen: true,
              content: (
                <ol className="flex flex-col gap-3">
                  {product.usage.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="font-display text-lg text-line-strong">{String(index + 1).padStart(2, '0')}</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              ),
            },
            {
              id: 'ingredients',
              title: 'Full ingredient list',
              content: <p className="leading-relaxed">{product.ingredients}</p>,
            },
            {
              id: 'shipping',
              title: 'Shipping & returns',
              content: (
                <div className="flex flex-col gap-2">
                  <p>{product.dispatchEstimate ?? 'Dispatches within two working days.'}</p>
                  <p>
                    Free standard shipping over the threshold shown above.{' '}
                    <Link href={routes.shipping} className="underline underline-offset-2">
                      Full delivery details
                    </Link>
                    .
                  </p>
                  <p>
                    Sixty days to return, opened or not.{' '}
                    <Link href={routes.returns} className="underline underline-offset-2">
                      Returns policy
                    </Link>
                    .
                  </p>
                </div>
              ),
            },
            ...(product.warnings && product.warnings.length > 0
              ? [
                  {
                    id: 'warnings',
                    title: 'Please note',
                    content: (
                      <ul className="flex list-disc flex-col gap-1.5 pl-5">
                        {product.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>
    </div>
  );
}

function ratingDistribution(reviews: Review[]): { stars: number; count: number }[] {
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => Math.round(review.rating) === stars).length,
  }));
}
