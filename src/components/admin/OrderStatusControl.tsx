'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateOrderStatus, type AdminActionResult } from '@/lib/actions/admin';
import { cn } from '@/lib/utils/cn';

/**
 * Order status control.
 *
 * ## Why the buttons are the allowed transitions and not a select
 *
 * A dropdown offering every status invites the question "can I set this to
 * shipped?", which needs an answer. Rendering only what the current status
 * permits makes the transition table visible to the operator rather than to the
 * developer, and removes the possibility of picking a move that would be
 * rejected server-side anyway.
 *
 * The rejection is still enforced in `setOrderStatus` — this component is a
 * convenience, not the control.
 *
 * ## Why one form per transition
 *
 * The obvious rendering is one form with a `status` input per transition and a
 * button for each. That does not work: a hidden input is not scoped to its
 * sibling button, so every submit posts every `status` value and the last one
 * wins. The chosen move would silently be whatever happened to be last in the
 * markup.
 *
 * A separate form per transition is the shape that actually works, and it also
 * means each button carries its own result message instead of one shared status
 * line that flickers between the options.
 */

const TONES: Record<string, string> = {
  paid: 'border-line hover:bg-sand',
  processing: 'border-line hover:bg-sand',
  shipped: 'border-ink hover:bg-shell',
  delivered: 'border-line hover:bg-sand',
  cancelled: 'border-danger text-danger hover:bg-danger-soft',
};

const LABELS: Record<string, string> = {
  paid: 'Mark paid',
  processing: 'Start preparing',
  shipped: 'Mark dispatched',
  delivered: 'Mark delivered',
  cancelled: 'Cancel order',
};

function Submit({ label, tone }: { label: string; tone: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-xs border px-2.5 py-1 text-xs transition-colors disabled:opacity-60',
        tone,
      )}
    >
      {pending ? 'Working…' : label}
    </button>
  );
}

export function OrderStatusControl({
  orderId,
  status,
  allowed,
}: {
  orderId: string;
  status: string;
  allowed: string[];
}) {
  if (allowed.length === 0) {
    return (
      <span className="text-xs text-muted">
        {status === 'cancelled' || status === 'refunded'
          ? 'Closed'
          : 'No further action'}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {allowed.map((next) => (
        <TransitionForm key={next} orderId={orderId} status={next} />
      ))}
    </div>
  );
}

function TransitionForm({ orderId, status }: { orderId: string; status: string }) {
  const [state, action] = useActionState<AdminActionResult | null, FormData>(
    updateOrderStatus,
    null,
  );

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={status} />

      <Submit label={LABELS[status] ?? status} tone={TONES[status] ?? 'border-line hover:bg-sand'} />

      {state ? (
        <p role="status" className={cn('max-w-[16rem] text-xs', state.ok ? 'text-success' : 'text-danger')}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}