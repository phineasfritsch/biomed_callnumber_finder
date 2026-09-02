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
/* Matched with positions, not as strings. Three of these sinks print the identical text
   `href="'+esc(href)`, so looking each one up by `indexOf` resolved all three to the first of them
   and checked that one three times — an unguarded copy pasted below a guarded one inherited its
   pass. Every sink is now judged where it actually sits. */
const hrefs = [...HTML.matchAll(/href="'\+[^)]{0,60}\)/g)].map(m => ({ text: m[0], at: m.index }));
ok('there are hrefs to check', hrefs.length > 0, 'found none — did the pattern change?');
/* A sink is satisfied by calling the check on the spot, or by printing a name that was assigned
   from a check — `const href = ... safeHref(...)` a few lines above.

   That second rule used to be evaluated against a flat, file-global set of names, which made it
   worth nothing: `href` is the obvious name for a URL and it is used a dozen times over, so ONE
   `const href = safeHref(…)` anywhere in the file signed off every other `href` in it forever.
   Two sinks passed that way while calling no check at all. The lookup is now positional — the
   assignment has to be the nearest one above the sink — so a name proves only what it was last
   assigned from.

   A sink may also name its own guarantee. `primoHref` builds its URL from an MMS id it has just
   matched against `/^\d+$/`, which is strictly stronger than a scheme check: digits cannot spell
   `javascript:`. Listing it here is the claim that the guard exists, and the assertion below
   holds it to that. */
const SELF_GUARDED = { primoHref: /\/\^\\d\+\$\/\.test\(/ };
for (const [fn, guard] of Object.entries(SELF_GUARDED)) {
  const body = new RegExp('function\\s+' + fn + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,400}?)\\n\\s*\\}')
    .exec(HTML);
  ok(fn + '() still validates its input before building a URL',
    !!body && guard.test(body[1]),
    body ? body[1].trim() : fn + '() not found — was it renamed?');
}

// Where each safeHref-assigned name was last bound, so a name is checked against the assignment
// above it rather than against every assignment in the file.
const bindings = [...HTML.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=([^;\n]*)/g)]
  .map(m => ({ at: m.index, name: m[1], guarded: /safeHref\s*\(|primoHref\s*\(/.test(m[2]) }));
let guardedSinks = 0;
for (const { text, at } of hrefs) {
  const name = (/esc\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(text) || [])[1];
  const nearest = bindings.filter(b => b.name === name && b.at < at).pop();
  const guarded = /safeHref/.test(text) || (nearest && nearest.guarded);
  if (guarded) guardedSinks++;
  ok('a built href checks its scheme: ' + text.trim(), guarded,
    `at ${at}` + (name
      ? ` — the nearest \`${name}\` above it is not assigned from a checked builder`
      : ''));
}
ok('some sink was satisfied by a name rather than an inline call', guardedSinks > 0);

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
