/**
 * Functional smoke test for the interactive paths that changed when service
 * calls moved behind server actions: search suggestions, add to bag, and the
 * wishlist toggle.
 *
 * Drives headless Edge over the DevTools Protocol against a running server.
 * Usage: node scripts/smoke-interactions.mjs [baseUrl]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4310';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9334;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const profile = mkdtempSync(join(tmpdir(), 'aube-smoke-'));
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

async function goto(url) {
  await cdp.send('Page.navigate', { url: BASE + url });
  await sleep(2500);
}

try {
  cdp = await connect(await getTarget());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  /* ---------------------------------------------------------------- */
  console.log('\n=== search overlay (server action) ===');
  await goto('/');

  const opened = await evaluate(`(() => {
    const btn = document.querySelector('button[aria-label*="earch" i], button[aria-label*="open search" i]');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  check('search overlay opens', opened);

  await sleep(600);
  const hasInput = await evaluate(`!!document.querySelector('input[type="search"], input[placeholder*="earch" i]')`);
  check('search input present', hasInput);

  if (hasInput) {
    await evaluate(`(() => {
      const input = document.querySelector('input[type="search"], input[placeholder*="earch" i]');
      input.focus();
      return true;
    })()`);
    // Real key events, so React's controlled input updates the way a user's would.
    await cdp.send('Input.insertText', { text: 'serum' });
    await sleep(2500);

    const suggestions = await evaluate(`(() => {
      const links = [...document.querySelectorAll('a[href^="/products/"]')];
      const visible = links.filter((a) => a.offsetParent !== null);
      return { count: visible.length, first: visible[0]?.getAttribute('href') ?? null };
    })()`);
    check(
      'search returns product suggestions',
      suggestions.count > 0,
      `${suggestions.count} result(s)${suggestions.first ? `, first ${suggestions.first}` : ''}`,
    );
  }

  /* ---------------------------------------------------------------- */
  console.log('\n=== add to bag (server action at checkout) ===');
  await goto('/products/azelaic-10-ha-serum');

  const added = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /add to bag/i.test(b.textContent || ''));
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  check('add to bag button found', added);
  await sleep(1800);

  const cartCount = await evaluate(`(() => {
    const raw = localStorage.getItem('aube.cart.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { lines: (parsed.lines || []).length, keys: Object.keys(parsed) };
  })()`);
  check(
    'cart persisted after add',
    cartCount !== null && cartCount.lines > 0,
    cartCount ? `lines=${cartCount.lines}` : 'no aube.cart.v1 in localStorage',
  );

  /* ---------------------------------------------------------------- */
  console.log('\n=== cart page reflects the line ===');
  await goto('/cart');
  const cartText = await evaluate(`document.body.innerText`);
  check('cart page shows an item', /azelaic|serum/i.test(cartText), '');

  /* ---------------------------------------------------------------- */
  console.log('\n=== wishlist toggle ===');
  await goto('/products/softening-milk-cleanser');
  const wishlisted = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /wishlist|save|heart/i.test(b.getAttribute('aria-label') || ''));
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  check('wishlist button found', wishlisted);
  await sleep(1200);

  const wish = await evaluate(`(() => {
    const raw = localStorage.getItem('aube.wishlist.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed) ? parsed : parsed.ids;
    return Array.isArray(ids) ? ids.length : null;
  })()`);
  check('wishlist persisted', wish !== null && wish > 0, wish !== null ? `${wish} item(s)` : 'no aube.wishlist.v1');
} catch (error) {
  check('audit ran without throwing', false, String(error.message ?? error));
} finally {
  cdp?.close();
  edge.kill();
  await Promise.race([new Promise((r) => edge.once('exit', r)), sleep(4000)]);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  } catch {
    /* leftover temp profile is harmless */
  }
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
