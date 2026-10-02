import 'server-only';
import { createAdminSupabaseClient } from './admin';
import { triggerAutomation, EMAIL_EVENTS } from '@/lib/mail/templates';
import { notifyCustomers } from './notifications';

/**
 * Order fulfilment.
 *
 * ## Why this exists
 *
 * An order that nobody can move is not a working shop. Until now the admin panel
 * could *read* orders and the storefront could create them, but there was no path
 * from "placed" to "delivered" — so `order.dispatched` and `order.delivered`
 * existed as templates and automations that nothing could ever fire.
 *
 * ## The status change is the authority, not the email
 *
 * One call moves the order, appends a timeline row, notifies the shopper in-app,
 * and sends the matching email. The alternative — a "mark as shipped" button that
 * emails but forgets the status, or updates the status but sends nothing — is how
 * an order ends up delivered in the customer's inbox and still "processing" in the
 * admin list. Sequencing is deliberate: the durable write happens first, so a
 * mail failure cannot leave the panel disagreeing with the customer.
 *
 * ## Cancellation restores stock
 *
 * The only transition that touches inventory. Cancelling an order that had
 * decremented stock and not putting it back quietly sells a product that is no
 * longer in the box, and the next customer is told it has sold out.
 */

/** Where an order is allowed to move next. */
const TRANSITIONS: Record<string, string[]> = {
  // Awaiting payment. It can become paid, or be cancelled.
  pending: ['paid', 'cancelled'],
  // Payment taken, not yet made up. Cancelling here means a refund, which is a
  // manual action — so it stays reachable, and the operator is told.
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

/** Statuses an operator may set directly, in the order the panel lists them. */
export const FULFILMENT_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

/** The label written to `order_events`, per status. */
const EVENT_LABELS: Record<string, string> = {
  pending: 'Order received — awaiting payment',
  paid: 'Payment received',
  processing: 'Preparing your order',
  shipped: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export type FulfilmentResult =
  | { ok: true; status: string; emailed: boolean; notified: number }
  | { ok: false; message: string };

/** Whether a move is permitted, for rendering the buttons. */
export function allowedTransitions(status: string): string[] {
  return TRANSITIONS[status] ?? [];
}

export async function setOrderStatus(
  orderId: string,
  next: string,
): Promise<FulfilmentResult> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { ok: false, message: 'Supabase is not configured.' };

  const { data: order, error: readError } = await admin
    .from('orders')
    .select('id, number, status, customer_email, customer_id, total, currency')
    .eq('id', orderId)
    .maybeSingle<{
      id: string;
      number: string;
      status: string;
      customer_email: string;
      customer_id: string | null;
      total: number;
      currency: string;
    }>();

  if (readError) return { ok: false, message: readError.message };
  if (!order) return { ok: false, message: 'That order no longer exists.' };

  if (order.status === next) {
    return { ok: true, status: next, emailed: false, notified: 0 };
  }

  /*
   * Transitions are checked, not assumed.
   *
   * The obvious implementation writes whatever it is given. That lets a
   * mistyped id move a delivered order back to "paid", and — because the panel
   * posts this form — it is reachable by anyone who can reach the form endpoint.
   */
  const allowed = TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(next)) {
    return {
      ok: false,
      message: `An order that is "${order.status}" cannot move to "${next}".`,
    };
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (updateError) return { ok: false, message: updateError.message };

  /*
   * Timeline first, notification second, email last.
   *
   * The shopper's own order page renders the timeline, so a status that changed
   * without a matching entry is visible to them as a gap. The email is the only
   * step whose failure is recoverable — it is logged and reported rather than
   * rolled back, because refusing a status change because an SMTP call timed out
   * would leave the operator unable to ship an order.
   */
  const occurredAt = new Date().toISOString();
  await admin.from('order_events').insert({
    id: `${orderId}-e-${occurredAt}`,
    order_id: orderId,
    label: EVENT_LABELS[next] ?? next,
    status: next,
    occurred_at: occurredAt,
  });

  if (next === 'cancelled') {
    await restoreStock(admin, orderId);
  }

  let notified = 0;
  if (order.customer_id) {
    const result = await notifyCustomers({
      customerIds: [order.customer_id],
      title: `Order ${order.number} — ${(EVENT_LABELS[next] ?? next).toLowerCase()}`,
      body: `We have updated the status of order ${order.number}.`,
      tone: next === 'cancelled' ? 'warning' : 'info',
      link: `/account/orders/${order.id}`,
    });
    if (result.ok) notified = result.delivered;
  }

  const emailed = await sendStatusEmail(order, next);

  return { ok: true, status: next, emailed, notified };
}

/**
 * The email for a status change.
 *
 * Only the two an operator would expect to be told about automatically. Sending
 * mail for "payment received" would mean the customer gets both a receipt and a
 * status update for the same moment, which reads as noise.
 */
async function sendStatusEmail(
  order: { number: string; customer_email: string },
  status: string,
): Promise<boolean> {
  const event =
    status === 'shipped' ? EMAIL_EVENTS.ORDER_DISPATCHED : status === 'delivered' ? EMAIL_EVENTS.ORDER_DELIVERED : null;

  if (!event) return false;

  const result = await triggerAutomation(event, order.customer_email, {
    brand_name: await brandName(),
    order_number: order.number,
  });

  return result.sent;
}

async function brandName(): Promise<string> {
  const { contentService } = await import('@/lib/services/content-service');
  try {
    const settings = await contentService.getSettings();
    return settings.brandName || 'the shop';
  } catch {
    return 'the shop';
  }
}

/**
 * Puts reserved stock back when an order is cancelled.
 *
 * Best effort and not transactional with the status change. The alternative —
 * a single database function doing both — would be more correct, and is the
 * right shape once an order can be cancelled by a customer-facing action. Today
 * the only caller is an authenticated admin who can also re-check the count, so
 * a failure here is logged rather than surfaced as a failed cancellation, which
 * would be misleading: the cancellation itself did succeed.
 */
async function restoreStock(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  orderId: string,
): Promise<void> {
  const { data: lines, error } = await admin
    .from('order_lines')
    .select('variant_id, quantity')
    .eq('order_id', orderId);

  if (error || !lines) {
    console.warn(`[orders] could not read lines to restore stock for ${orderId}`);
    return;
  }

  for (const line of lines as { variant_id: string; quantity: number }[]) {
    if (!line.variant_id || line.quantity < 1) continue;

    /*
     * `restore_variant_stock` (0016) rather than `decrement_variant_stock` with a
     * negative quantity. The decrement rejects a quantity below 1 by design, and
     * reusing it would also invert its floor test — `stock_quantity >= -5` is
     * true for every row, so the guard would stop guarding anything.
     */
    const { error } = await admin.rpc('restore_variant_stock', {
      p_variant_id: line.variant_id,
      p_quantity: line.quantity,
    });

    if (error) {
      console.warn(
        `[orders] stock restore failed for variant ${line.variant_id} on ${orderId}: ${error.message}`,
      );
    }
  }
}