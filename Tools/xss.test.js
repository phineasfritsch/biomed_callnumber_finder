// Tests that nothing a reader typed reaches the page as markup.
//
//   node Tools/xss.test.js
//
// Two of these were real. The shelf map put the search box into `innerHTML` inside a `<code>`
// tag, uppercased, on the theory that uppercasing was a kind of escaping — it is not, because
// tag and attribute names are case-insensitive and `&#60;` survives it unchanged. The route
// planner put raw textarea lines into its "not located" list the same way.
//
// The first half of this file is the part that keeps them from coming back: the escaper and the
// scheme check are exercised against the payloads that worked, using the shipped implementation
// pulled out of shelf-core.js. The second half reads every page that ships script, because an
// escaper that exists is worth nothing next to one interpolation that forgot to call it.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/* Every file that ships script. The escaper lives in shelf-core.js now; the sinks are spread
   across five pages, and a page left out of this list is a page nothing is checking. */
const FILES = ['shelf-core.js', 'index.html', 'map.html', 'hours.html', 'databases.html'];
const SRC = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
const HTML = FILES.map(f => SRC[f]).join('\n/* ---- next file ---- */\n');
const CORE = SRC['shelf-core.js'];

let pass = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
function section(t) { console.log(`\n${t}`); }

/* ---- the shipped helpers ---- */
function between(start, end, what) {
  const a = CORE.indexOf(start);
  const b = CORE.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`could not find ${what} in shelf-core.js — did the markers move?`);
  return CORE.slice(a, b);
}
const helpers = between('const escHtml =', '/* ===== NLM call-number comparator', 'the shared escaper');
const sandbox = {};
new Function('exports', helpers + '\nObject.assign(exports, { escHtml, safeHref });')(sandbox);
const { escHtml, safeHref } = sandbox;

/* ================= 1. the escaper ================= */
section('the escaper');

eq('a tag cannot open', escHtml('<svg onload=alert(1)>'), '&lt;svg onload=alert(1)&gt;');
eq('an attribute cannot break out', escHtml('" onmouseover="alert(1)'), '&quot; onmouseover=&quot;alert(1)');
eq('a single quote cannot either', escHtml("' onfocus='alert(1)"), '&#39; onfocus=&#39;alert(1)');
eq('an ampersand is escaped first', escHtml('&lt;script&gt;'), '&amp;lt;script&amp;gt;');
eq('nothing is nothing', escHtml(''), '');
eq('absent is nothing', escHtml(null), '');
eq('a call number is left alone', escHtml('WM 100 D299A'), 'WM 100 D299A');

// The payload that worked: uppercasing a numeric character reference does not disarm it, and
// uppercasing a tag does not make it not a tag.
const payload = '<IMG SRC=X ONERROR=ALERT(1)>';
ok('an uppercased tag is still escaped', !/[<>]/.test(escHtml(payload)), escHtml(payload));
const refs = '&#60;script&#62;';
ok('a character reference cannot survive as markup', escHtml(refs.toUpperCase()).indexOf('&#') === -1,
  escHtml(refs.toUpperCase()));

/* ================= 2. the scheme check ================= */
section('the scheme check');

eq('https is the web', safeHref('https://example.org/a'), 'https://example.org/a');
eq('http is the web too', safeHref('http://example.org/a'), 'http://example.org/a');
eq('a script URL is not a link', safeHref('javascript:alert(1)'), '');
eq('nor is one wearing whitespace', safeHref('  javascript:alert(1)'), '');
eq('nor one in mixed case', safeHref('JaVaScRiPt:alert(1)'), '');
eq('a data URL is not a link', safeHref('data:text/html,<script>alert(1)</script>'), '');
eq('a protocol-relative URL is not enough', safeHref('//example.org/a'), '');
eq('nothing is nothing', safeHref(''), '');
eq('absent is nothing', safeHref(undefined), '');

/* ================= 3. nothing typed reaches innerHTML raw ================= */
section('nothing typed reaches innerHTML raw');

/* Every `innerHTML =` in the file, with the template literal that follows it, checked for an
   interpolation that names something a reader controls. The list is deliberately short and
   specific: `q` is the search box, `cns`/`arr`/`lines` are the route textarea. Anything new that
   wants to print reader input has to go through an escaper, or be added here on purpose. */
const READER_INPUT = [
  { re: /\$\{q(?:\.toUpperCase\(\))?\}/g, what: 'the search box (q)' },
  { re: /\$\{(?:st\.)?cns\.join/g, what: 'route textarea lines (cns)' },
  { re: /\$\{arr\.join/g, what: 'route textarea lines (arr)' },
  { re: /\$\{typed\}/g, what: 'the routed banner (typed)' },
];
for (const { re, what } of READER_INPUT) {
  const found = HTML.match(re) || [];
  ok(what + ' is never interpolated unescaped', found.length === 0,
    found.length + ' occurrence(s): ' + found.join(', '));
}

// The sinks that were the bug, named so a rewrite cannot quietly drop the escaper.
for (const marker of [
  'escHtml(q.toUpperCase())',
  'escHtml(term.toUpperCase())',
  'arr.map(escHtml).join',
  'st.cns.map(escHtml).join',
]) {
  ok('`' + marker + '` is still there', HTML.includes(marker));
}

/* Every page that draws reader input has to have an escaper in reach. shelf-core.js supplies one
   to the two pages that load it; the hours and databases panels carry their own, for the reason
   each documents. A page with a sink and no escaper is the failure this catches. */
for (const f of ['index.html', 'map.html', 'hours.html', 'databases.html']) {
  const src = SRC[f];
  const hasSink = /innerHTML\s*=/.test(src);
  const hasEscaper = /const esc\s*=|escHtml|\/shelf-core\.js/.test(src);
  ok(f + ' has an escaper for what it prints', !hasSink || hasEscaper);
}

/* Every href built by string concatenation has to name a scheme check or a literal origin.
   `esc()` keeps a quote from breaking out of the attribute; it says nothing about what the URL
   then does when it is clicked. */
const hrefs = HTML.match(/href="'\+[^)]{0,60}\)/g) || [];
ok('there are hrefs to check', hrefs.length > 0, 'found none — did the pattern change?');
// A sink is satisfied either by calling the check on the spot, or by printing a name that was
// assigned from the check — `const href = ... safeHref(...)` a few lines above.
const guardedNames = new Set(
  (HTML.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^;\n]*safeHref\s*\(/g) || [])
    .map(d => /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(d)[1]));
for (const h of hrefs) {
  const name = (/esc\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(h) || [])[1];
  ok('a built href checks its scheme: ' + h.trim(),
    /safeHref/.test(h) || (name && guardedNames.has(name)),
    h.trim() + (name ? ' — `' + name + '` is never assigned from safeHref()' : ''));
}
ok('the guarded names were actually found', guardedNames.size >= 2, [...guardedNames].join(', '));

/* The two libraries loaded from a CDN at runtime are pinned and checked. A floating major tag is
   whatever the CDN decided it meant this morning, running with the run of the document. */
const cdn = HTML.match(/cdn\.jsdelivr\.net\/npm\/[^']+/g) || [];
ok('both libraries are still loaded from the CDN', cdn.length === 2, cdn.join(', '));
for (const u of cdn) {
  ok('pinned to an exact version: ' + u, /@\d+\.\d+\.\d+\//.test(u), u);
}
eq('each carries an integrity hash', (HTML.match(/s\.integrity='sha384-/g) || []).length, 2);
eq('and is fetched anonymously', (HTML.match(/s\.crossOrigin='anonymous'/g) || []).length, 2);

/* The section pills are a group, not every pill on the page. Selecting all of them cleared the
   catalog and hours highlights whenever a floor was picked. */
ok('the section pills are selected by their group',
  HTML.includes("querySelectorAll('#sect .pill')"),
  'setCollection is not scoped to #sect');

console.log(`\n${pass} passed, ${failures.length} failed`);
failures.forEach(f => console.log('  FAIL ' + f));
process.exit(failures.length ? 1 : 0);
