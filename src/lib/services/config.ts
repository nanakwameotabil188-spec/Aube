/**
 * Data source configuration.
 *
 * `DATA_SOURCE` is the seam between the mock content layer and a real backend.
 * Switching to `supabase` makes the catalog services in
 * `lib/services/repositories` read Postgres instead of `@/data`. Components do
 * not change, because they only ever see the domain contracts in `@/types`.
 *
 * If `supabase` is selected but the credentials are missing, the repository
 * selector falls back to the mock rather than failing, so a misconfigured
 * environment still renders a working store.
 */
export const DATA_SOURCE = (process.env.DATA_SOURCE === 'supabase' ? 'supabase' : 'mock') as
  | 'mock'
  | 'supabase';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.aube.com/v1';

/** Simulated latency for mock reads, so loading states are actually exercised. */
export const MOCK_LATENCY_MS = 0;

export const SERVICE_ERRORS = {
  network: 'We could not reach our servers. Please try again in a moment.',
  notFound: 'We could not find that page.',
  unauthorised: 'Please sign in to continue.',
  unknown: 'Something went wrong on our side. Please try again.',
} as const;

