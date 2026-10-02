import { listReviewsForModeration } from '@/lib/supabase/admin-content';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { ReviewQueue } from '@/components/admin/ReviewQueue';

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  return (
    <AdminGate>
      <ReviewsScreen />
    </AdminGate>
  );
}

async function ReviewsScreen() {
  const reviews = await listReviewsForModeration();
  if (!reviews) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  const pending = reviews.filter((review) => review.moderationStatus === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reviews</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Moderate what customers submit. Nothing here is written by the panel — reviews only enter
          through the storefront, and only reach customers once approved and published.
        </p>
      </div>

      {pending > 0 ? (
        <p className="text-sm text-muted">
          {pending} {pending === 1 ? 'review is' : 'reviews are'} waiting for a decision.
        </p>
      ) : null}

      <ReviewQueue reviews={reviews} />
    </div>
  );
}
