/**
 * Supabase environment.
 *
 * Read once, validated, and exported as a single object so no module has to
 * reach into `process.env` itself. `isSupabaseConfigured` is the check every
 * caller should make before touching the network: the storefront ships with
 * mock content and must keep working with no credentials at all.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Present only in the server environment. Never reaches the browser bundle. */
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const SUPABASE_URL = url ?? '';
export const SUPABASE_ANON_KEY = anonKey ?? '';
export const SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey ?? '';

/** True when the public credentials needed for anon reads are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

/** True when the service-role key is present, enabling RLS-bypassing admin reads. */
export function hasServiceRoleKey(): boolean {
  return Boolean(url && serviceRoleKey);
}

/**
 * Explains what is missing, for the admin panel and for the setup error rather
 * than a generic failure. Keeps `.env.local` mistakes legible.
 */
export function describeSupabaseConfig(): { ready: boolean; message: string } {
  if (!url) return { ready: false, message: 'NEXT_PUBLIC_SUPABASE_URL is not set.' };
  if (!anonKey) return { ready: false, message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.' };
  if (!/^https?:\/\//.test(url)) {
    return { ready: false, message: 'NEXT_PUBLIC_SUPABASE_URL must start with http:// or https://' };
  }
  return { ready: true, message: 'Supabase is configured.' };
}
