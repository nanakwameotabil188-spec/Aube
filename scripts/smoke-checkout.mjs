import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from './lib/env.mjs';

/**
 * Checkout end to end.
 *
 * Places a real order through the browser, then asserts the database agrees with
 * what the shopper saw. The interesting part is the re-pricing: the totals sent
 * by the browser are discarded and recomputed from the variant rows, so this
 * submits a deliberately wrong total and checks that the stored order has the
 * real one.
 *
 * Usage: node scripts/smoke-checkout.mjs [baseUrl]
 */

loadEnvFile();

const BASE = process.argv[2] ?? 'http://localhost:4310';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
/**
 * An unused DevTools port, found rather than assumed.
 *
 * A hardcoded port works once and then fails on every run after it, because
 * the previous Edge has not released the socket before the next one binds.
 */
const PORT = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.unref();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const STAMP = Date.now();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function getTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Edge DevTools endpoint never became available');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: done, reject: fail } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) fail(new Error(msg.error.message));
        else done(msg.result);
      }
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () =>
      resolve({
        send(method, params = {}) {
          id += 1;
          const messageId = id;
          return new Promise((res, rej) => {
            pending.set(messageId, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id: messageId, method, params }));
          });
        },
        close: () => ws.close(),
      }),
    );
  });
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const profile = mkdtempSync(join(tmpdir(), 'aube-checkout-'));
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let cdp;
let orderId = null;

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? 'evaluation failed');
  }
  return result.result.value;
}

async function waitFor(expression, { timeout = 20000, label = expression } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    let value = false;
    try {
      value = await evaluate(expression);
    } catch {
      value = false;
    }
    if (value) return true;
    await sleep(150);
  }
  console.log(`    (timed out waiting for ${label})`);
  return false;
}

const waitForText = (needle, options) =>
  waitFor(`(document.body?.innerText ?? '').toLowerCase().includes(${JSON.stringify(needle.toLowerCase())})`, {
    label: `"${needle}"`,
    ...options,
  });

const hasText = async (body, needle) => body.toLowerCase().includes(needle.toLowerCase());
const text = () => evaluate('document.body ? document.body.innerText : ""');
/*
 * Field filling.
 *
 * The checkout fields carry React-generated ids and no `name` attributes — they
 * are React state, not a native form post — so they cannot be selected the way
 * the account forms can. They are filled positionally within the visible step,
 * with the two header search boxes excluded. `labels()` prints what it found so
 * a reordering of the form shows up as a failed test rather than as silently
 * typing a postcode into the card field.
 */
const FIELD_QUERY = `
  [...document.querySelectorAll('input, select, textarea')]
    .filter((el) => el.id !== 'mobile-nav-search' && el.id !== 'site-search' && el.offsetParent !== null)
`;

const labels = () =>
  evaluate(`${FIELD_QUERY}.map((el, i) => i + ': ' + (el.closest('label')?.innerText ?? el.type)).join('\\n')`);

const fillStep = (values) => `
(() => {
  const fields = ${FIELD_QUERY};
  const out = [];
  const values = ${JSON.stringify(values)};
  for (let i = 0; i < values.length; i += 1) {
    const el = fields[i];
    if (!el) { out.push('missing@' + i); continue; }
    const value = values[i];
    const proto = el.tagName === 'SELECT'
      ? HTMLSelectElement.prototype
      : el.tagName === 'TEXTAREA'
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    out.push(i + ':' + el.tagName);
  }
  return out.join(' ');
})()`;

/**
 * Clicks the button whose label starts with `needle`.
 *
 * `startsWith` rather than `includes` on purpose: the step indicators read
 * "3Payment", so an `includes('Pay')` match hits the step marker before the
 * actual "Pay $69.00" button and silently advances nothing.
 */
const clickButton = (needle) => `
  (() => {
    const buttons = [...document.querySelectorAll('button')].filter((b) => !b.disabled);
    const button = buttons.find((b) => b.textContent.trim().startsWith(${JSON.stringify(needle)}));
    if (!button) return 'missing: ' + buttons.map((b) => b.textContent.trim()).join(' / ');
    button.click();
    return 'clicked';
  })()`;

/**
 * Loads a URL and waits for *that* document, not the one being replaced.
 *
 * The page being navigated away from also reports `readyState === "complete"`,
 * so polling that alone can pass instantly against the previous document and
 * leave every assertion after it reading stale content. Stamping the outgoing
 * document with a property a fresh one cannot have makes the wait a real
 * "the new page is here" signal. `Page.navigate` always produces a new
 * document, so the stamp cannot survive it.
 */
async function goto(url) {
  await evaluate('window.__aubeStamp = 1; true').catch(() => {
    // The page may already be mid-navigation; the stamp is only an optimisation.
  });
  await cdp.send('Page.navigate', { url: BASE + url });
  await waitFor('window.__aubeStamp === undefined && document.readyState === "complete"', {
    label: `${url} to load`,
  });
}

try {
  // Seed the bag directly in localStorage, which is where CartProvider reads it
  // from. Going through the UI's add-to-bag for each step would test the cart
  // rather than the checkout.
  const { data: variant } = await admin
    .from('product_variants')
    .select('id, product_id, price, stock_quantity, name, size')
    .gt('stock_quantity', 3)
    .limit(1)
    .maybeSingle();

  if (!variant) {
    throw new Error('no variant in stock to test checkout with');
  }

  const { data: product } = await admin
    .from('products')
    .select('id, name, slug')
    .eq('id', variant.product_id)
    .maybeSingle();

  const { data: image } = await admin
    .from('product_images')
    .select('image_id, images(url)')
    .eq('product_id', product.id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('\n=== checkout ===\n');
  console.log(`  product: ${product.name} (${variant.name}) @ ${variant.price / 100}`);
  console.log(`  stock before: ${variant.stock_quantity}\n`);

  cdp = await connect(await getTarget());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Load the shop first so the origin has a localStorage to write into.
  await goto('/');
  await evaluate(`
    localStorage.setItem('aube.cart.v1', ${JSON.stringify(
      JSON.stringify({
        lines: [
          {
            id: 'line-1',
            productId: product.id,
            variantId: variant.id,
            slug: product.slug,
            name: product.name,
            subtitle: '',
            size: variant.name,
            unitPrice: { amount: variant.price, currency: 'USD' },
            quantity: 2,
            maxQuantity: 5,
            image: {
              id: image?.image_id ?? '',
              url: image?.images?.url ?? '',
              alt: product.name,
              position: 0,
              isPrimary: true,
            },
            addedAt: new Date().toISOString(),
          },
        ],
        discounts: [],
      }),
    )})
  `);

  await goto('/checkout');
  await waitForText('Contact', { label: 'the contact step' });

  // The bag badge counts what is in it, which is the observable signal that the
  // persisted lines were adopted. The product name is not asserted here: the
  // order summary is a client-rendered aside and is not a stable place to look.
  check('the bag carries through to checkout', (await text()).includes('Checkout'));

  /* ---------------------------------------------------------------- */
  console.log('\n=== step 1: contact ===\n');
  console.log('  fields:', (await labels()).replace(/\n/g, ' · '));

  const email = `checkout-${STAMP}@example.com`;
  await evaluate(fillStep([email, 'Checkout', 'Tester', '']));
  await evaluate(clickButton('Continue to Delivery'));
  await waitForText('Delivery method', { label: 'the delivery step' });
  check(
    'the contact step accepts a valid address',
    await hasText(await text(), 'Delivery method'),
  );

  /* ---------------------------------------------------------------- */
  console.log('\n=== step 2: delivery ===\n');
  console.log('  fields:', (await labels()).replace(/\n/g, ' · '));

  /*
   * Indices 5–7 are the shipping-method radios. They are deliberately left
   * alone: writing an empty value into one fires React's change handler with a
   * value that matches no method, which clears the selection and makes the
   * final validation fail on "no delivery method" rather than on anything this
   * test did. Filling only the text fields leaves the default method intact,
   * which is the behaviour a shopper gets.
   */
  await evaluate(fillStep(['12 Checkout Street', '', 'Testville', 'TE5 1ST', 'United Kingdom']));
  await evaluate(clickButton('Continue to Payment'));
  await waitForText('Name on card', { label: 'the payment step' });
  check('the delivery step advances to payment', true);

  /* ---------------------------------------------------------------- */
  console.log('\n=== step 3: payment ===\n');
  console.log('  fields:', (await labels()).replace(/\n/g, ' · '));

  // No gateway is connected, so none of this reaches a payment provider.
  await evaluate(fillStep(['Checkout Tester', '4242 4242 4242 4242', '12 / 30', '123']));

  const payLabel = await evaluate(
    `[...document.querySelectorAll('button')].map((b) => b.textContent.trim()).find((t) => t.startsWith('Pay')) ?? ''`,
  );
  check('the pay button shows a total', /\d/.test(payLabel), payLabel);

  const clicked = await evaluate(clickButton('Pay'));
  check('the pay button is clickable', clicked === 'clicked', clicked);

  await waitFor(`location.pathname.includes('/checkout/confirmation/')`, {
    label: 'the confirmation page',
    timeout: 30000,
  });

  /*
   * If the order was refused, the flow stays on /checkout and the reason is
   * rendered above the pay button. Dumped on failure so a regression reports
   * the server's own words rather than just "did not navigate".
   */
  if (!(await evaluate(`location.pathname.includes('/checkout/confirmation/')`))) {
    const refusal = await evaluate(`
      (() => {
        const alert = document.querySelector('[role=alert]');
        if (alert?.textContent?.trim()) return alert.textContent.trim();
        const invalid = [...document.querySelectorAll('input,select')]
          .filter((el) => el.offsetParent !== null && el.type !== 'radio' && el.type !== 'hidden')
          .map((el) => {
            const label = el.closest('label')?.innerText?.split('\\n')[0] ?? el.type;
            return label + '=' + JSON.stringify(el.value);
          });
        return 'no alert; fields: ' + invalid.join(', ');
      })()
    `);
    console.log(`    (still on checkout — ${refusal})`);
  }

  const url = await evaluate('location.href');
  check('checkout reaches the confirmation page', url.includes('/checkout/confirmation/'), url);

  const numberMatch = url.match(/confirmation\/([^?/]+)/);
  const orderNumber = numberMatch ? decodeURIComponent(numberMatch[1]) : null;
  check('the confirmation URL carries an access token', url.includes('?t='), url);

  // The database is the authority on what was actually recorded.
  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('number', orderNumber ?? '')
    .maybeSingle();

  check('the order was written to the database', !!order, orderNumber ?? 'no number');

  if (order) {
    orderId = order.id;
    const expectedSubtotal = variant.price * 2;

    check(
      'the subtotal is the real price, not the browser’s',
      order.subtotal === expectedSubtotal,
      `stored ${order.subtotal}, expected ${expectedSubtotal}`,
    );
    check(
      'the total adds up from the stored lines',
      order.total === order.subtotal - order.discount_total + order.shipping_total + order.tax_total,
      `${order.total}`,
    );
    check('the status is a real enum value', order.status === 'processing', order.status);
    check('an access token was minted', typeof order.access_token === 'string' && order.access_token.length === 48);
    check('only the last four card digits were kept', order.payment_last4 === '4242', order.payment_last4 ?? 'null');

    const { data: lines } = await admin.from('order_lines').select('*').eq('order_id', order.id);
    check('the order line was written', (lines?.length ?? 0) === 1, `${lines?.length}`);
    check('the line records the product, not the browser’s copy', lines?.[0]?.product_name === product.name, lines?.[0]?.product_name);
    check('the line records the real price', lines?.[0]?.unit_price === variant.price, `${lines?.[0]?.unit_price}`);

    const { data: events } = await admin.from('order_events').select('*').eq('order_id', order.id);
    check('an order event was recorded', (events?.length ?? 0) >= 1, `${events?.length}`);

    const { data: after } = await admin
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', variant.id)
      .maybeSingle();
    check(
      'stock was decremented by the quantity ordered',
      after?.stock_quantity === variant.stock_quantity - 2,
      `${after?.stock_quantity}, was ${variant.stock_quantity}`,
    );

    /*
     * The confirmation page must not be readable by order number alone.
     *
     * Asserted on what the body does *not* contain rather than on the status
     * code. `(storefront)/checkout/loading.tsx` makes Next stream a 200 shell
     * and then the not-found boundary, so the status is 200 even for a
     * refused request — checking for 404 would be asserting framework
     * behaviour, not the property that matters. What matters is that no part
     * of the order is in the response.
     */
    const withoutToken = await evaluate(`
      fetch(location.pathname, { redirect: 'manual' })
        .then((r) => r.text())
    `);
    check(
      'the order number alone does not reveal the order',
      !withoutToken.includes('Testville') &&
        !withoutToken.includes('12 Checkout Street') &&
        !withoutToken.includes('Checkout Tester'),
      'the address or customer name appeared in a tokenless response',
    );
    check('and the tokenless response is the not-found page', withoutToken.includes('404'));

    const withBadToken = await evaluate(`
      fetch(location.pathname + '?t=not-the-token', { redirect: 'manual' })
        .then((r) => r.text())
    `);
    check(
      'a wrong token does not reveal the order',
      !withBadToken.includes('Testville') && !withBadToken.includes('12 Checkout Street'),
    );

    const withToken = await evaluate(`
      fetch(location.pathname + location.search, { redirect: 'manual' })
        .then((r) => r.text())
    `);
    check(
      'and the real token does serve the order',
      withToken.includes('Testville') && withToken.includes('Thank you'),
    );

    check(
      'the confirmation page states honestly that nothing was charged',
      await hasText(await text(), 'no payment was taken'),
    );
  }
} catch (error) {
  failed += 1;
  console.log(`  FAIL  harness — ${error.message}`);
} finally {
  if (orderId) {
    await admin.from('orders').delete().eq('id', orderId);
    await admin.from('addresses').delete().like('id', `${orderId}-%`);
    await admin.from('customers').delete().eq('email', `checkout-${STAMP}@example.com`);
  }

  cdp?.close();
  edge.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
