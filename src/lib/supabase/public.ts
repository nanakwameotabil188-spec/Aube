import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

/**
 * Stateless public Supabase client.
 *
 * The storefront's catalogue is public data: products, taxonomy, images,
 * published reviews. Row Level Security already decides what the anon role may
 * see — a hidden product is not returned because the policy says
 * `using (visible)`, not because of who is asking.
 *
 * This client deliberately does *not* read cookies, which is what
 * `createServerSupabaseClient` does. Two reasons:
 *
 *  1. `generateStaticParams` runs at build time with no request, so any call to
 *     `cookies()` there is an error. Pre-rendering the catalogue from a
 *     cookie-scoped client cannot work; this one can.
 *  2. Nothing in the catalogue is per-visitor, so parsing and re-serialising a
 *     session cookie on every catalogue read is cost with no effect.
 *
 * Anything that genuinely depends on who is asking — the admin gate and every
 * admin write — uses the cookie-scoped client in `server.ts`, or the
 * service-role client in `admin.ts`. Those are the only two places a session
 * matters.
 *
 * Returns `null` when Supabase is not configured, so the caller falls back to
 * the mock repository instead of treating it as an error.
 */
export function createPublicSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export type PublicSupabaseClient = NonNullable<ReturnType<typeof createPublicSupabaseClient>>;
