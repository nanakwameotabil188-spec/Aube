import 'server-only';

import { createPublicSupabaseClient } from './public';
import { createAdminSupabaseClient } from './admin';

/**
 * Newsletter capture.
 *
 * The public signup writes through the anon client rather than the service-role
 * one. That is not a limitation — it is the point. An anon insert is exactly
 * what the `anyone may subscribe` policy permits, so the signup path holds no
 * credential that could do anything else. The service role is reserved for the
 * admin read, where RLS would otherwise hide the list from the panel.
 */

/**
 * The one address that opens the admin flow instead of subscribing.
 *
 * This is a *routing* rule, not a credential. It grants nothing: the address
 * is checked here, the signup is skipped, and the caller is sent to the login
 * page where Supabase Auth still demands a real password for an `admin_users`
 * row. Knowing this string is no closer to the dashboard than knowing the
 * login page exists.
 *
 * It lives on the server so there is a single source of truth. A client-side
 * copy would be a second place to update and a second place to get wrong, and
 * it would put the address in the browser bundle for no benefit — the client
 * only needs to know which of the three results came back.
 */
const ADMIN_ACCESS_EMAIL = 'shopaurai@gmail.com';

/**
 * Compared case-insensitively because email addresses are case-insensitive in
 * practice and Supabase Auth lowercases its own. An exact match would make the
 * trigger depend on how the address happened to be typed, which is a trap
 * rather than a security control.
 */
export function isAdminAccessEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_ACCESS_EMAIL;
}

export type SubscribeResult =
  /** Stored, or already present. Either way the visitor is on the list. */
  | { status: 'subscribed' }
  /** The reserved address: not stored, and the caller should route to login. */
  | { status: 'admin' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

/** Deliberately permissive: the real test is whether a provider accepts it. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeToNewsletter(email: string, source = 'homepage'): Promise<SubscribeResult> {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) return { status: 'invalid' };

  // Checked before the insert, not after. A row written and then deleted would
  // still have put the address in the list for however long it took to remove.
  if (isAdminAccessEmail(normalized)) return { status: 'admin' };

  const supabase = createPublicSupabaseClient();
  if (!supabase) return { status: 'unavailable' };

  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: normalized, source });

  if (error) {
    // A duplicate is a success from the visitor's point of view: they are on
    // the list, and telling them otherwise would be a lie.
    if (error.code === '23505') return { status: 'subscribed' };
    return { status: 'unavailable' };
  }

  return { status: 'subscribed' };
}

export interface AdminSubscriber {
  id: string;
  email: string;
  source: string;
  createdAt: string;
}

/** Admin-only. Returns `null` when Supabase is unconfigured. */
export async function listNewsletterSubscribers(limit = 500): Promise<AdminSubscriber[] | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, source, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return null;

  return data.map((row) => ({
    id: row.id as string,
    email: row.email as string,
    source: row.source as string,
    createdAt: row.created_at as string,
  }));
}
