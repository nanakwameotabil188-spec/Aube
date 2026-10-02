import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { loadEnvFile } from './lib/env.mjs';

/**
 * Migration runner.
 *
 * Applies every `supabase/migrations/*.sql` in filename order and records what
 * ran in `schema_migrations`, so re-running is a no-op.
 *
 * Connects with `DIRECT_URL` deliberately: `db push`-style DDL needs a real
 * session, and the transaction-mode pooler on port 6543 cannot hold one.
 */

const MIGRATIONS_DIR = path.resolve('supabase/migrations');

async function main() {
  loadEnvFile();

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('No DIRECT_URL or DATABASE_URL. Add one to .env.local.');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        version    text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Set(
      (await client.query('select version from schema_migrations')).rows.map((r) => r.version),
    );

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    let ran = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');

      // Each file is one transaction: a failure leaves no partial schema and
      // no row in schema_migrations, so the next run retries the whole file.
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into schema_migrations (version) values ($1)', [file]);
        await client.query('commit');
        console.log(`  ok    ${file}`);
        ran += 1;
      } catch (error) {
        await client.query('rollback');
        console.error(`  FAIL  ${file}`);
        console.error(`        ${error.message}`);
        process.exitCode = 1;
        return;
      }
    }

    console.log(
      ran === 0
        ? `\nschema up to date (${files.length} migration(s))`
        : `\napplied ${ran} migration(s)`,
    );
  } finally {
    await client.end();
  }
}

main();
