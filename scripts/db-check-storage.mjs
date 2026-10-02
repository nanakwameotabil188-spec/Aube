import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from './lib/env.mjs';

/**
 * Exercises the storage path end to end.
 *
 * Confirms the bucket actually accepts what `uploadImage` sends, that the
 * bucket's own MIME allowlist rejects what the app rejects, and that a
 * registered row survives a round trip. Everything created here is removed
 * again — a test that leaves objects behind is a test that costs money.
 */

loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const client = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

/** A real 1x1 PNG, so the bucket is validating actual image bytes. */
const PNG_BYTES = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

const created = [];

async function cleanup() {
  for (const path of created) {
    await client.storage.from('public').remove([path]);
    await client.from('images').delete().eq('storage_path', path);
  }
}

try {
  console.log('\nupload and round trip');

  const id = `img-test-${Date.now().toString(36)}`;
  const path = `products/${id}.png`;

  const { error: uploadError } = await client.storage
    .from('public')
    .upload(path, PNG_BYTES, { contentType: 'image/png', upsert: false });

  check('png uploads to the public bucket', !uploadError, uploadError?.message);
  if (!uploadError) created.push(path);

  if (!uploadError) {
    const { data: urlData } = client.storage.from('public').getPublicUrl(path);
    const response = await fetch(urlData.publicUrl);
    check('object is publicly readable', response.ok, `HTTP ${response.status}`);

    const { data: listed } = await client.storage.from('public').list('products');
    check('object appears in the bucket listing', Boolean(listed?.some((f) => f.name === `${id}.png`)));

    const { error: rowError } = await client.from('images').insert({
      id,
      url: urlData.publicUrl,
      storage_path: path,
      alt: 'A 1x1 transparent test pixel',
      mime_type: 'image/png',
      byte_size: PNG_BYTES.byteLength,
    });
    check('registers an images row', !rowError, rowError?.message);

    if (!rowError) {
      const { data: readBack } = await client
        .from('images')
        .select('id, alt, storage_path')
        .eq('id', id)
        .single();
      check('images row round trips', readBack?.alt === 'A 1x1 transparent test pixel');

      // The same constraints the app enforces, checked at the bucket rather
      // than in application code, so a direct API call cannot bypass them.
      const { error: mimeError } = await client.storage
        .from('public')
        .upload(`${path}.svg`, '<svg onload="alert(1)"></svg>', {
          contentType: 'image/svg+xml',
          upsert: false,
        });
      check('bucket rejects a disallowed mime type', Boolean(mimeError), mimeError?.message);

      const oversized = new Uint8Array(9 * 1024 * 1024);
      const { error: sizeError } = await client.storage
        .from('public')
        .upload(`products/${id}-big.png`, oversized, { contentType: 'image/png', upsert: false });
      check('bucket rejects an oversized file', Boolean(sizeError), sizeError?.message);
    }
  }

  console.log('\nprivate bucket is not public');
  const { data: privateUrl } = client.storage.from('admin-private').getPublicUrl('probe.png');
  const privateResponse = await fetch(privateUrl.publicUrl);
  check('private object is not anonymously readable', !privateResponse.ok, `HTTP ${privateResponse.status}`);
} finally {
  await cleanup();
}

console.log(failures === 0 ? '\nall storage checks passed' : `\n${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
