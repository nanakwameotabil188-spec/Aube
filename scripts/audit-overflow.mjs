/**
 * Responsive overflow audit.
 *
 * Drives headless Edge over the DevTools Protocol and, at each viewport, asks
 * the page whether it scrolls horizontally and which elements stick out past
 * the right edge. Images cannot be inspected here, so this is how layout
 * regressions get caught.
 *
 * Usage: node scripts/audit-overflow.mjs [baseUrl]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4310';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const ROUTES = [
  '/',
  '/shop',
  '/products/azelaic-10-ha-serum',
  '/cart',
  '/checkout',
  '/search?q=serum',
  '/wishlist',
  '/journal',
  '/faq',
  '/contact',
  '/admin',
  '/admin/products',
  '/admin/products/new',
  '/admin/homepage',
  '/admin/onboarding',
  '/admin/reviews',
  '/admin/media',
  '/admin/orders',
  '/admin/customers',
  '/admin/settings',
];

/* Reports the widest offenders so a failure names the element, not just a page. */
const PROBE = `(() => {
  const doc = document.documentElement;
  const limit = doc.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > limit + 1 || r.left < -1) {
      const style = getComputedStyle(el);
      if (style.position === 'fixed' && style.visibility === 'hidden') continue;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 90),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
  }
  return JSON.stringify({
    scrollWidth: doc.scrollWidth,
    clientWidth: limit,
    scrolls: doc.scrollWidth > limit + 1,
    offenders: offenders.slice(0, 5),
  });
})()`;

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

const profile = mkdtempSync(join(tmpdir(), 'aube-audit-'));
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let failures = 0;
let cdp;

try {
  cdp = await connect(await getTarget());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const vp of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.name === 'mobile',
    });

    console.log(`\n=== ${vp.name} (${vp.width}px) ===`);

    for (const route of ROUTES) {
      await cdp.send('Page.navigate', { url: BASE + route });
      // Let the page settle: streamed RSC plus client hydration and layout.
      await sleep(2200);

      const result = await cdp.send('Runtime.evaluate', {
        expression: PROBE,
        returnByValue: true,
      });

      const data = JSON.parse(result.result.value);
      if (data.scrolls) {
        failures += 1;
        console.log(
          `  OVERFLOW ${route}  scrollWidth=${data.scrollWidth} clientWidth=${data.clientWidth}`,
        );
        for (const o of data.offenders) {
          console.log(`      <${o.tag} class="${o.cls}"> left=${o.left} right=${o.right}`);
        }
      } else {
        console.log(`  ok       ${route}`);
      }
    }
  }
} finally {
  cdp?.close();
  edge.kill();
  // Wait for Edge to release the profile before removing it; Windows still
  // holds locks on the directory for a moment after the process exits.
  await Promise.race([
    new Promise((resolve) => edge.once('exit', resolve)),
    sleep(4000),
  ]);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  } catch {
    // A leftover temp profile is harmless and outside the repo.
  }
}

console.log(`\noverflowing pages: ${failures}`);
process.exit(failures > 0 ? 1 : 0);
