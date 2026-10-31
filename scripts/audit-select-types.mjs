/**
 * Checks for `.select('a, b').maybeSingle<T>()` where the generic claims a
 * property the query never asked for.
 *
 * The database stores snake_case columns and PostgREST returns exactly the
 * names requested. A generic that names a camelCase property the select did not
 * include is a type assertion over a shape that does not exist at runtime, and
 * it fails silently — `tsc` agrees with the assertion, and the wrong value is
 * only discovered as a `TypeError` or a blank field much later.
 *
 * Usage: node scripts/audit-select-types.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOTS = ['src'];
const EXTENSIONS = new Set(['.ts', '.tsx']);

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(path)));
    else if (EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) found.push(path);
  }
  return found;
}

/** `"key, nested(a, b)"` -> the set of top-level column names. */
function selectedColumns(argument) {
  const columns = new Set();
  let depth = 0;
  let current = '';
  for (const character of argument) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      const name = current.trim().split(/\s+/)[0];
      if (name) columns.add(name);
      current = '';
    } else {
      current += character;
    }
  }
  const name = current.trim().split(/\s+/)[0];
  if (name) columns.add(name);
  return columns;
}

/** `{ a: string; b?: number }` -> ['a', 'b']. */
function declaredKeys(generic) {
  const keys = [];
  const body = generic.replace(/^\{|\}$/g, '');
  for (const part of body.split(/[;,]/)) {
    const match = /^\s*([A-Za-z_$][\w$]*)\s*\??\s*:/.exec(part);
    if (match) keys.push(match[1]);
  }
  return keys;
}

const files = (await Promise.all(ROOTS.map(walk))).flat();
const findings = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const select = /\.select\(\s*(['"`])([^'"`]+)\1\s*\)/.exec(line);
    if (!select) return;

    const columns = selectedColumns(select[2]);

    // The generic sits on `.maybeSingle<...>()` / `.single<...>()` / `.limit(..)`
    // within the next few lines of the same chain.
    const window = lines.slice(index, index + 4).join('\n');
    const generic = /\.maybeSingle<\{([\s\S]*?)\}>|\.single<\{([\s\S]*?)\}>/.exec(window);
    if (!generic) return;

    const keys = declaredKeys(generic[1] ?? generic[2] ?? '');
    for (const key of keys) {
      if (columns.has(key)) continue;
      findings.push({
        file,
        line: index + 1,
        key,
        selected: [...columns].join(', '),
      });
    }
  });
}

if (findings.length === 0) {
  console.log('no select/generic mismatches found');
  process.exit(0);
}

console.log(`select/generic mismatches: ${findings.length}\n`);
for (const finding of findings) {
  console.log(`  ${finding.file}:${finding.line}`);
  console.log(`    asserts  ${finding.key}`);
  console.log(`    selected ${finding.selected}\n`);
}
process.exit(1);