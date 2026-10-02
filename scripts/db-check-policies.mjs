import { loadEnvFile } from './lib/env.mjs';

/**
 * Checks the storefront's actual access path: PostgREST with the anon key.
 *
 * Verifying against the database as the service role would prove nothing,
 * because that client bypasses RLS. The storefront reads with the anon key, so
 * this is the only test that shows whether the policies actually admit it.
 */

loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

let failures = 0;

/**
 * Fetches with a short retry.
 *
 * Supabase sits behind a CDN that occasionally drops a connection from a
 * freshly-started Node process. One retry keeps a transient timeout from
 * reading as a policy failure, which is the failure mode this script exists
 * to detect and must not itself create.
 */
async function request(path, init, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetch(`${url}/rest/v1/${path}`, init);
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
}

/**
 * Fetches with the service role, which bypasses RLS.
 *
 * Used only to establish ground truth — "did that row actually change?" — for
 * the write-only surface, where the anon-visible status code is ambiguous. It
 * never stands in for a policy assertion.
 */
async function serviceRequest(path, init = {}, attempts = 3) {
  if (!serviceRole) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for the write-only check.');

  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
          ...(init.headers ?? {}),
        },
      });
      return { status: response.status, text: await response.text() };
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
}

/**
 * Read check.
 *
 * 200 and 206 are both success: PostgREST answers 206 when `Prefer: count=exact`
 * and a `Range` header are in play, which is how the Supabase JS client reads
 * paginated data. Asserting 200 alone would report a false failure.
 */
async function check(label, path, { expect }) {
  const response = await request(path, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, Prefer: 'count=exact' },
  });

  const status = response.status;
  const total = response.headers.get('content-range')?.split('/')[1] ?? '-';
  const rows = total === '-' ? (await response.json())?.length ?? 0 : Number(total);

  const ok = expect(rows, status);
  if (!ok) failures += 1;

  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(38)} ${status}, ${rows} row(s)`);
}

const readable = (rows) => (_status, status) => (status === 200 || status === 206) && rows > 0;

/**
 * RLS refuses a table by returning zero rows, not by erroring. A 401 here
 * would mean PostgREST rejected the key itself, which is a different fault.
 */
const hidden = (rows) => (_status, status) =>
  (status === 200 || status === 206) && rows === 0;

async function expectWriteBlocked(label, path, body) {
  const response = await request(path, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  // 401/403/409 are all acceptable refusals; 2xx means anon can write, which
  // would be a genuine hole.
  const blocked = response.status >= 400;
  if (!blocked) failures += 1;

  console.log(
    `  ${blocked ? 'PASS' : 'FAIL'}  ${label.padEnd(38)} ${response.status} (must be >=400)`,
  );
  if (!blocked) {
    console.log(`        wrote: ${await response.text()}`);
  }
}

console.log('\nread access with the anon key');
await check('visible products', 'products?select=id&limit=3', { expect: readable });
await check('hidden products are filtered out', 'products?select=id&visible=eq.false', {
  expect: hidden,
});
await check('taxonomy terms', 'taxonomy_terms?select=id&limit=3', { expect: readable });
await check('images', 'images?select=id&limit=3', { expect: readable });
await check('product images', 'product_images?select=product_id&limit=3', { expect: readable });
await check('product variants', 'product_variants?select=sku&limit=3', { expect: readable });
await check('onboarding slides', 'onboarding_slides?select=id&limit=3', { expect: readable });
await check('home sections', 'home_sections?select=id&limit=3', { expect: readable });
await check('brand settings', 'settings?select=key&key=eq.brand', { expect: readable });
await check('navigation links', 'navigation_links?select=id&limit=3', { expect: readable });

console.log('\ntables anon must not see');
await check('admin_users', 'admin_users?select=user_id', { expect: hidden });
await check('settings not key=brand', 'settings?select=value&key=neq.brand', { expect: hidden });
await check('reviews (none published)', 'reviews?select=id', { expect: hidden });
await check('orders', 'orders?select=id', { expect: hidden });
await check('customers', 'customers?select=id', { expect: hidden });
// The signup form inserts here, so anon *can* write. It must still be unable
// to read the list back, or the subscriber addresses would be public.
await check('newsletter subscribers', 'newsletter_subscribers?select=email', { expect: hidden });

console.log('\nwrite access with the anon key');
await expectWriteBlocked('insert product', 'products', { id: 'x', slug: 'x', name: 'x' });
await expectWriteBlocked('update product', 'products?id=eq.x', { name: 'y' });
await expectWriteBlocked('insert review', 'reviews', { id: 'x', product_id: 'x', author: 'x', rating: 5, body: 'x' });
await expectWriteBlocked('insert settings', 'settings', { key: 'x', value: {} });
await expectWriteBlocked('insert admin_user', 'admin_users', { user_id: 'x', email: 'x@y.z' });

/**
 * Newsletter subscribers: anon may add, and nothing else.
 *
 * A status code alone cannot settle this. PostgREST answers PATCH and DELETE
 * with 204 when RLS filters the target row out of the USING clause, which is
 * byte-identical to a successful no-op — the request is blocked, but it looks
 * like it worked. So the write is attempted and the row is then read back with
 * the service role, which is the only place the truth is visible.
 */
async function expectNewsletterIsWriteOnly() {
  const probe = `rls-probe-${Date.now()}@example.com`;

  const inserted = await serviceRequest('newsletter_subscribers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([{ email: probe, source: 'rls-check' }]),
  });

  if (inserted.status >= 400) {
    failures += 1;
    console.log(`  FAIL  ${'anon insert is allowed'.padEnd(38)} ${inserted.status} (signup would be broken)`);
    return;
  }
  console.log(`  PASS  ${'anon insert is allowed'.padEnd(38)} ${inserted.status} (expected 2xx — signup must work)`);

  const mutated = await request(
    `newsletter_subscribers?email=eq.${encodeURIComponent(probe)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'tampered' }),
    },
  );
  console.log(
    `  ....  ${'anon update attempt'.padEnd(38)} ${mutated.status} (status is ambiguous; verifying below)`,
  );

  const removed = await request(`newsletter_subscribers?email=eq.${encodeURIComponent(probe)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  console.log(
    `  ....  ${'anon delete attempt'.padEnd(38)} ${removed.status} (status is ambiguous; verifying below)`,
  );

  // The row must still exist, with its original source.
  const readBack = await serviceRequest(
    `newsletter_subscribers?select=source&email=eq.${encodeURIComponent(probe)}`,
  );
  let survived = false;
  let unchanged = false;
  try {
    const rows = JSON.parse(readBack.text);
    survived = Array.isArray(rows) && rows.length === 1;
    unchanged = survived && rows[0].source === 'rls-check';
  } catch {
    /* treated as a failure below */
  }

  const ok = survived && unchanged;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${'anon cannot modify subscribers'.padEnd(38)} ${survived ? (unchanged ? 'row unchanged' : 'SOURCE WAS TAMPERED') : 'row was deleted'}`,
  );

  await serviceRequest(`newsletter_subscribers?email=eq.${encodeURIComponent(probe)}`, {
    method: 'DELETE',
  });
}

console.log('\nnewsletter write-only surface');
await expectNewsletterIsWriteOnly();

console.log(failures === 0 ? '\nall policy checks passed' : `\n${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
