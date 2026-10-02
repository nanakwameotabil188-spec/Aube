import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Encryption for provider secrets.
 *
 * ## Why this exists
 *
 * The admin panel collects a live payment gateway key and a live email provider
 * key. Those are the two credentials in this project that can directly cost
 * money or be used to impersonate the shop. They are stored in `integrations`,
 * which no anon client can read, and that is the first line of defence — but
 * "unreadable from the web" is not the same as "safe at rest". A database
 * backup, a leaked service-role key, or a `pg_dump` in somebody's inbox would
 * still hand over a live secret in plaintext.
 *
 * So the secret is encrypted with AES-256-GCM before it is written, using a key
 * that lives in the environment and never in the database. A dump on its own is
 * inert: there is no key beside it.
 *
 * ## Format
 *
 * `iv:authTag:ciphertext`, each base64, joined by colons.
 *
 * The auth tag is kept and verified on read rather than being decorative. GCM
 * without checking the tag is just AES-CBC with extra steps: it fails loudly on
 * a wrong key or a tampered row instead of returning garbage that would be sent
 * to a payment gateway as an API key.
 *
 * ## Server-only
 *
 * `node:crypto` and `process.env.SECRET_ENCRYPTION_KEY` both belong on the
 * server. This module is imported only from `src/lib/supabase/*` and Server
 * Actions, and nothing under `src/app/(storefront)` reaches it.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Cache of the derived key per raw key string.
 *
 * Key derivation is deliberately expensive, and it runs on every secret read.
 * A module-level `Map` keeps it to once per process. The derived key is already
 * fixed-length key material, so this is not a plaintext password sitting in
 * memory any longer than the raw key it came from.
 */
const derived = new Map<string, Buffer>();

function deriveKey(raw: string): Buffer {
  const cached = derived.get(raw);
  if (cached) return cached;

  const key = createHash('sha256').update(raw, 'utf8').digest();
  derived.set(raw, key);
  return key;
}

/**
 * Whether a usable encryption key is configured.
 *
 * Checked at the point of use rather than assumed, because the admin panel has
 * to explain the difference between "no key stored" and "no encryption key
 * configured" — the second is a deployment problem, and the first is normal.
 */
export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.SECRET_ENCRYPTION_KEY?.trim());
}

/**
 * Explains a missing or unusable key, for the admin panel.
 *
 * A key shorter than 32 characters is rejected rather than stretched. Deriving
 * AES-256 from a short passphrase is fine cryptographically, but accepting one
 * here would let somebody deploy with `SECRET_ENCRYPTION_KEY=changeme` and not
 * find out until a secret was already written under it.
 */
export function describeEncryptionConfig(): { ready: boolean; message: string } {
  const raw = process.env.SECRET_ENCRYPTION_KEY?.trim();

  if (!raw) {
    return {
      ready: false,
      message:
        'SECRET_ENCRYPTION_KEY is not set. Set it in the deployment environment before storing provider credentials.',
    };
  }
  if (raw.length < 32) {
    return {
      ready: false,
      message: `SECRET_ENCRYPTION_KEY must be at least 32 characters (currently ${raw.length}).`,
    };
  }

  return { ready: true, message: 'Provider secrets are encrypted at rest.' };
}

function requireKey(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      'SECRET_ENCRYPTION_KEY is not set, so provider credentials cannot be stored. ' +
        'Set it in the deployment environment.',
    );
  }
  if (raw.length < 32) {
    throw new Error('SECRET_ENCRYPTION_KEY must be at least 32 characters.');
  }
  return deriveKey(raw);
}

/** Encrypts a value into the `iv:tag:ciphertext` transport format. */
export function encryptSecret(plaintext: string): string {
  const key = requireKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Decrypts a value produced by {@link encryptSecret}. Throws if tampered. */
export function decryptSecret(encoded: string): string {
  const key = requireKey();

  const parts = encoded.split(':');
  if (parts.length !== 3) {
    throw new Error('stored secret is not in the expected format');
  }

  const iv = Buffer.from(parts[0] as string, 'base64');
  const tag = Buffer.from(parts[1] as string, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2] as string, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Wrong key, or the row was edited. Either way the value must not be used:
    // sending a corrupted API key to a gateway produces a confusing 401 instead
    // of an honest "the encryption key does not match this database".
    throw new Error(
      'stored secret could not be decrypted — SECRET_ENCRYPTION_KEY does not match the one used to write it',
    );
  }
}

/**
 * A value that is safe to render in the admin form.
 *
 * Shows enough to identify which key is stored and nothing that could be used
 * as one: the last four characters and the length. Provider dashboards routinely
 * show this much themselves, and it is the difference between an operator
 * knowing *which* key is live and being handed the key itself.
 *
 * The whole point is that the plaintext is never returned to a client, so the
 * form can show this instead of a real value.
 */
export function maskSecret(value: string): string {
  if (!value) return '';

  const tail = value.length <= 4 ? value : value.slice(-4);
  const dots = '.'.repeat(Math.min(16, Math.max(4, value.length - 4)));

  return `••••${dots}${tail}`;
}

/** Constant-time comparison, for tokens where timing would otherwise leak. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** A URL-safe random token, for verification links and unsubscribe links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex. Used to store a token's fingerprint rather than the token. */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}