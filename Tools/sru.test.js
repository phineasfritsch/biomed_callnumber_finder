// Tests for the request layer, run against a stubbed endpoint.
//
//   node Tools/sru.test.js
//
// Like Tools/catalog.test.js, this pulls the code verbatim out of the built index.html
// rather than restating it, so a passing run is a statement about the file that ships.
//
// What it pins is how much the app is allowed to cost the catalog: a count-only probe must
// transfer no records, an identical question must be asked once, a single search must not
// exceed its request budget, and requests must be spaced. Every one of those is invisible
// in the UI and would regress silently.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const a = HTML.indexOf('/* ---- SRU ---- */');
const b = HTML.indexOf('/* ---- render ---- */', a);
if (a < 0 || b < 0) throw new Error('could not find the SRU block');
const block = HTML.slice(a, b);

const sent = [];
function makeSandbox() {
  sent.length = 0;
  const ctx = {
    PAGE: 50,
    SRU: 'https://example.invalid/sru',
    MARC: 'http://www.loc.gov/MARC21/slim',
    readRecord: () => ({ stub: true }),
    setTimeout, Date, URLSearchParams, Error,
    fetch: async (url) => {
      sent.push(url);
      const n = +(/maximumRecords=(\d+)/.exec(url) || [])[1];
      return { ok: true, text: async () => `<n>${n}</n>` };
    },
    DOMParser: class {
      parseFromString(txt) {
        const want = +(/<n>(\d+)<\/n>/.exec(txt) || [])[1];
        const recs = Array.from({ length: want }, () => ({}));
        return {
          getElementsByTagName: (t) => t === 'parsererror' ? []
            : [{ localName: 'numberOfRecords', textContent: '999' }],
          getElementsByTagNameNS: () => recs,
        };
      }
    },
  };
  const keys = Object.keys(ctx);
  const fn = new Function(...keys, 'out', block + '\n out.sru = sru; out.perf = perf;');
  const out = {};
  fn(...keys.map(k => ctx[k]), out);
  return out;
}

let pass = 0; const fails = [];
const ok = (name, cond, detail) => cond ? pass++ : fails.push(detail ? `${name}: ${detail}` : name);

(async () => {
  // 1. A count-only probe must ask for zero records. `max||PAGE` sent 50.
  let s = makeSandbox();
  await s.sru('q1', 1, undefined, 0);
  ok('count probe asks for 0 records', /maximumRecords=0\b/.test(sent[0]), sent[0]);
  ok('count probe transfers no records', s.perf.records === 0, `records=${s.perf.records}`);

  // 2. An ordinary call still defaults to a full page.
  s = makeSandbox();
  await s.sru('q2', 1, undefined, undefined);
  ok('default page is 50', /maximumRecords=50\b/.test(sent[0]), sent[0]);

  // 3. An identical question is asked once.
  s = makeSandbox();
  await s.sru('same', 1, undefined, 10);
  await s.sru('same', 1, undefined, 10);
  ok('duplicate served from cache', sent.length === 1, `${sent.length} requests sent`);
  ok('cache hit is counted', s.perf.cached === 1, `cached=${s.perf.cached}`);

  // 4. Cache key includes page size and start record.
  s = makeSandbox();
  await s.sru('k', 1, undefined, 10);
  await s.sru('k', 1, undefined, 50);
  await s.sru('k', 51, undefined, 50);
  ok('page size and offset are part of the key', sent.length === 3, `${sent.length} requests`);

  // 5. One search cannot spend more than its budget.
  s = makeSandbox();
  let threw = null;
  for (let i = 0; i < 40; i++) {
    try { await s.sru('budget' + i, 1, undefined, 0); }
    catch (e) { threw = e; break; }
  }
  ok('budget stops the ladder', !!threw && threw.budget === true, threw ? threw.message : 'never threw');
  ok('budget is 25 requests', sent.length === 25, `${sent.length} sent`);

  // 6. Requests are spaced, so a recovery burst cannot machine-gun the endpoint.
  s = makeSandbox();
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) await s.sru('gap' + i, 1, undefined, 0);
  const elapsed = Date.now() - t0;
  ok('five requests take at least four gaps', elapsed >= 4 * 120 - 20, `${elapsed} ms`);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
})();
