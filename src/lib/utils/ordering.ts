import type { Orderable } from '@/types';

/**
 * Ordering contract.
 *
 * The frontend never decides that a list "looks right" — it honours the
 * `position` field the admin panel writes. Changing the order in the CMS
 * changes the rendered order with no code change.
 *
 * Ties are broken deterministically by `id` so server and client renders
 * always agree, avoiding hydration mismatches.
 */
export function comparePosition<T extends { position: number; id?: string }>(a: T, b: T): number {
  if (a.position !== b.position) return a.position - b.position;
  return (a.id ?? '').localeCompare(b.id ?? '');
}

export const byPosition = comparePosition;

/** Sort a copy, dropping anything hidden or unpublished. */
export function visibleAndOrdered<T extends Orderable>(items: readonly T[]): T[] {
  return items
    .filter((item) => item.visible && item.status === 'active')
    .slice()
    .sort(comparePosition);
}

/** Ordering for lightweight records (taxonomy, nav links, FAQ, sections). */
export function byPositionField<T extends { position: number; id?: string }>(items: readonly T[]): T[] {
  return items.slice().sort(comparePosition);
}

export function filterVisible<T extends { visible: boolean }>(items: readonly T[]): T[] {
  return items.filter((item) => item.visible);
}

/** Reorder a list to match an explicit id sequence — used by admin tooling. */
export function applyOrder<T extends { id: string }>(items: readonly T[], orderedIds: readonly string[]): T[] {
  const index = new Map(orderedIds.map((id, i) => [id, i]));
  return items.slice().sort((a, b) => (index.get(a.id) ?? Infinity) - (index.get(b.id) ?? Infinity));
}
