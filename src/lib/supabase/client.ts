import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Browser Supabase client.
 *
 * Only for client components that need to talk to Supabase directly: the
 * session check in the admin shell, and optimistic cart writes once the cart
 * moves server-side. Server components must not use this; they use
 * `createServerSupabaseClient` so RLS sees the shopper's cookies.
 */
let cached: ReturnType<typeof createBrowserClient> | null = null;

export function createBrowserSupabaseClient() {
  if (cached) return cached;
  cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
