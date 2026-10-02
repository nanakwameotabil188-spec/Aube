import type { Review } from '@/types';

/**
 * Review records.
 *
 * Intentionally empty. A review is a real customer statement, so this array
 * stays empty until real, moderated reviews exist — they arrive through the
 * admin moderation queue or a review platform, never as seed data.
 *
 * The prototype previously shipped 44 invented reviews with named authors,
 * star ratings, and helpful counts. None of those were real, and presenting
 * them as customer speech is the single most damaging thing this site could
 * do. They have been removed rather than replaced.
 *
 * `Review` keeps `verified` and `helpfulCount` so a real moderation system can
 * populate trust signals instead of inventing them.
 */
export const reviews: Review[] = [];
