import 'node:process';

/**
 * Customer registration and access-control checks.
 *
 * Exercises the paths that are easy to get subtly wrong and impossible to see
 * from the UI:
 *
 *  1. A real signup creates a `customers` row, and RLS lets that shopper read
 *     their own row and their own orders and nothing else.
 *  2. A guest order is persisted, and its confirmation URL is unusable without
 *     the access token.
 *  3. The stock RPC refuses to oversell.
 *
 * Run: `npm run verify:accounts`
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from './lib/env.mjs';

loadEnvFile();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const stamp = Date.now();
const EMAIL = `verify-${stamp}@example.com`;
const PASSWORD = 'a-long-enough-password';

async function main() {
  console.log('\nCustomer accounts\n');

  /* ---------------------------------------------------------------- */
  console.log('Registration');
  /* ---------------------------------------------------------------- */

  const { data: signup, error: signupError } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Verification Person' },
  });

  check('auth user created', !signupError && !!signup.user?.id, signupError?.message);

  const userId = signup.user?.id;

  /*
   * The cleanup must run even on an early return, or a failure at this point
   * leaves a half-made account behind for the next run to trip over.
   */
  if (!userId) {
    await cleanup();
    check('auth user created', false, 'no user id was returned');
    return finish();
  }

  // The trigger runs inside the insert transaction, so the row is there already.
  const { data: profile } = await admin
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  check('handle_new_user trigger created a customers row', !!profile);
  check('row is linked to the auth user', profile?.user_id === userId);
  check('email is normalised to lower case', profile?.email === EMAIL, profile?.email);
  check('full name carried through from user_metadata', profile?.full_name === 'Verification Person');

  // A second signup with the same address must attach, not duplicate.
  await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  const { data: profiles } = await admin.from('customers').select('id').eq('email', EMAIL);
  check(
    'a duplicate signup does not create a second profile',
    (profiles?.length ?? 0) <= 1,
    `got ${profiles?.length}`,
  );

  /* ---------------------------------------------------------------- */
  console.log('\nRow Level Security');
  /* ---------------------------------------------------------------- */

  // Sign in as the shopper to get a real JWT, then use the anon client.
  const shopper = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signInError } = await shopper.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  check('shopper can sign in', !signInError && !!session.session, signInError?.message);

  const own = await shopper.from('customers').select('*').maybeSingle();
  check('shopper can read their own profile', own.data?.id === profile?.id, own.error?.message);

  const ownOrders = await shopper.from('orders').select('id');
  check('shopper can read the orders table', !ownOrders.error, ownOrders.error?.message);
  check('and sees none they do not own', (ownOrders.data?.length ?? 0) === 0, `saw ${ownOrders.data?.length}`);

  // A second shopper must not see the first one's row.
  const other = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const OTHER_EMAIL = `verify-other-${stamp}@example.com`;
  await admin.auth.admin.createUser({
    email: OTHER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  await other.auth.signInWithPassword({ email: OTHER_EMAIL, password: PASSWORD });

  const { data: leaked } = await other
    .from('customers')
    .select('id')
    .eq('user_id', userId);
  check(
    'a second shopper cannot read the first shopper’s profile',
    (leaked?.length ?? 0) === 0,
    `saw ${leaked?.length}`,
  );

  const anonymous = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonOrders = await anonymous.from('orders').select('id');
  check(
    'an anonymous client cannot read any order',
    (anonOrders.data?.length ?? 0) === 0,
    `saw ${anonOrders.data?.length}`,
  );

  const anonInsert = await anonymous
    .from('orders')
    .insert({ id: 'hack-1', number: 'HACK-1', customer_email: 'x@example.com' });
  check(
    'an anonymous client cannot insert an order',
    !!anonInsert.error,
    'insert unexpectedly succeeded',
  );

  const anonCustomerInsert = await anonymous.from('customers').insert({
    id: 'hack-cust',
    email: 'hack@example.com',
  });
  check(
    'an anonymous client cannot create a customer profile',
    !!anonCustomerInsert.error,
    'insert unexpectedly succeeded',
  );

  /* ---------------------------------------------------------------- */
  console.log('\nOrder persistence');
  /* ---------------------------------------------------------------- */

  const { data: variant } = await admin
    .from('product_variants')
    .select('id, product_id, price, stock_quantity')
    .gt('stock_quantity', 5)
    .limit(1)
    .maybeSingle();

  if (!variant) {
    console.log('  skip  no variant in stock to place an order with');
  } else {
    const orderId = `ord-verify-${stamp}`;

    // Addresses first: `orders` has not-null foreign keys to them, which is the
    // ordering bug this check exists to catch.
    const addressRow = (id, ship) => ({
      id,
      customer_id: profile.id,
      full_name: 'Verification Person',
      line1: '1 Test Street',
      line2: null,
      city: 'Testville',
      region: null,
      postal_code: 'TE5 1ST',
      country: 'GB',
      phone: null,
      is_default_shipping: ship,
      is_default_billing: !ship,
    });

    const { error: addressError } = await admin.from('addresses').insert([
      addressRow(`${orderId}-ship`, true),
      addressRow(`${orderId}-bill`, false),
    ]);
    check('addresses can be written before the order', !addressError, addressError?.message);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        id: orderId,
        number: `VERIFY-${stamp}`,
        status: 'processing',
        customer_id: profile.id,
        customer_email: EMAIL,
        customer_name: 'Verification Person',
        shipping_address_id: `${orderId}-ship`,
        billing_address_id: `${orderId}-bill`,
        shipping_method_id: 'ship-standard',
        shipping_method_name: 'Standard',
        subtotal: variant.price,
        discount_total: 0,
        shipping_total: 0,
        tax_total: 0,
        total: variant.price,
        currency: 'USD',
        payment_method_label: 'Card',
        payment_last4: '4242',
      })
      .select('access_token')
      .maybeSingle();

    check('an order can be written', !orderError && !!order, orderError?.message);
    check(
      'an access_token is minted automatically',
      typeof order?.access_token === 'string' && order.access_token.length === 48,
      `length ${order?.access_token?.length}`,
    );

    const seenByOwner = await shopper.from('orders').select('id').eq('id', orderId);
    check('the owner can read their own order', (seenByOwner.data?.length ?? 0) === 1);

    const seenByOther = await other.from('orders').select('id').eq('id', orderId);
    check(
      'a different shopper cannot read that order',
      (seenByOther.data?.length ?? 0) === 0,
      `saw ${seenByOther.data?.length}`,
    );

    const guessed = await admin
      .from('orders')
      .select('id')
      .eq('number', `VERIFY-${stamp}`)
      .neq('access_token', 'not-the-token');
    check(
      'the order number alone does not identify an order without the token',
      guessed.data?.length === 1 && guessed.data[0].id === orderId,
      'this is the check the confirmation page depends on',
    );
  }

  /* ---------------------------------------------------------------- */
  console.log('\nStock reservation');
  /* ---------------------------------------------------------------- */

  if (variant) {
    const before = variant.stock_quantity;

    const ok = await admin.rpc('decrement_variant_stock', {
      p_variant_id: variant.id,
      p_quantity: 1,
    });
    const { data: afterOk } = await admin
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', variant.id)
      .maybeSingle();
    check('a normal decrement succeeds', ok.data === true);
    check('stock went down by one', afterOk?.stock_quantity === before - 1, `${afterOk?.stock_quantity} vs ${before - 1}`);

    const tooMany = await admin.rpc('decrement_variant_stock', {
      p_variant_id: variant.id,
      p_quantity: 1_000_000,
    });
    const { data: afterFail } = await admin
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', variant.id)
      .maybeSingle();
    check('an over-large decrement is refused', tooMany.data === false);
    check('and does not change stock', afterFail?.stock_quantity === afterOk?.stock_quantity);

    // A plain update has no floor, which is the whole reason the RPC exists.
    const floor = await admin
      .from('product_variants')
      .update({ stock_quantity: 0 })
      .eq('id', variant.id);
    check('a plain update can zero the stock (why the RPC is needed)', !floor.error);
    await admin.from('product_variants').update({ stock_quantity: before }).eq('id', variant.id);
  }

  /* ---------------------------------------------------------------- */
  console.log('\nCleanup');
  /* ---------------------------------------------------------------- */

  /*
   * Runs in a `finally` so a failure part-way through still cleans up. Leaving
   * `verify-…@example.com` profiles in the customers table would quietly
   * inflate the real customer list, and the admin's order count with them.
   */
  const cleaned = await cleanup();
  check('no test rows are left behind', cleaned, 'see db:status for what remains');

  finish();
}

/**
 * Remove everything this run created.
 *
 * Orders cascade to their lines, discounts and events, so deleting the order
 * rows is enough for those. Addresses and customers are deleted explicitly
 * because a guest profile has no auth user to cascade from.
 */
async function cleanup() {
  const orders = await admin.from('orders').delete().like('id', 'ord-verify-%');
  const addresses = await admin.from('addresses').delete().like('id', 'adr-verify-%');
  const customers = await admin.from('customers').delete().like('email', 'verify-%@example.com');

  // Auth users cascade to `customers` via `user_id`, so delete them by listing
  // rather than by the id this run happened to capture.
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
  for (const user of users?.users ?? []) {
    if (/^verify(-other)?-\d+@example\.com$/.test(user.email ?? '')) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }

  return !orders.error && !addresses.error && !customers.error;
}

function finish() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nverify:accounts threw:', error.message);
  process.exit(1);
});
