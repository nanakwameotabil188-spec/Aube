import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Minimal `.env.local` reader.
 *
 * Next.js loads this file itself, but scripts under `scripts/` run before any
 * Next process exists, so they need their own copy. Kept dependency-free and
 * strict: a malformed line is ignored rather than silently producing a wrong
 * value, because a half-read password looks exactly like a wrong password.
 */

export function loadEnvFile(file = '.env.local') {
  let raw;
  try {
    raw = readFileSync(path.resolve(file), 'utf8');
  } catch {
    return process.env;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!key) continue;

    let value = trimmed.slice(separator + 1).trim();

    // Strip one layer of matching quotes, which keeps a password containing
    // `#` or a space intact.
    const quoted =
      value.length > 1 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);

    // A real process environment wins, matching Next's own precedence.
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return process.env;
}
