// Lists the Material Symbols the app uses, so the 5 MB icon font can be
// subset to a few kilobytes (scripts/subset-icons.py builds the font from
// the list).
//
//   node scripts/icons.mjs          rewrite src/assets/fonts/icons.json
//   node scripts/icons.mjs --check  fail if the list is out of date (CI)
//
// An icon is found when its name is
// * the text of a `material-symbols-rounded` element: `<span …>today</span>`,
// * a quoted string inside such an element's interpolation: `{{ x ? 'check' : 'edit' }}`,
// * an `icon="…"` attribute (pch-empty-state) or an `icon: '…'` property.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LIST = join(ROOT, 'src/assets/fonts/icons.json');
const NAME = /^[a-z][a-z0-9_]*$/;

function files(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts') ? [path] : [];
  });
}

const found = new Set();
for (const file of files(join(ROOT, 'src/app'))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/material-symbols-rounded[^>]*>\s*([a-z][a-z0-9_]*)\s*</g)) {
    found.add(m[1]);
  }
  for (const m of text.matchAll(/material-symbols-rounded[^>]*>\s*\{\{([\s\S]*?)\}\}/g)) {
    for (const q of m[1].matchAll(/'([a-z][a-z0-9_]*)'/g)) found.add(q[1]);
  }
  for (const m of text.matchAll(/\bicon\s*[=:]\s*["']([a-z][a-z0-9_]*)["']/g)) found.add(m[1]);
}
const icons = [...found].filter((n) => NAME.test(n)).sort();
const json = JSON.stringify(icons, null, 2) + '\n';

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(LIST, 'utf8');
  } catch {}
  if (current !== json) {
    console.error(
      'src/assets/fonts/icons.json is out of date. Run `npm run icons` (needs Python with fonttools and brotli).',
    );
    process.exit(1);
  }
  console.log(`${icons.length} icons, list up to date.`);
} else {
  writeFileSync(LIST, json);
  console.log(`${icons.length} icons: ${icons.join(', ')}`);
}
