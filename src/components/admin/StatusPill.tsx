const TONES: Record<string, string> = {
  pending: 'bg-warning-soft text-warning',
  processing: 'bg-info-soft text-info',
  shipped: 'bg-moss-soft text-moss-deep',
  delivered: 'bg-success-soft text-success',
  cancelled: 'bg-danger-soft text-danger',
  refunded: 'bg-sand text-muted',
};

/** Order status badge. Unknown statuses fall back to a neutral tone. */
export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-xs px-2 py-0.5 text-xs capitalize ${TONES[status] ?? 'bg-sand text-muted'}`}
    >
      {status}
    </span>
  );
}
