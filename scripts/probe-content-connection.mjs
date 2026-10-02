/*
 * Proves the storefront actually reads the database now.
 *
 * The same probe that showed branding was decorative, re-run after the content
 * overlay. Writes a distinctive brand name, asks the storefront what it renders,
 * and puts the original value back.
 *
 * The revert is written defensively — in the earlier run of this probe the
 * restore silently failed and left the probe string in production data, which is
 * exactly the kind of thing that makes a test unsafe to run. It now verifies the
 * restore happened and says so loudly if it did not.
 */

import pg from 'pg';
import { loadEnvFile } from './lib/env.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4310';
const MARKER = 'ZZ-FORENSIC-PROBE';

loadEnvFile();

const c = new pg.Client({ connectionString: process.env.DIRECT_URL });
await c.connect();

const original = (await c.query(`select value from settings where key='brand'`)).rows[0]?.value ?? {};
const originalName = original.brandName;

console.log(`brandName was: ${JSON.stringify(originalName)}`);

let restored = false;
try {
  await c.query(
    `update settings set value = value || jsonb_build_object('brandName', $1::text) where key='brand'`,
    [MARKER],
  );
  await new Promise((r) => setTimeout(r, 1500));

  const html = await (await fetch(`${BASE}/`)).text();
  const seen = html.includes(MARKER);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '(none)';

  console.log(`\n  storefront HTML contains the new name: ${seen}`);
  console.log(`  page title: ${title}`);
  console.log(seen ? '\nRESULT: the storefront READS the database — branding is connected.' : '\nRESULT: still not reading the database.');
} finally {
  // Restore by writing the original object back wholesale.
  await c.query(`update settings set value = $1::jsonb where key='brand'`, [JSON.stringify(original)]);
  const check = await c.query(`select value->>'brandName' as n from settings where key='brand'`);
  restored = check.rows[0]?.n === originalName;
  console.log(`\n  reverted brandName to: ${JSON.stringify(check.rows[0]?.n)}${restored ? '' : '  *** RESTORE FAILED ***'}`);
  await c.end();
}

process.exit(restored ? 0 : 1);
