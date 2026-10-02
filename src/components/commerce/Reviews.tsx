import Link from 'next/link';
import type { Product, Review, SkinConcern, SkinType } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatRelative } from '@/lib/utils/format';
import { routes } from '@/lib/routes';
import { Rating } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

/* ------------------------------------------------------------------ */
/* Review summary                                                      */
/* ------------------------------------------------------------------ */

/**
 * Aggregate rating block.
 *
 * Renders nothing at all when the product has no approved reviews: there is no
 * honest way to show a score, a histogram, or a percentage derived from
 * nothing, and an empty star graphic implies a zero score.
 */
export function RatingSummary({
  rating,
  productSlug,
  className,
}: {
  rating: Product['rating'];
  productSlug: string;
  className?: string;
}) {
  if (rating.average == null || rating.count === 0) return null;

  const total = rating.distribution.reduce((sum, count) => sum + count, 0) || 1;

  return (
    <div className={cn('flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-10', className)}>
      <div className="flex flex-col items-center gap-1 sm:items-start">
        <p className="font-display text-5xl leading-none text-ink">{rating.average.toFixed(1)}</p>
        <Rating value={rating.average} showCount={false} size={16} />
        <a
          href={`#reviews`}
          className="link-underline mt-1 text-xs text-muted transition-colors hover:text-ink"
        >
          {rating.count.toLocaleString('en-US')} {rating.count === 1 ? 'review' : 'reviews'}
        </a>
      </div>

      <ul className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = rating.distribution[star - 1] ?? 0;
          const percent = Math.round((count / total) * 100);
          return (
            <li key={star} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs tabular-nums text-muted">
                {star}
                <span className="sr-only"> star{star === 1 ? '' : 's'}</span>
              </span>
              <span
                aria-hidden
                className="h-1 flex-1 overflow-hidden rounded-full bg-oat"
                title={`${percent}% of reviews are ${star} star`}
              >
                <span className="block h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
              </span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{percent}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review card                                                         */
/* ------------------------------------------------------------------ */

export function ReviewCard({
  review,
  skinType,
  concerns,
  className,
}: {
  review: Review;
  skinType?: SkinType | null;
  concerns?: SkinConcern[];
  className?: string;
}) {
  return (
    <article className={cn('flex flex-col gap-3 border-t border-line pt-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Rating value={review.rating} showCount={false} size={13} />
        <time dateTime={review.createdAt} className="text-xs text-muted">
          {formatRelative(review.createdAt)}
        </time>
      </div>

      <h3 className="font-display text-lg leading-snug text-ink">{review.title}</h3>
      <p className="text-base leading-relaxed text-muted">{review.body}</p>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs">
        <span className="font-medium text-ink">{review.author}</span>
        {review.verified && (
          <span className="inline-flex items-center gap-1 text-success">
            <Icon name="check" size={12} aria-hidden />
            Verified buyer
          </span>
        )}
        {skinType && <span className="text-muted">· {skinType.name} skin</span>}
        {concerns && concerns.length > 0 && (
          <span className="text-muted">
            ·{' '}
            {concerns.map((concern, index) => (
              <span key={concern.id}>
                {index > 0 && ', '}
                {concern.name}
              </span>
            ))}
          </span>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Review list                                                         */
/* ------------------------------------------------------------------ */

export function ReviewList({
  reviews,
  skinTypes,
  concerns,
  className,
}: {
  reviews: Review[];
  skinTypes: SkinType[];
  concerns: SkinConcern[];
  className?: string;
}) {
  if (reviews.length === 0) {
    return (
      <p className="border-t border-line pt-6 text-base text-muted">
        No written reviews for this product yet. Verified buyers will appear here.
      </p>
    );
  }

  return (
    <ul className={cn('grid gap-x-8 gap-y-8 sm:grid-cols-2', className)}>
      {reviews.map((review) => (
        <li key={review.id}>
          <ReviewCard
            review={review}
            skinType={skinTypes.find((type) => type.id === review.skinType) ?? null}
            concerns={concerns.filter((concern) => review.skinConcerns?.includes(concern.id))}
          />
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonial card (marketing)                                        */
/* ------------------------------------------------------------------ */

/**
 * Testimonial card.
 *
 * The stars are driven by the testimonial's own `rating` and are omitted when
 * there isn't one. This used to hardcode five gold stars regardless of the
 * data, which meant any future real testimonial would be displayed as a
 * five-star review whether it was one or not.
 */
export function TestimonialCard({
  quote,
  author,
  location,
  rating,
  product,
  className,
  tone = 'default',
}: {
  quote: string;
  author: string;
  location: string;
  rating?: number | null;
  product?: { name: string; slug: string } | null;
  className?: string;
  tone?: 'default' | 'muted';
}) {
  return (
    <figure
      className={cn(
        'flex h-full flex-col gap-4 rounded-xs border p-6',
        tone === 'muted' ? 'border-line bg-sand' : 'border-line bg-shell',
        className,
      )}
    >
      {rating != null && <Rating value={rating} showCount={false} size={13} />}
      <blockquote className="flex-1 font-display text-lg leading-relaxed text-ink">&ldquo;{quote}&rdquo;</blockquote>
      <figcaption className="flex flex-col gap-0.5 border-t border-line pt-3 text-xs">
        <span className="font-medium text-ink">{author}</span>
        <span className="text-muted">{location}</span>
        {product && (
          <Link href={routes.product(product.slug)} className="link-underline mt-1 w-fit text-ink">
            {product.name}
          </Link>
        )}
      </figcaption>
    </figure>
  );
}
