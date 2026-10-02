'use client';

import { useActionState } from 'react';
import type { AdminReview } from '@/lib/supabase/admin-content';
import { moderate, type AdminActionResult } from '@/lib/actions/admin';

/**
 * Review moderation queue.
 *
 * A review becomes public only when it is both approved and published, and it
 * only counts toward a product's rating in that state. The admin cannot create
 * reviews from here — this queue exists to moderate what customers submit.
 *
 * With nothing submitted the queue is empty, which is the honest state: the
 * storefront shows "No reviews yet" and no rating at all.
 */

function Result({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return (
    <span
      role="status"
      className={result.ok ? 'text-xs text-success' : 'text-xs text-danger'}
    >
      {result.message}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning-soft text-warning',
  approved: 'bg-success-soft text-success',
  rejected: 'bg-danger-soft text-danger',
};

export function ReviewQueue({ reviews }: { reviews: AdminReview[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-shell p-6">
        <h2 className="text-sm font-semibold">No reviews to moderate</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Nothing has been submitted yet. Reviews appear here once customers post them, and the
          storefront shows &ldquo;No reviews yet&rdquo; until a review is approved and published.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <li key={review.id}>
          <ReviewCard review={review} />
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ review }: { review: AdminReview }) {
  const [state, action, pending] = useActionState<AdminActionResult | null, FormData>(moderate, null);

  return (
    <article className="rounded-lg border border-line bg-shell p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-xs px-2 py-0.5 text-xs ${STATUS_STYLES[review.moderationStatus] ?? 'bg-sand text-muted'}`}>
          {review.moderationStatus}
        </span>
        {review.published ? (
          <span className="rounded-xs bg-info-soft px-2 py-0.5 text-xs text-info">published</span>
        ) : (
          <span className="rounded-xs bg-sand px-2 py-0.5 text-xs text-muted">unpublished</span>
        )}
        <span className="text-xs text-muted">
          {review.rating} / 5 · {review.productName} · {new Date(review.createdAt).toLocaleDateString('en-US')}
        </span>
      </div>

      <h3 className="mt-3 font-medium">{review.title || review.author}</h3>
      <p className="mt-1 text-sm text-muted">{review.body}</p>
      <p className="mt-2 text-xs text-muted">By {review.author}</p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <input type="hidden" name="id" value={review.id} />

        <div>
          <label htmlFor={`status-${review.id}`} className="block text-xs font-medium">
            Status
          </label>
          <select
            id={`status-${review.id}`}
            name="moderation_status"
            defaultValue={review.moderationStatus}
            className="mt-1 rounded-md border border-line bg-shell px-3 py-1.5 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="published"
            defaultChecked={review.published}
            className="size-4 accent-moss"
          />
          Published
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-1.5 text-sm text-porcelain disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>

        <Result result={state} />
      </form>

      <p className="mt-2 text-xs text-muted">
        A review is only visible and only affects a product&rsquo;s rating when it is approved and
        published.
      </p>
    </article>
  );
}
