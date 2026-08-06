// Fires the CQL the app actually builds at the live SRU endpoint, one count-only probe each.
//
//   node Tools/cql.replay.js            # every mode and every filter token
//   node Tools/cql.replay.js author     # only rows whose label contains "author"
//
// The unit tests can prove the string is what was intended. They cannot prove Alma accepts it,
// and they cannot prove it matches anything — which is the failure that matters here, because
// a filter that silently returns zero is indistinguishable at the desk from a gap in the
// collection. So this builds the query with the shipped `buildCQL` and asks the endpoint.
//
// Uses maximumRecords=0: the count alone, no records, ~70-100 ms once the connection is warm.
// Re-run it after touching buildCQL or the FIELD table.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SRU = 'https://ucla.alma.exlibrisgroup.com/view/sru/01UCS_LAL';

function between(start, end, what) {
  const a = HTML.indexOf(start), b = HTML.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`could not find ${what} in index.html`);
  return HTML.slice(a + start.length, b);
}
const core = between('/* == catalog-core:start ==', '/* == catalog-core:end == */', 'catalog core')
  .replace(/^[\s\S]*?\*\//, '');
const dataJson = between('const DATA = ', ';', 'embedded DATA');
const comparator = HTML.slice(HTML.indexOf('function parseCN(raw)'), HTML.indexOf('/* ===== layout ====='));

const sandbox = {};
new Function('exports', `
  const DATA = ${dataJson};
  ${comparator}
  ${core}
  Object.assign(exports, { parseQuery, buildCQL, setHereLib });
`)(sandbox);
const { parseQuery, buildCQL } = sandbox;

/* Each row is what a reader would type. `mode` is the Search by pill. `min` is the smallest
   result count that still means "this works" — 1 for anything real, 0 only where zero is the
   honest answer and is asserted deliberately. */
const CASES = [
  // --- the four search modes ---
  ['keyword: two words',        'internal medicine',                'keyword', 1],
  ['keyword: truncation',       'cardio*',                          'keyword', 1],
  ['title: unquoted words',     'principles of internal medicine',  'title',   1],
  ['title: quoted phrase',      '"atlas shrugged"',                 'title',   1],
  ['title: words out of order', 'medicine internal principles',     'title',   1],
  ['author: forename first',    'ayn rand',                         'author',  1],
  ['author: surname first',     'rand ayn',                         'author',  1],
  ['author: surname only',      'longo',                            'author',  1],
  ['author: corporate',         'world health organization',        'author',  1],
  ['isbn: punctuated',          '978-0-07-180215-4',                'isbn',    1],

  // --- descriptive filters ---
  ['title:',                    'title:"internal medicine"',        'keyword', 1],
  ['author:',                   'author:"ayn rand"',                'keyword', 1],
  ['au: alias',                 'au:longo',                         'keyword', 1],
  ['subject:',                  'subject:nursing',                  'keyword', 1],
  ['subject: two words',        'subject:heart diseases',           'keyword', 1],
  ['mesh:',                     'mesh:neoplasms',                   'keyword', 1],
  ['lcsh:',                     'lcsh:cardiology',                  'keyword', 1],
  ['series:',                   'series:Lange',                     'keyword', 1],
  ['genre:',                    'genre:atlases',                    'keyword', 1],
  ['uniform:',                  'uniform:bible',                    'keyword', 1],
  ['publisher:',                'publisher:Elsevier',               'keyword', 1],
  ['place:',                    'place:"New York"',                 'keyword', 1],
  ['note:',                     'note:bibliography',                'keyword', 1],
  ['isbn:',                     'isbn:9780071802154',               'keyword', 1],
  ['issn:',                     'issn:0028-4793',                   'keyword', 1],

  // --- call numbers and codes ---
  ['cn:',                       'cn:"WM 100"',                      'keyword', 1],
  ['nlm:',                      'nlm:"WB 115"',                     'keyword', 1],
  ['lc:',                       'lc:PS3535',                        'keyword', 1],
  ['lang: by code',             'cardiology lang:fre',              'keyword', 1],
  ['lang: by name',             'cardiology lang:spanish',          'keyword', 1],
  ['loc:',                      'cardiology loc:birf',              'keyword', 1],
  ['material:',                 'material:dvd',                     'keyword', 1],

  // --- years ---
  ['year: exact',               'cardiology year:2015',             'keyword', 1],
  ['year: range',               'cardiology year:2010..2020',       'keyword', 1],
  ['year: open ended',          'cardiology year:2015+',            'keyword', 1],
  ['year: decade',              'cardiology year:1990s',            'keyword', 1],
  ['after:/before:',            'cardiology after:2015 before:2020','keyword', 1],

  // --- record type ---
  ['type:book',                 'cardiology type:book',             'keyword', 1],
  ['type:journal',              'cardiology type:journal',          'keyword', 1],
  ['type:video',                'cardiology type:video',            'keyword', 1],

  // --- negation, and combinations ---
  ['negated language',          'anatomy genre:atlases -lang:eng',  'keyword', 1],
  ['negated field',             'cardiology -publisher:Elsevier',   'keyword', 1],
  ['three filters at once',     'mesh:neoplasms year:2020+ type:book', 'keyword', 1],
  ['filter with no free text',  'mesh:neoplasms',                   'keyword', 1],
];

const only = process.argv[2];
const rows = only ? CASES.filter(c => c[0].toLowerCase().includes(only.toLowerCase())) : CASES;

async function count(cql) {
  const p = new URLSearchParams({ version: '1.2', operation: 'searchRetrieve',
    recordSchema: 'marcxml', maximumRecords: '0', startRecord: '1', query: cql });
  const res = await fetch(SRU + '?' + p);
  if (!res.ok) return { err: 'HTTP ' + res.status };
  const t = await res.text();
  const d = /<diag:message>([^<]*)</.exec(t) || /<message>([^<]*)</.exec(t);
  if (d) return { err: d[1] };
  const m = /<(?:zs:)?numberOfRecords>(\d+)</.exec(t);
  return { n: m ? +m[1] : 0 };
}

(async () => {
  let bad = 0;
  for (const [label, typed, mode, min] of rows) {
    const parsed = parseQuery(typed, 'biomed');
    const cql = buildCQL(parsed, mode, 'ucla', 'best');
    if (!cql) { console.log(`FAIL ${label.padEnd(26)} built no query`); bad++; continue; }
    const r = await count(cql);
    const okRow = !r.err && r.n >= min;
    if (!okRow) bad++;
    console.log(
      (okRow ? '  ok ' : 'FAIL ') + label.padEnd(26) +
      (r.err ? 'ERROR ' + r.err : String(r.n).padStart(9)) +
      (parsed.errors.length ? '   parse: ' + parsed.errors.join(' ') : ''));
    if (!okRow) console.log('       ' + cql);
  }
  console.log(`\n${rows.length - bad} of ${rows.length} returned records`);
  process.exit(bad ? 1 : 0);
})();
