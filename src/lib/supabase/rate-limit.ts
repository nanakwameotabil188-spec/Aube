import { createAdminSupabaseClient } from './admin';

/**
 * Rate limiting.
 *
 * ## Why the counter is in the database
 *
 * The obvious implementation is a `Map` in module scope. That is wrong for this
 * app: it runs on more than one instance in any real deployment, and a limiter
 * that only knows about the process which happened to receive the request is not
 * a limiter. Ten instances means ten times the limit, and the attacker gets to
 * choose which instance to hit.
 *
 * Supabase is the one place every instance already agrees, so the counter lives
 * there and the increment is a single atomic statement.
 *
 * ## Fixed window, honestly
 *
 * This is a fixed window, not a sliding one, and the difference is real: a
 * caller can send `limit` requests at the end of one window and `limit` again at
 * the start of the next. A sliding window would not allow that.
 *
 * That tradeoff is accepted because the things being protected here — a password
 * reset, a newsletter signup, an account registration — are about bounding cost
 * and volume, not about enforcing a precise per-second rate. Where a precise
 * rate genuinely matters (login attempts against one account) that is enforced
 * separately by locking the account, which does not have this problem.
 */

/** Named buckets, so a limit can be tuned per action without magic numbers. */
export const RATE_LIMITS = {
  /** Sign-in attempts. */
  signIn: { limit: 8, windowSeconds: 300, label: 'sign-in attempts' },
  /** Account registration. */
  register: { limit: 5, windowSeconds: 3600, label: 'registrations' },
  /** Password reset requests. */
  passwordReset: { limit: 4, windowSeconds: 3600, label: 'password reset requests' },
  /** Newsletter signup. */
  newsletter: { limit: 5, windowSeconds: 3600, label: 'newsletter signups' },
  /** Contact form. */
  contact: { limit: 5, windowSeconds: 3600, label: 'contact messages' },
  /** Verification email resend. */
  verificationResend: { limit: 4, windowSeconds: 3600, label: 'verification emails' },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export interface RateLimitVerdict {
  allowed: boolean;
  /** Present when refused, so the caller can say something useful. */
  retryAfterSeconds?: number;
  remaining?: number;
}

/**
 * The caller-supplied part of a bucket key.
 *
 * `identifier` is what makes a limit per-person rather than global — an email
 * address for the auth buckets, an IP for anonymous ones. It is hashed rather
 * than stored raw: `rate_limit_counters.bucket` is a plain text column that an
 * admin or a backup could expose, and it should not become a list of who tried
 * to reset which password.
 */
function bucketKey(name: RateLimitName, identifier: string | null): string {
  const base = `rl:${name}`;
  if (!identifier) return base;
  return `${base}:${simpleHash(identifier.trim().toLowerCase())}`;
}

/** FNV-1a. Not cryptographic — this only needs to avoid storing the raw value. */
function simpleHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Records one attempt and reports whether it is allowed.
 *
 * Fails **open** when the counter table is unreachable. A rate limiter that
 * takes the site down when the database hiccups has caused a bigger outage than
 * the abuse it prevents, so a limiter that cannot be consulted does not block.
 */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string | null,
): Promise<RateLimitVerdict> {
  const settings = RATE_LIMITS[name];
  const admin = createAdminSupabaseClient();

  if (!admin) return { allowed: true };

  try {
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_bucket: bucketKey(name, identifier),
      p_limit: settings.limit,
      p_window_seconds: settings.windowSeconds,
    });

    if (error) {
      console.warn(`[rate-limit] ${name} could not be checked (${error.message}); allowing.`);
      return { allowed: true };
    }

    const allowed = data === true;
    return allowed
      ? { allowed: true }
      : { allowed: false, retryAfterSeconds: settings.windowSeconds };
  } catch (error) {
    console.warn(
      `[rate-limit] ${name} threw (${error instanceof Error ? error.message : 'unknown'}); allowing.`,
    );
    return { allowed: true };
  }
}

/** A message that does not say whether the account exists, for auth-shaped limits. */
export function rateLimitMessage(name: RateLimitName): string {
  const settings = RATE_LIMITS[name];
  const minutes = Math.max(1, Math.round(settings.windowSeconds / 60));

  return `Too many ${settings.label} from this device. Try again in ${minutes} minute${
    minutes === 1 ? '' : 's'
  }.`;
}