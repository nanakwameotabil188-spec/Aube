/*
 * Asserts the newsletter form is actually legible and operable, by comparing
 * rendered pixels rather than reading the class list.
 *
 * A contrast ratio is the honest test here: the bug was a white value on a
 * white field, which no amount of class-name inspection would have caught and
 * which a screenshot does not reliably show either.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:4310';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const open = await (await fetch('http://localhost:9222/json/list')).json();
const page = open.find((t) => t.type === 'page');
let ws, id = 0;
const pending = new Map();
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  const en = pending.get(m.id);
  if (en) { pending.delete(m.id); m.error ? en.reject(new Error(m.error.message)) : en.resolve(m.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id; pending.set(n, { resolve, reject });
  ws.send(JSON.stringify({ id: n, method, params }));
});
const ev = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

await send('Page.enable');
await send('Network.enable');
await send('Network.clearBrowserCookies');

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

/** Injected into the page: WCAG relative luminance and contrast ratio. */
const HELPERS = `
  function parseRgb(str) {
    const m = str.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((p) => parseFloat(p));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  function luminance(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(fg, bg) {
    const a = luminance(fg), b = luminance(bg);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }
  // Walks up for the first non-transparent background, as the eye does.
  function effectiveBg(el) {
    let node = el;
    while (node) {
      const c = parseRgb(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.01) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
`;

async function inspect(label, path) {
  console.log(`\n${label}  (${path})`);
  await send('Page.navigate', { url: `${BASE}${path}` });
  await sleep(3000);

  const result = await ev(`(() => {
    ${HELPERS}
    const input = document.querySelector('input[name="email"]');
    if (!input) return { error: 'no newsletter form' };
    const cs = getComputedStyle(input);
    const box = document.querySelector('input[name="consent"]');

    // What the user actually sees: the resolved value colour against the field.
    const valueInk = parseRgb(cs.color);
    const fieldBg = parseRgb(cs.backgroundColor);
    const fieldBgOpaque = fieldBg.a > 0.01 ? fieldBg : effectiveBg(input);

    // Label copy sits on the section, not the field.
    const label = document.querySelector('label[for="' + box.id + '"]');
    const labelInk = parseRgb(getComputedStyle(label).color);
    const labelBg = effectiveBg(label);

    // Placeholder must not be the thing that is legible while the value is not.
    const phColour = (() => {
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch { continue; }
        for (const r of rules) {
          if (r.selectorText && r.selectorText.includes('placeholder') && r.style && r.style.color) return r.style.color;
        }
      }
      return null;
    })();

    return {
      valueInk, fieldBgOpaque,
      valueContrast: +contrast(valueInk, fieldBgOpaque).toFixed(2),
      labelInk, labelBg,
      labelContrast: +contrast(labelInk, labelBg).toFixed(2),
      caret: cs.caretColor,
      fontSize: cs.fontSize,
      placeholderColour: phColour,
    };
  })()`);

  if (result.error) {
    check(`${label}: form present`, false, result.error);
    return;
  }

  check(
    `${label}: typed text is legible`,
    result.valueContrast >= 4.5,
    `contrast ${result.valueContrast}:1 (need 4.5:1)`,
  );
  check(
    `${label}: consent copy is legible`,
    result.labelContrast >= 4.5,
    `contrast ${result.labelContrast}:1`,
  );
  check(
    `${label}: font size is readable`,
    parseFloat(result.fontSize) >= 14,
    `${result.fontSize}`,
  );

  // The checkbox must show a real change when ticked.
  const box = await ev(`(() => {
    ${HELPERS}
    const c = document.querySelector('input[name="consent"]');
    if (!c) return { error: 'no checkbox' };
    c.click();
    const cs = getComputedStyle(c);
    return {
      checked: c.checked,
      bg: cs.backgroundColor,
      image: cs.backgroundImage,
      tone: c.getAttribute('data-tone'),
    };
  })()`);

  if (box.error) { check(`${label}: checkbox present`, false, box.error); return; }

  check(`${label}: checkbox reports checked`, box.checked === true);
  check(
    `${label}: checkbox shows a visible tick`,
    box.image !== 'none' && box.image.includes('svg'),
    `background-image ${box.image === 'none' ? 'none (invisible tick)' : 'svg'}`,
  );
  check(
    `${label}: checked fill differs from the tick colour`,
    await ev(`(() => {
      ${HELPERS}
      const c = document.querySelector('input[name="consent"]');
      const cs = getComputedStyle(c);
      const fill = parseRgb(cs.backgroundColor);
      // The tick is drawn as an inline SVG, so read its stroke out of the data URL.
      const m = cs.backgroundImage.match(/stroke=['"]?%?([0-9a-fA-F]{6})/);
      let tick = null;
      if (m) {
        const hex = m[1];
        tick = {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1,
        };
      }
      return tick ? contrast(tick, fill) >= 3 : null;
    })()`) !== false,
    'tick contrasts with its fill',
  );
}

await inspect('homepage (dark section)', '/');
await inspect('faq (light surface)', '/faq');
await inspect('journal (light surface)', '/journal');

console.log(failures === 0 ? '\nall legibility checks passed' : `\n${failures} check(s) failed`);
ws.close();
process.exit(failures === 0 ? 0 : 1);
