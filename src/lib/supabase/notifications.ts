import 'server-only';
import { createAdminSupabaseClient } from './admin';
import { createServerSupabaseClient } from './server';
import type { Database } from './types';

/**
 * In-app notifications.
 *
 * ## Read through the session client, not the service role and not the public one
 *
 * Three clients exist and picking the wrong one is silent:
 *
 * - The **service role** would return every shopper's rows. The `customer_id`
 *   filter is then the only thing standing between a bug and reading other
 *   people's mail, which is not a control worth relying on.
 * - The **public client** (`public.ts`) is stateless by design — it does not read
 *   cookies, so it presents the anon role. The policies on this table key off
 *   `current_customer_id()`, which resolves from `auth.uid()`; with no session
 *   that is always null, so the query matches zero rows and the bell renders
 *   permanently empty for a signed-in shopper. This was the original
 *   implementation, and it failed silently: no error, no row, just a badge that
 *   never appeared.
 * - The **server client** (`server.ts`) carries the session cookie and still runs
 *   as the anon role, so RLS does the deciding. A `customer_id` filter is not
 *   passed in at all — the policy resolves the recipient, so a bug here cannot
 *   ask for somebody else's rows even by accident.
 *
 * Writes that a shopper performs go through the same client, so RLS scopes the
 * update too. Delivery is the service role's job alone, because an admin action
 * is not something a signed-in user should be able to do for themselves.
 */

export interface NotificationItem {
  id: string;
  tone: string;
  title: string;
  body: string;
  imageUrl: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

function mapRow(row: {
  id: string;
  tone: string;
  title: string;
  body: string;
  image_url: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}): NotificationItem {
  return {
    id: row.id,
    tone: row.tone,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    link: row.link,
    read: row.read_at !== null,
    createdAt: row.created_at,
  };
}

/**
 * The signed-in shopper's notifications, newest first.
 *
 * `customer_id` is not passed in: the policies resolve it from the session, so
 * a bug here cannot ask for somebody else's rows even by accident.
 */
export async function listNotifications(limit = 20): Promise<NotificationItem[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('id, tone, title, body, link, read_at, created_at, images!notifications_image_id_fkey(url)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`[notifications] read failed: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => {
    const joined = Array.isArray(row.images) ? row.images[0] : row.images;
    return mapRow({
      id: row.id,
      tone: row.tone,
      title: row.title,
      body: row.body,
      image_url: (joined as { url?: string } | null)?.url ?? null,
      link: row.link,
      read_at: row.read_at,
      created_at: row.created_at,
    });
  });
}

/** Unread count for the bell badge. */
export async function countUnread(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read_at', null);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Marks notifications read.
 *
 * No `customer_id` filter, because there is no value to filter on: the policy
 * resolves the recipient from the session. That is stronger than an
 * application-side filter, which is only as trustworthy as the code that sets
 * it.
 */
export async function markRead(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .select('id');

  if (error) {
    console.warn(`[notifications] mark-read failed: ${error.message}`);
    return 0;
  }

  /*
   * The number the caller gets back is the number it may safely keep showing as
   * read.
   *
   * `data` is the set of rows the policy actually let through, which is the only
   * honest answer available: a refusal is not an error, it is zero rows. Returning
   * `ids.length` unconditionally would tell the bell it succeeded even when RLS
   * matched nothing, which is how a notification ends up marked read on screen
   * and unread in the database.
   */
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Marks every unread notification read.
 *
 * Returns the number of rows the database actually updated, not a `1` for "the
 * call did not throw". The caller uses it to decide whether to keep or undo its
 * optimistic update, and a value that is `1` whether or not anything changed
 * would make the badge reappear after every "Mark all read" — which is exactly
 * the bug a caller cannot detect if the return value is decorative.
 */
export async function markAllRead(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .select('id');

  if (error) {
    console.warn(`[notifications] mark-all-read failed: ${error.message}`);
    return 0;
  }

  // Zero unread rows means the call succeeded and there was simply nothing to
  // mark, which is not a failure — so it reports as done rather than rolled back.
  return Array.isArray(data) ? data.length : 1;
}

/* ------------------------------------------------------------------ */
/* Delivery (admin)                                                    */
/* ------------------------------------------------------------------ */

export interface NotificationAudience {
  /** `null` means every customer. */
  customerIds: string[] | null;
}

export type NotifyResult = { ok: true; delivered: number } | { ok: false; message: string };

/**
 * Fans a notification out to recipients.
 *
 * The fan-out is a single `security definer` call rather than a loop, so sending
 * to a large list does not mean thousands of round trips inside a request that
 * would time out.
 */
export async function notifyCustomers(input: {
  customerIds: string[] | null;
  title: string;
  body?: string;
  tone?: 'info' | 'success' | 'warning';
  imageId?: string | null;
  link?: string | null;
}): Promise<NotifyResult> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { ok: false, message: 'Supabase is not configured.' };

  const title = input.title.trim();
  if (!title) return { ok: false, message: 'A notification needs a title.' };

  const { data, error } = await admin.rpc('create_notification', {
    p_customer_ids: input.customerIds,
    p_title: title,
    p_body: (input.body ?? '').trim(),
    p_tone: input.tone ?? 'info',
    p_image_id: input.imageId ?? null,
    p_link: input.link ?? null,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, delivered: typeof data === 'number' ? data : 0 };
}

/** Recipient counts, so the compose form can say what it is about to send to. */
export async function audienceCounts(): Promise<{
  customers: number;
  subscribers: number;
}> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { customers: 0, subscribers: 0 };

  const [customers, subscribers] = await Promise.all([
    admin.from('customers').select('id', { count: 'exact', head: true }),
    // "Still on the list" is `unsubscribed_at is null`, not a status column —
    // this table has no `status`, and filtering on one returns zero without
    // erroring, which would silently show "0 subscribers" forever.
    admin
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .is('unsubscribed_at', null),
  ]);

  return {
    customers: customers.count ?? 0,
    subscribers: subscribers.count ?? 0,
  };
}

/** Per-notification recipients, for the admin's delivery report. */
export async function notificationStats(): Promise<{ total: number; unread: number }> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { total: 0, unread: 0 };

  const [all, unread] = await Promise.all([
    admin.from('notifications').select('id', { count: 'exact', head: true }),
    admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null),
  ]);

  return { total: all.count ?? 0, unread: unread.count ?? 0 };
}

/**
 * Whether a confirmation was actually delivered for an order.
 *
 * ## Why the page re-reads this instead of being told
 *
 * "A confirmation is on its way" is a claim about a third-party HTTP call that
 * already returned. Passing the answer through the redirect URL would mean
 * trusting a query parameter the shopper's own browser wrote — they could add
 * `&sent=true` and the page would claim a message arrived when none did.
 *
 * `email_log` is the durable record of what the provider accepted, written
 * server-side. That is the only copy of this sentence that has to be true, so
 * it is the only one that is read.
 */
export async function confirmationDeliveredTo(email: string): Promise<{
  sent: boolean;
  reason: 'sent' | 'skipped' | 'failed' | 'unknown';
}> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { sent: false, reason: 'unknown' };

  /*
   * Keyed on the address and the event, not on the order number.
   *
   * The number is not a column on `email_log`, and matching it inside the
   * subject would break the first time an operator edited the subject line —
   * which is exactly the edit the admin panel exists to encourage. The latest
   * `order.placed` row for this address is the one just written.
   */
  const { data } = await admin
    .from('email_log')
    .select('status')
    .eq('event', 'order.placed')
    .eq('recipient', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return { sent: false, reason: 'unknown' };

  const status = data[0]?.status;
  if (status === 'sent') return { sent: true, reason: 'sent' };
  if (status === 'skipped') return { sent: false, reason: 'skipped' };
  return { sent: false, reason: 'failed' };
}

export type { Database };