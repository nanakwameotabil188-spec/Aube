import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

/**
 * Server Supabase client.
 *
 * Reads and writes the session cookie so Row Level Security evaluates against
 * the signed-in shopper rather than the anon role. This is the client the
 * storefront's data layer should use.
 *
 * Returns `null` when Supabase is not configured, which is the normal state of
 * a local checkout of this project. Callers fall back to the mock repository
 * rather than treating that as an error.
 */
export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // session is still refreshed by the middleware, so this is safe to
          // ignore: the alternative is throwing on every server render.
        }
      },
    },
  });
}

export type ServerSupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createServerSupabaseClient>>
>;
