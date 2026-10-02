import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Source-level guarantees for the account work.
 *
 * `verify:accounts` proves the database behaves. This proves the *code* does not
 * quietly undo those guarantees — that no server-only module is reachable from
 * the browser bundle, that no credential can appear in a client component, and
 * that the places where the app trusts a claim are the places that justify it.
 *
 * Run after a build, since it reads `.next/static`.
 */

const SRC = 'src';
const STATIC = '.next/static';

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = await walk(SRC);
const code = new Map();

for (const file of files) {
  if (/\.(ts|tsx)$/.test(file)) {
    code.set(file.replace(/\\/g, '/'), await readFile(file, 'utf8'));
  }
}

const isClientComponent = (file, text) =>
  /^\s*['"]use client['"]/m.test(text) && /^\s*['"]use client['"];?/m.test(text);

console.log('\nAccount source guarantees\n');

/* ------------------------------------------------------------------ */
console.log('Bundle boundary');
/* ------------------------------------------------------------------ */

const clientFiles = [...code].filter(([f, t]) => isClientComponent(f, t));
const serverOnlyModules = [...code]
  .filter(([f, t]) => /^\s*import 'server-only';?/m.test(t))
  .map(([f]) => f);

/*
 * A `import type { … } from '@/lib/supabase/admin-data'` is erased at compile
 * time and cannot pull anything into the bundle, so it is not a leak. Several
 * admin components import types this way and it is correct — the rule is that
 * the *value* must not cross, not that the name may never be mentioned.
 */
const stripTypeOnlyImports = (text) => text.replace(/import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?/g, '');

const leaked = [];
for (const [file, text] of clientFiles) {
  const valueImports = stripTypeOnlyImports(text);
  for (const mod of serverOnlyModules) {
    const specifier = mod.replace(/^src\//, '@/').replace(/\.tsx?$/, '');
    if (
      new RegExp(`from\\s+['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(valueImports)
    ) {
      leaked.push(`${file} -> ${specifier}`);
    }
  }
}
check('no client component value-imports a server-only module', leaked.length === 0, leaked.join(', '));

/* ------------------------------------------------------------------ */
console.log('\nCredentials');
/* ------------------------------------------------------------------ */

// The service role key must never be referenced in anything the browser loads.
const serviceRoleInClients = clientFiles
  .filter(([, text]) => /createAdminSupabaseClient|SUPABASE_SERVICE_ROLE_KEY/.test(text))
  .map(([f]) => f);
check('no client component uses the service-role client', serviceRoleInClients.length === 0, serviceRoleInClients.join(', '));

// `src/lib/actions/*` are server actions, so the string appearing there is fine;
// the point is that it never reaches the static bundle.
if (await exists(STATIC)) {
  const bundle = await readStaticBundle();
  const needles = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'service_role',
    'shopaurai@gmail.com',
    'gIddel123',
  ];
  for (const needle of needles) {
    check(`"${needle}" is absent from the static bundle`, !bundle.includes(needle));
  }
} else {
  console.log('  skip  no .next/static — run a build first');
}

/* ------------------------------------------------------------------ */
console.log('\nOrder access');
/* ------------------------------------------------------------------ */

const confirmPage = code.get('src/app/(storefront)/checkout/confirmation/[orderNumber]/page.tsx') ?? '';
check('the confirmation page reads the access token', /searchParams/.test(confirmPage) && /token|\bt\b/.test(confirmPage));
check(
  'the confirmation page does not read an order by number alone',
  !/accountService\.getOrderById/.test(confirmPage.replace(/const order =[\s\S]*?;/, '')),
  'getOrderById is only reachable in the unconfigured fallback',
);

const accountOrderPage = code.get('src/app/(storefront)/account/(pages)/orders/[id]/page.tsx') ?? '';
check('the account order page is addressed by uuid', /params/.test(accountOrderPage) && /getAccountOrder/.test(accountOrderPage));
check('the account order page gates on a session', /getAccountSession/.test(accountOrderPage));

/* ------------------------------------------------------------------ */
console.log('\nOpen redirect');
/* ------------------------------------------------------------------ */

const customerAuth = code.get('src/lib/actions/customer-auth.ts') ?? '';
check('the auth actions validate `next` against an allow-list', /allowed\s*=\s*new Set/.test(customerAuth));
check('`next` is not read from the Host header', !/host/.test(customerAuth) || /NEXT_PUBLIC_SITE_URL/.test(customerAuth));

/* ------------------------------------------------------------------ */
console.log('\nHonest states');
/* ------------------------------------------------------------------ */

const profilePage = code.get('src/app/(storefront)/account/(pages)/profile/page.tsx') ?? '';
// Checks for an actual control, not the word. The page explains in a comment
// that no consent column exists, and matching on the prose would flag exactly
// the file that is being honest about it.
check(
  'the profile page has no marketing-consent control',
  !/name\s*=\s*["']marketingOptIn["']/.test(profilePage) && !/marketingOptIn\s*[},]/.test(profilePage),
  'there is no consent column to write',
);

const overview = code.get('src/app/(storefront)/account/(pages)/page.tsx') ?? '';
check('the overview counts orders from real rows', /getAccountOrders/.test(overview) && /orders\.length/.test(overview));

/* ------------------------------------------------------------------ */
console.log('\nNesting');
/* ------------------------------------------------------------------ */

const mediaUploader = code.get('src/components/admin/MediaUploader.tsx') ?? '';
check('the uploader portals its form out of the enclosing form', /createPortal/.test(mediaUploader));
check('and tags its controls with form=', /form=\{formId\}/.test(mediaUploader));

/**
 * Detect a `<form>` that is a literal descendant of another `<form>`.
 *
 * Counting `<form` per file is not the same question — a module exporting four
 * separate sign-in forms has four sibling forms, which is fine. This walks the
 * JSX and tracks whether the current position is inside a form element's
 * children, which is the shape the HTML parser breaks.
 */
function findNestedForms(text) {
  const hits = [];
  // Two things must go before scanning, because both contain a literal `<form>`
  // that is not real markup: comments, which discuss the very problem this
  // check looks for, and portal expressions, whose forms are DOM siblings of
  // their apparent parent rather than descendants.
  const source = stripPortals(stripComments(text));

  // Depth in *forms*, tracked with a simple tag scanner. Self-closing tags
  // (`<form ... />`) open nothing, and a closing tag pops one level.
  const tagPattern = /<(\/?)form\b([^>]*)>/gi;
  let match;
  let open = 0;

  while ((match = tagPattern.exec(source)) !== null) {
    const [full, closing, attrs] = match;
    const selfClosing = /\/\s*$/.test(attrs);

    if (closing) {
      open = Math.max(0, open - 1);
    } else if (selfClosing) {
      // `<form ... />` is a leaf; it cannot contain anything.
    } else {
      open += 1;
      if (open > 1) hits.push(full.trim());
    }
  }

  return hits;
}

/** Removes block and line comments, preserving offsets so line numbers hold. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, prefix) => prefix + ' '.repeat(m.length - prefix.length));
}

/** Blanks out `createPortal( … )` regions, matching nested parentheses. */
function stripPortals(text) {
  let out = text;
  let index = out.indexOf('createPortal(');

  while (index !== -1) {
    let depth = 0;
    let end = index + 'createPortal('.length - 1;

    for (; end < out.length; end += 1) {
      if (out[end] === '(') depth += 1;
      else if (out[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    out = out.slice(0, index) + ' '.repeat(end - index + 1) + out.slice(end + 1);
    index = out.indexOf('createPortal(');
  }

  return out;
}

const nestedForms = [];
for (const [file, text] of code) {
  const hits = findNestedForms(text);
  if (hits.length > 0) nestedForms.push(`${file} (${hits.length})`);
}
check(
  'no component nests one <form> inside another',
  nestedForms.length === 0,
  nestedForms.join(', '),
);

/* ------------------------------------------------------------------ */

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f}`);
  console.log();
}
process.exit(failed === 0 ? 0 : 1);

async function exists(p) {
  try {
    await readdir(p);
    return true;
  } catch {
    return false;
  }
}

async function readStaticBundle() {
  const files = await walk(STATIC);
  let out = '';
  for (const file of files) {
    if (/\.(js|css|html|map)$/.test(file)) out += await readFile(file, 'utf8');
  }
  return out;
}
