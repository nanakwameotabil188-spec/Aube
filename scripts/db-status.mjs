import { Client } from 'pg';
import { loadEnvFile } from './lib/env.mjs';

/**
 * Reports what the remote database actually looks like.
 *
 * Written because "the migration said ok" and "the schema is correct" are
 * different claims, and the admin panel's behaviour depends on the second one.
 */

loadEnvFile();

const url = process.env.DIRECT_URL;
if (!url) {
  console.error('No DIRECT_URL. Add one to .env.local.');
  process.exit(1);
}

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

async function count(label, sql) {
  const { rows } = await client.query(sql);
  console.log(`  ${label.padEnd(26)} ${rows[0]?.n ?? 0}`);
}

try {
  const { rows: buckets } = await client.query(
    `select id, public, file_size_limit from storage.buckets order by id`,
  );

  console.log('\nstorage buckets');
  for (const bucket of buckets) {
    console.log(
      `  ${bucket.id.padEnd(16)} public=${bucket.public}  limit=${bucket.file_size_limit ?? 'default'}`,
    );
  }

  console.log('\nrow counts');
  for (const [label, table] of [
    ['taxonomy_terms', 'taxonomy_terms'],
    ['images', 'images'],
    ['products', 'products'],
    ['product_variants', 'product_variants'],
    ['product_images', 'product_images'],
    ['product_badges', 'product_badges'],
    ['product_key_ingredients', 'product_key_ingredients'],
    ['product_skin_types', 'product_skin_types'],
    ['product_skin_concerns', 'product_skin_concerns'],
    ['product_ingredients', 'product_ingredients'],
    ['product_hero_ingredients', 'product_hero_ingredients'],
    ['product_collections', 'product_collections'],
    ['reviews', 'reviews'],
    ['customers', 'customers'],
    ['orders', 'orders'],
    ['settings', 'settings'],
    ['onboarding_slides', 'onboarding_slides'],
    ['home_sections', 'home_sections'],
    ['admin_users', 'admin_users'],
  ]) {
    await count(label, `select count(*)::int as n from ${table}`);
  }

  const { rows: views } = await client.query(
    `select table_name from information_schema.views where table_schema = 'public' order by table_name`,
  );
  console.log(`\n  views: ${views.map((v) => v.table_name).join(', ') || 'none'}`);

  const { rows: rlsOff } = await client.query(`
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    order by c.relname
  `);
  console.log(`  tables without RLS: ${rlsOff.map((t) => t.relname).join(', ') || 'none'}`);
} finally {
  await client.end();
}
