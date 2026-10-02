/*
 * End-to-end test for the newsletter signup and the reserved admin address.
 *
 * Drives the real form rather than calling the server action directly, because
 * the two behaviours under test are exactly the ones a direct call would skip:
 * the browser's own validation and the client-side routing to /admin/login.
 *
 * Every assertion is checked against the database, not against the UI's own
 * success message. A form that renders "you are on the list" without storing
 * anything would pass a UI-only test — which is precisely the bug this
 * newsletter originally had.
 *
 * Requires a headless Edge listening on 9222 and a server on BASE_URL.
 */

import pg from 'pg';
import { loadEnvFile } from './lib/env.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4310';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
/** The address that routes to admin login instead of subscribing. */
const RESERVED = 'shopaurai@gmail.com';

loadEnvFile();

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  #ws;
  #id = 0;
  #pending = new Map();

  static async connect() {
    const open = await (await fetch('http://localhost:9222/json/list')).json();
    let page = open.find((target) => target.type === 'page');
    if (!page) {
      const created = await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' });
      page = await created.json();
    }
    const cdp = new Cdp();
    cdp.#ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      cdp.#ws.addEventListener('open', resolve);
      cdp.#ws.addEventListener('error', reject);
    });
    cdp.#ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      const entry = cdp.#pending.get(msg.id);
      if (entry) {
        cdp.#pending.delete(msg.id);
        msg.error ? entry.reject(new Error(msg.error.message)) : entry.resolve(msg.result);
      }
    });
    return cdp;
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(2500);
  }

  async eval(expression) {
    const { result } = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.value;
  }

  close() {
    this.#ws.close();
  }
}

const visibleText = (html) =>
  html.replace(/<script[\S\s]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Sets React-controlled inputs.
 *
 * The native setter plus both events is required: assigning `.value` directly
 * leaves React's state stale, and `requestSubmit()` would then fail `required`
 * validation and never fire the request.
 */
const fill = (cdp, values) =>
  cdp.eval(`(() => {
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const entries = ${JSON.stringify(values)};
    for (const [selector, value] of Object.entries(entries)) {
      const el = document.querySelector(selector);
      if (!el) throw new Error('missing ' + selector);
      nativeSet.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  })()`);

const checkBox = (cdp, selector) =>
  cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'missing';
    el.click();
    return String(el.checked);
  })()`);

/**
 * Submits the newsletter form specifically.
 *
 * The page carries several forms — the header search among them — so
 * `querySelector('form')` submits the search box instead of the signup and the
 * test silently passes on assertions about storage. Scoping to the form that
 * actually owns the email input is what makes this test mean anything.
 */
const submit = (cdp) =>
  cdp.eval(`(() => {
    const input = document.querySelector('input[name="email"]');
    if (!input) return 'no newsletter form on the page';
    const form = input.closest('form');
    if (!form) return 'email input is not inside a form';
    form.requestSubmit();
    return 'submitted';
  })()`);

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

/** Ground truth: what is actually in the table right now. */
const db = new pg.Client({ connectionString: process.env.DIRECT_URL });
await db.connect();
const storedEmails = async () => {
  const { rows } = await db.query('select email from newsletter_subscribers order by created_at');
  return rows.map((r) => r.email);
};
const countOf = async (email) => {
  const { rows } = await db.query('select count(*)::int as n from newsletter_subscribers where email = lower($1)', [email]);
  return rows[0].n;
};

const stamp = Date.now();
const NORMAL_A = `subscriber.a.${stamp}@example.com`;
const NORMAL_B = `subscriber.b.${stamp}@example.com`;

/** Clears the table so the assertions below are about this run only. */
await db.query('delete from newsletter_subscribers');

const cdp = await Cdp.connect();
await cdp.send('Page.enable');
await cdp.send('Network.enable');

/**
 * Start from a signed-out browser.
 *
 * The headless profile persists cookies between runs, so a leftover admin
 * session makes every "while signed out" assertion fail and quietly turns the
 * reserved-address check into a redirect to an already-authenticated panel —
 * a pass for the wrong reason. Clearing is the only way this test means the
 * same thing twice.
 */
await cdp.send('Network.clearBrowserCookies');
await cdp.send('Network.clearBrowserCache');
await cdp.eval('1');

/* ------------------------------------------------------------------ */
console.log('\nhomepage has exactly one signup form');

await cdp.goto(`${BASE}/`);
const formCount = await cdp.eval(`document.querySelectorAll('input[name="email"]').length`);
check('one email input on the homepage', formCount === 1, `found ${formCount}`);

const submitCount = await cdp.eval(
  `[...document.querySelectorAll('button[type="submit"]')].filter(b => b.textContent.trim() === 'Subscribe').length`,
);
check('one Subscribe button on the homepage', submitCount === 1, `found ${submitCount}`);

const footerHasForm = await cdp.eval(`(() => {
  const f = document.querySelector('footer');
  return f ? f.querySelectorAll('input[name="email"]').length : -1;
})()`);
check('the footer carries no signup form', footerHasForm === 0, `${footerHasForm} in footer`);

/* ------------------------------------------------------------------ */
console.log('\nnormal subscriber');

await fill(cdp, { 'input[name="email"]': NORMAL_A });
await checkBox(cdp, 'input[name="consent"]');
await submit(cdp);
await sleep(4000);

let body = visibleText(await cdp.eval('document.body.innerText'));
check('shows the success message', /on the list/i.test(body));
check('stays on the homepage', (await cdp.eval('location.pathname')) === '/');

const afterA = await countOf(NORMAL_A);
check('the address is stored in Supabase', afterA === 1, `${afterA} row(s)`);

/* ------------------------------------------------------------------ */
console.log('\nsubscribing twice is idempotent');

await cdp.goto(`${BASE}/`);
await fill(cdp, { 'input[name="email"]': NORMAL_A });
await checkBox(cdp, 'input[name="consent"]');
await submit(cdp);
await sleep(4000);
const afterResub = await countOf(NORMAL_A);
check('no duplicate row is created', afterResub === 1, `${afterResub} row(s)`);

/* ------------------------------------------------------------------ */
console.log('\nemail casing is normalised');

await cdp.goto(`${BASE}/`);
await fill(cdp, { 'input[name="email"]': NORMAL_B.toUpperCase() });
await checkBox(cdp, 'input[name="consent"]');
await submit(cdp);
await sleep(4000);
const upperStored = await countOf(NORMAL_B);
check('an uppercased address stores as one lowercase row', upperStored === 1, `${upperStored} row(s)`);

/* ------------------------------------------------------------------ */
console.log('\nthe reserved admin address');

await cdp.goto(`${BASE}/`);
await fill(cdp, { 'input[name="email"]': RESERVED });
await checkBox(cdp, 'input[name="consent"]');
await submit(cdp);
await sleep(5000);

const reservedPath = await cdp.eval('location.pathname');
check('redirects to the admin login', reservedPath === '/admin/login', `pathname ${reservedPath}`);

body = visibleText(await cdp.eval('document.body.innerText'));
check('the login form is shown', /password/i.test(body));
check('no newsletter success message is shown', !/on the list/i.test(body));

const reservedStored = await countOf(RESERVED);
check('the address is NOT stored as a subscriber', reservedStored === 0, `${reservedStored} row(s)`);

const allStored = await storedEmails();
check(
  'the subscriber list holds only the normal signups',
  allStored.every((e) => e !== RESERVED),
  `${allStored.length} row(s), none reserved`,
);

/* ------------------------------------------------------------------ */
console.log('\ncasing of the reserved address does not matter');

await cdp.goto(`${BASE}/`);
await fill(cdp, { 'input[name="email"]': RESERVED.toUpperCase() });
await checkBox(cdp, 'input[name="consent"]');
await submit(cdp);
await sleep(5000);
check(
  'an uppercased reserved address also routes to login',
  (await cdp.eval('location.pathname')) === '/admin/login',
  `pathname ${await cdp.eval('location.pathname')}`,
);
check('and is still not stored', (await countOf(RESERVED)) === 0);

/* ------------------------------------------------------------------ */
console.log('\nnear-miss addresses are ordinary subscribers');

await cdp.goto(`${BASE}/`);
const nearMiss = `shopaurai.other.${stamp}@example.com`;
await fill(cdp, { 'input[name="email"]': nearMiss });
await checkBox(cdp, 'input[name="consent"]');
await submit(cdp);
await sleep(4000);
check('a different address is stored normally', (await countOf(nearMiss)) === 1);
check(
  'and shows the normal success message',
  /on the list/i.test(visibleText(await cdp.eval('document.body.innerText'))),
);

/* ------------------------------------------------------------------ */
console.log('\nthe admin dashboard is still protected');

for (const path of ['/admin', '/admin/products', '/admin/subscribers', '/admin/settings']) {
  await cdp.goto(`${BASE}${path}`);
  const text = visibleText(await cdp.eval('document.body.innerText'));
  const gated = /sign in/i.test(text) && !/newsletter subscribers/i.test(text);
  check(`${path} is gated while signed out`, gated);
}

/* ------------------------------------------------------------------ */
console.log('\nthe subscriber list is visible to a signed-in admin');

await cdp.goto(`${BASE}/admin/login`);
await fill(cdp, { '#email': ADMIN_EMAIL, '#password': ADMIN_PASSWORD });
await cdp.eval(`document.querySelector('form').requestSubmit()`);
await sleep(15000);
check('sign-in reaches the panel', (await cdp.eval('location.pathname')) === '/admin', await cdp.eval('location.pathname'));

await cdp.goto(`${BASE}/admin/subscribers`);
body = visibleText(await cdp.eval('document.body.innerText'));
check('the subscribers page renders', /newsletter subscribers/i.test(body));
check('it lists the normal subscriber', body.includes(NORMAL_A));
check('it lists the second normal subscriber', body.includes(NORMAL_B));
check('it does not list the reserved address', !body.includes(RESERVED));

/* ------------------------------------------------------------------ */
await db.query('delete from newsletter_subscribers');
await db.end();

console.log(failures === 0 ? '\nall newsletter checks passed' : `\n${failures} check(s) failed`);

// The CDP socket is a live handle, so the process would hang after the last
// line without an explicit exit. Closing it is tidier than forcing.
cdp.close();
process.exit(failures === 0 ? 0 : 1);
