import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, hasServiceRoleKey } from './config';

/**
 * Service-role client.
 *
 * Bypasses Row Level Security. Reserved for the admin panel's writes, which
 * have no user-facing read path yet. Never import this from a client component:
 * `import 'server-only'` makes that a build error rather than a leak.
 *
 * Returns `null` when the key is absent so the admin panel can render a clear
 * "not configured" state instead of crashing.
 */
export function createAdminSupabaseClient() {
  if (!hasServiceRoleKey()) return null;

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;
