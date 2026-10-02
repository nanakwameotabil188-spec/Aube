import 'server-only';

import { createAdminSupabaseClient } from './admin';
import { createServerSupabaseClient } from './server';
import { getAdminStatus } from './admin-data';

/**
 * Admin authorisation.
 *
 * The service-role key bypasses Row Level Security by design, so the database
 * cannot protect anything for code that holds it. Every admin route therefore
 * has to establish *who is asking* before it constructs that client, or the
 * whole area is one unauthenticated request away from being fully public.
 *
 * Two checks, in order:
 *
 *  1. Is Supabase configured at all? If not there is nothing to authenticate
 *     against, so the panel stays in its "not configured" state rather than
 *     pretending to be a login screen that grants access.
 *  2. Does the caller's Supabase session belong to a row in `admin_users`?
 *     The role is read from the database, never from a cookie the client can
 *     influence.
 */

export type AdminRole = 'admin' | 'editor';

export type AdminAuth =
  | { authenticated: true; userId: string; email: string; role: AdminRole; name: string }
  | { authenticated: false; reason: 'not_configured' | 'no_session' | 'not_authorised'; detail: string };

/**
 * Resolve the caller's admin identity.
 *
 * Returns a discriminated result rather than throwing or returning `null`, so
 * a route can render the right explanation: "Supabase is not configured" is a
 * very different problem from "you are signed in but not an administrator".
 */
export async function getAdminAuth(): Promise<AdminAuth> {
  const status = getAdminStatus();
  if (!status.ready) {
    return { authenticated: false, reason: 'not_configured', detail: status.detail };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      authenticated: false,
      reason: 'not_configured',
      detail: 'The server Supabase client is unavailable.',
    };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    return {
      authenticated: false,
      reason: 'no_session',
      detail: 'Sign in with an administrator account to continue.',
    };
  }

  // The role lives in the database, keyed by the authenticated user id. Using
  // the email from the verified session rather than anything the client sends.
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { authenticated: false, reason: 'not_configured', detail: 'No service role client.' };
  }

  const { data: row, error: lookupError } = await admin
    .from('admin_users')
    .select('user_id, email, full_name, role, active')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (lookupError) {
    return {
      authenticated: false,
      reason: 'not_authorised',
      detail: lookupError.message,
    };
  }

  if (!row || !row.active) {
    return {
      authenticated: false,
      reason: 'not_authorised',
      detail: `${data.user.email} is not an active administrator.`,
    };
  }

  return {
    authenticated: true,
    userId: row.user_id,
    email: row.email,
    role: row.role,
    name: row.full_name,
  };
}

/** Narrowing helper for route handlers that already called `getAdminAuth`. */
export function isAdmin(auth: AdminAuth): auth is Extract<AdminAuth, { authenticated: true }> {
  return auth.authenticated;
}
