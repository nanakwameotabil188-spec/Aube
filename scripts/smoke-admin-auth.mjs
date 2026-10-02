/*
 * Uses the global `WebSocket` (Node 22+) rather than the `ws` package, which
 * the other audit script also relies on — one less dependency for the same
 * job. Requires a headless Edge listening on 9222.
 *
 * Signs into the panel through the real form rather than posting to the Server
 * Action directly: the cookie is written by that action's own response, and a
 * test bypassing the browser never exercises it. A wrong cookie name, a
 * session that does not survive the redirect, and a gate that still blocks
 * after a successful sign-in are all invisible otherwise.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:4310';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  #ws;
  #id = 0;
  #pending = new Map();

  static async connect() {
    // Reuse a page if one is open, otherwise create one. A previous run closes
    // its target on the way out, so "no page" is the normal state on a rerun.
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
}

const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/**
 * Sets a React-controlled input.
 *
 * Assigning `.value` directly is invisible to React, so the native setter is
 * called instead and both `input` and `change` are dispatched — React listens
 * to both, and missing one leaves the component's state stale. That staleness
 * matters here: `requestSubmit()` runs constraint validation, so an input
 * React believes is empty fails `required` and the browser blocks the submit
 * with no request at all, which reads exactly like a broken form.
 */
const fill = (cdp, values) =>
  cdp.eval(`(() => {
    const nativeSet = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    ).set;
    const entries = ${JSON.stringify(values)};
    for (const [selector, value] of Object.entries(entries)) {
      const el = document.querySelector(selector);
      if (!el) throw new Error('missing ' + selector);
      nativeSet.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return Object.fromEntries(
      Object.keys(entries).map((s) => [s, document.querySelector(s).value]),
    );
  })()`);

const submit = (cdp) =>
  cdp.eval(`(() => {
    const form = document.querySelector('form');
    if (!form.reportValidity()) return 'invalid';
    form.requestSubmit();
    return 'submitted';
  })()`);

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const cdp = await Cdp.connect();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Network.enable');

// The headless profile keeps its cookies between runs, so any earlier test that
// signed in would leave this one authenticated and turn the anonymous-visitor
// checks into passes for the wrong reason. Clearing makes the order irrelevant.
await cdp.send('Network.clearBrowserCookies');
await cdp.send('Network.clearBrowserCache');

try {
  console.log('\nsign-in gate');

  await cdp.goto(`${BASE}/admin`);
  let body = text(await cdp.eval('document.body.innerText'));
  check('/admin blocks an anonymous visitor', body.includes('Sign in required'));
  check('block offers a way in', body.includes('Sign in'), 'link to /admin/login');

  await cdp.goto(`${BASE}/admin/login`);
  body = text(await cdp.eval('document.body.innerText'));
  check('/admin/login renders the form', body.includes('Sign in'));
  check('form does not inherit panel nav', !body.includes('Customers'), 'no panel chrome');

  // A wrong password must be refused without saying which half was wrong.
  const filled = await fill(cdp, { '#email': EMAIL, '#password': 'definitely-not-the-password' });
  check('form fields accept input', filled['#email'] === EMAIL, JSON.stringify(filled));

  const submitResult = await submit(cdp);
  check('form passes validation and submits', submitResult === 'submitted', submitResult);
  await sleep(9000);
  body = text(await cdp.eval('document.body.innerText'));
  check('a wrong password is refused', body.includes('do not match'), body.slice(0, 200));
  check(
    'the refusal does not reveal whether the account exists',
    !body.toLowerCase().includes('no such') && !body.toLowerCase().includes('not found'),
  );

  console.log('\nsign-in with valid credentials');

  await cdp.goto(`${BASE}/admin/login`);
  await fill(cdp, { '#email': EMAIL, '#password': PASSWORD });
  await submit(cdp);
  /* Three sequential network round trips (password grant, getUser, the
   * admin_users lookup). Each auth call measured ~2.4s from this machine, so
   * the pending state is expected to last several seconds. */
  await sleep(15000);

  const url = await cdp.eval('location.pathname');
  check(
    'lands on the panel after signing in',
    url === '/admin',
    url === '/admin' ? '' : `pathname ${url}; page said: ${text(await cdp.eval('document.body.innerText')).slice(0, 200)}`,
  );

  body = text(await cdp.eval('document.body.innerText'));
  // The panel shows the account's `full_name` and falls back to the email, so
  // either proves the identity came from `admin_users` rather than the form.
  check(
    'panel renders the account that signed in',
    body.includes(EMAIL) || body.includes('AUBE Admin'),
    'identity from admin_users',
  );
  check('panel shows the role', body.includes('admin'));
  check('sign-out control is present', body.includes('Sign out'));

  console.log('\nprotected pages after signing in');
  for (const path of ['/admin/products', '/admin/media', '/admin/reviews', '/admin/settings', '/admin/homepage', '/admin/onboarding', '/admin/orders', '/admin/customers']) {
    await cdp.goto(`${BASE}${path}`);
    const pageBody = text(await cdp.eval('document.body.innerText'));
    // Assert real content, not merely the absence of a gate: a redirect to the
    // login page also lacks "Sign in required" and would pass a weaker test.
    const signedIn = pageBody.includes('Sign out');
    check(`${path} is reachable while signed in`, signedIn, signedIn ? '' : 'no panel chrome');
  }

  console.log('\nproduct editor');
  await cdp.goto(`${BASE}/admin/products`);
  const firstEdit = await cdp.eval(
    `(() => { const a = [...document.querySelectorAll('a')].find(x => /\\/admin\\/products\\//.test(x.href) && !x.href.includes('/new')); return a ? a.getAttribute('href') : null; })()`,
  );
  if (firstEdit) {
    await cdp.goto(BASE + firstEdit);
    const editor = await cdp.eval('document.body.innerHTML');
    check('editor opens without a gate', !text(editor).includes('Sign in required'));
    check('editor has the size/variant repeater', editor.includes('variant_size_0') || editor.includes('Add size'));
    check('editor has the media uploader', editor.includes('media-file') || editor.includes('type="file"'));
    check('editor has the facet pickers', editor.includes('skin_type_ids'));
  } else {
    check('found a product to edit', false, 'no edit link on /admin/products');
  }

  console.log('\nsign out');
  await cdp.goto(`${BASE}/admin`);
  const outForm = await cdp.eval(
    `(() => { const f = [...document.querySelectorAll('form')].find(x => x.innerText.includes('Sign out')); if (f) { f.requestSubmit(); return true; } return false; })()`,
  );
  check('sign-out control submits', Boolean(outForm));
  // The action clears the cookie and redirects, and the middleware re-runs on
  // the way back, so this is a multi-round trip rather than a single request.
  await sleep(6000);
  const afterOut = text(await cdp.eval('document.body.innerText'));
  const outPath = await cdp.eval('location.pathname');
  check(
    'sign-out returns to the login page',
    outPath === '/admin/login',
    `pathname ${outPath}`,
  );
  check('the login form is shown after signing out', afterOut.includes('Password'));

  await cdp.goto(`${BASE}/admin`);
  body = text(await cdp.eval('document.body.innerText'));
  check('the panel is locked again after signing out', body.includes('Sign in required'));
} finally {
  cdp.send('Page.close').catch(() => {});
}

console.log(failures === 0 ? '\nall admin auth checks passed' : `\n${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
