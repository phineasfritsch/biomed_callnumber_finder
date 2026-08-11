// Tests what this deployment publishes.
//
//   node Tools/assets.test.js
//
// `assets.directory` in wrangler.jsonc is the repo root, so the document root is the repo: every
// file here is on the public web unless .assetsignore names it. That default has already shipped
// things nobody meant to — a local wrangler state file carrying an account id and an email, a
// search report, and the deployment's own config at /wrangler.jsonc.
//
// So the published set is written down here rather than inferred. A new file at the top level
// fails this test until someone decides, on purpose, which side of the line it is on.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let pass = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
}
function section(t) { console.log(`\n${t}`); }

/* ---- the ignore list, applied the way Cloudflare applies it ---- */
const patterns = fs.readFileSync(path.join(ROOT, '.assetsignore'), 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

// .assetsignore is gitignore syntax; only the three shapes this file actually uses are handled,
// and anything else is refused loudly rather than quietly mis-parsed.
function ignored(rel) {
  return patterns.some(p => {
    if (p.endsWith('/')) return rel === p.slice(0, -1) || rel.startsWith(p);
    if (p.startsWith('*.')) return rel.endsWith(p.slice(1));
    if (p.includes('*')) throw new Error('unhandled .assetsignore pattern: ' + p);
    return rel === p || rel.startsWith(p + '/');
  });
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/');
    if (ignored(rel)) continue;
    if (e.isDirectory()) walk(path.join(dir, e.name), out);
    else out.push(rel);
  }
  return out;
}

const published = walk(ROOT, []).sort();

/* ---- what is supposed to be there ---- */
const EXPECTED = [
  // the five pages of the tool
  'index.html',
  'map.html',
  'hours.html',
  'databases.html',
  '404.html',
  // the two text pages
  'about.html',
  'methodology.html',
  // what every page shares
  'site.css',
  'shelf-data.js',
  'shelf-core.js',
  // icons, the share card, and the one directive file
  'apple-touch-icon.png',
  'favicon.ico',
  'favicon.svg',
  'og-card.png',
  'robots.txt',
  // UCLA's own campus map of the nine library locations, linked from /hours
  'ucla-library-locations-2026.pdf',
].sort();

section('what this deployment publishes');

const extra = published.filter(f => !EXPECTED.includes(f));
const gone = EXPECTED.filter(f => !published.includes(f));

ok('nothing is published that was not meant to be', extra.length === 0,
  extra.length + ' unexpected: ' + extra.join(', ') +
  '\n      → add it to .assetsignore, or to EXPECTED in this file if it belongs on the site');
ok('everything the pages need is published', gone.length === 0,
  'missing: ' + gone.join(', '));
ok('the published set is exactly sixteen files', published.length === 16,
  published.length + ': ' + published.join(', '));
// The other PDF in this directory is a scan that has never been served and must stay that way.
ok('the scan stays off the site', ignored('BookScanCenter.pdf'));

/* Every page has to reach the one stylesheet and, if it draws shelves, the two shared scripts.
   A page that links a file which is not published renders unstyled, which is the kind of break
   that only shows up in a browser. */
for (const page of ['index.html', 'map.html', 'hours.html', 'databases.html', 'about.html', 'methodology.html', '404.html']) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  ok(page + ' links the shared stylesheet', src.includes('href="/site.css"'));
  for (const m of src.matchAll(/(?:href|src)="(\/[^"#?]+)"/g)) {
    const rel = m[1].slice(1);
    if (!rel) continue;
    ok(page + ' links /' + rel + ', which is published', published.includes(rel) || fs.existsSync(path.join(ROOT, rel + '.html')),
      'not in the published set');
  }
}
for (const page of ['index.html', 'map.html']) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  ok(page + ' loads the shelf dataset before the core that reads it',
    src.indexOf('/shelf-data.js') > 0 && src.indexOf('/shelf-data.js') < src.indexOf('/shelf-core.js'));
}

section('the things that must never ship');

// Named individually, because each of these is a specific thing that would be bad to serve and
// a pattern in .assetsignore is easy to weaken without noticing.
const FORBIDDEN = [
  '.wrangler', '.git', '.claude', 'src', 'Tools', 'fixtures', 'ios', 'Floors',
  'biomed-shelf-ranges.json', 'Instructions.txt', 'wrangler.jsonc', '.assetsignore', '.gitignore',
];
for (const f of FORBIDDEN) {
  ok(f + ' stays off the site', ignored(f), 'not matched by any .assetsignore pattern');
}
// And by extension, anything inside them.
for (const f of ['src/worker.js', 'Tools/worker.test.js', 'ios/App.swift', '.wrangler/cache/wrangler-account.json']) {
  ok(f + ' stays off the site', ignored(f));
}
for (const f of ['BookScanCenter.pdf', 'README.md', 'CATALOG.md', 'notes.py']) {
  ok(f + ' stays off the site', ignored(f));
}

section('the config that decides all this');

const cfg = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
ok('the document root is still the repo root', /"directory"\s*:\s*"\."/.test(cfg),
  'if this changed, the reasoning above no longer applies');
ok('an unknown path gets a real 404', /"not_found_handling"\s*:\s*"404-page"/.test(cfg),
  'single-page-application returns index.html with a 200 for every wrong URL');
ok('there is a 404 page for it to serve', fs.existsSync(path.join(ROOT, '404.html')));

console.log(`\n${pass} passed, ${failures.length} failed`);
failures.forEach(f => console.log('  FAIL ' + f));
process.exit(failures.length ? 1 : 0);
