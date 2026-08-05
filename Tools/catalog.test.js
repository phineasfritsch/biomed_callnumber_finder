// Tests for the catalog → shelf join, run against the two live SRU fixtures.
//
//   node Tools/catalog.test.js
//
// The point of extracting the code out of index.html instead of re-typing it here is that
// the other tools in this repo (ios/Tools/golden.js, testsheet.js) each keep their own copy
// of the comparator, and copies drift. This harness pulls the `catalog-core` block and the
// comparator verbatim out of the built index.html, so a passing run says something about the
// file that actually ships — not about a paraphrase of it.
//
// Fixtures are saved responses. Nothing here touches the network.

const fs = require('fs');
const path = require('path');


const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---- extract the shipped code ---- */
function between(start, end, what) {
  const a = HTML.indexOf(start);
  const b = HTML.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`could not find ${what} in index.html — did the markers move?`);
  return HTML.slice(a + start.length, b);
}
const core = between('/* == catalog-core:start ==', '/* == catalog-core:end == */', 'catalog core')
  .replace(/^[\s\S]*?\*\//, ''); // drop the marker's own block comment tail

// The comparator + dataset the core leans on.
const dataJson = between('const DATA = ', ';', 'embedded DATA'); // the JSON holds no semicolons
const comparator = HTML.slice(
  HTML.indexOf('function parseCN(raw)'),
  HTML.indexOf('/* ===== layout =====')
);

const sandbox = {};
new Function('exports', `
  const DATA = ${dataJson};
  ${comparator}
  ${core}
  Object.assign(exports, { DATA, parseCN, cmpCN, scheme,
    splitCallNumber, yearOf, isLocatable, classify, shelfHits, resolve, byYearDesc,
    BIOMED_LOC, norm, normTitle, lev, wordIn, coverage, scoreRecord, relaxations,
    SCOPE, FIELD, TYPE, tokenize, yearClauses, parseQuery, buildCQL, orGroup,
    idfContext, runBonus, recordYear, passesLocal, shelfKey, cmpShelf,
    clusterKey, clusterRecords, sortClusters, detectMode,
    carrierOf, carrierLabel, CARRIER, PHANTOM_LIB });
`)(sandbox);

const { splitCallNumber, yearOf, isLocatable, resolve, shelfHits, cmpCN, byYearDesc,
        norm, normTitle, lev, coverage, scoreRecord, relaxations,
        SCOPE, tokenize, yearClauses, parseQuery, buildCQL, orGroup,
        idfContext, runBonus, recordYear, passesLocal, cmpShelf,
        clusterKey, clusterRecords, sortClusters, detectMode,
        carrierOf, carrierLabel } = sandbox;

/* ---- tiny assertion harness ---- */
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

/* ================= 1. splitCallNumber — the dirty-data cases from §2.7 ================= */
section('splitCallNumber');

eq('plain NLM passes through', splitCallNumber('WJ 752 M2673 2004').cn, 'WJ 752 M2673 2004');

// Media prefixes must be lifted off, and remain visible so the desk knows what it is.
[['DVD WB 115 H248p 2012', 'DVD', 'WB 115 H248p 2012'],
 ['DVD-ROM WB 115 H322 2015', 'DVD-ROM', 'WB 115 H322 2015'],
 ['CD-ROM WJ 752 M2673 2004', 'CD-ROM', 'WJ 752 M2673 2004']].forEach(([raw, pre, cn]) => {
  const p = splitCallNumber(raw);
  eq(`prefix stripped: ${raw}`, [p.prefix, p.cn], [pre, cn]);
});

// Barcodes are appended by SRLF and are not part of the call number.
const bc = splitCallNumber('RD33.7 .M75 2008 [Barcode:AX0005561634]');
eq('barcode removed from cn', bc.cn, 'RD33.7 .M75 2008');
eq('barcode captured', bc.barcode, 'AX0005561634');

// Barcode-only: there is no call number at all. Must not become a shelf.
const only = splitCallNumber('[Barcode:DD0002929479]');
eq('barcode-only leaves nothing', only.cn, '');
ok('barcode-only is not locatable', !isLocatable(only.cn));
eq('barcode-only resolve refuses',
   resolve({ b: 'BIOMED', j: 'bi', d: '[Barcode:DD0002929479]' }).reason, 'no-call-number');

eq('empty $d is survivable', splitCallNumber('').cn, '');
eq('undefined $d is survivable', splitCallNumber(undefined).cn, '');

/* ================= 2. yearOf — the edition-ordering key ================= */
section('yearOf');

eq('plain year', yearOf('WB 115 H248p 1998'), 1998);
eq('year with edition letter', yearOf('WB 115 H248p 1991a'), 1991);
eq('year before a qualifier', yearOf('WB 115 H248p 1998 Supp.'), 1998);
eq('year after a volume token', yearOf('W1 CO147 v.2 1934'), 1934);
eq('LC form with a trailing qualifier', yearOf('RC46 .H333 1991 Suppl. 2'), 1991);
eq('no year at all', yearOf('WL 102.8 N398'), null);
eq('no year on a bare class', yearOf('RC46 .H32'), null);
// A class number must never be mistaken for a year: only tokens past the class are read.
eq('class number is not a year', yearOf('WB 1998'), null);

/* ================= 3. Cutter decimal ordering — the bug that would be invisible ======= */
section('cutter ordering (decimal, not integer)');

ok('H248p sorts before H32 (0.248 < 0.32)', cmpCN('WB 115 H248p 2012', 'WB 115 H32 2015') < 0,
   `cmpCN returned ${cmpCN('WB 115 H248p 2012', 'WB 115 H32 2015')}`);
ok('H248p sorts before H322 (0.248 < 0.322)', cmpCN('WB 115 H248p 2012', 'WB 115 H322 2015') < 0);
ok('AM4733 sorts before AM477 (0.4733 < 0.477)', cmpCN('W1 AM4733', 'W1 AM477') < 0);
ok('integer reading would invert it', 4733 > 477); // documents what we are NOT doing

// The Harrison's transition: the string order is wrong, the year order is right.
const harrison = [
  { parts: splitCallNumber('WB 115 H322 2018') },
  { parts: splitCallNumber('WB 115 H248p 1998') },
  { parts: splitCallNumber('WB 115 H322 2015') },
  { parts: splitCallNumber('WB 115 H248p 2012') },
];
eq('newest-first is by year, not by string',
   harrison.slice().sort(byYearDesc).map(h => h.parts.year), [2018, 2015, 2012, 1998]);
ok('string order really is wrong here', cmpCN('WB 115 H322 2015', 'WB 115 H248p 2012') > 0);

/* ================= 4. isLocatable — the refusal gate ================= */
section('isLocatable');

[['WB 115 H248p 1998', true],
 ['WJ 752 M2673 2004', true],
 ['WL 102.8 N398', true],
 ['W1 CO147 v.2 1934', true],       // W1 serials scheme
 ['BF789.D4 K16a 2005', true],      // LC-shaped, but genuinely in the Biomed sequence
 ['QL737.C22 M616g 1971', true],
 ['', false],
 ['Sontag RC46 .P895 1987', false], // collection prefix, not a shelvable number here
 ['[Barcode:DD0002929479]', false],
 ['see series record', false]].forEach(([cn, want]) => {
  eq(`isLocatable(${JSON.stringify(cn)})`, isLocatable(cn), want);
});

/* ================= 5. resolve — routing by library and $j ================= */
section('resolve / routing');

const R = (b, j, d) => resolve({ b, j, d });

eq('bi with a mapped number resolves to a shelf', R('BIOMED', 'bi', 'WB 115 H248p 1998').hits.length > 0, true);
eq('bi media copy refuses', R('BIOMED', 'bicidperm', 'DVD WB 115 H248p 2012').reason, 'not-stacks');
eq('media prefix inside bi still refuses', R('BIOMED', 'bi', 'CD-ROM WJ 752 M2673 2004').reason, 'media');
eq('reserves is not a stacks lookup', R('BIOMED', 'birs', 'WB 115 H322 2018').reason, 'not-stacks');
eq('reference is not a stacks lookup', R('BIOMED', 'birf', 'WB 115 H248p 2005').reason, 'not-stacks');
eq('SRLF is another library', R('SRLF', 'sr', 'RC46 .H32 1974 [Barcode:AA0015918451]').route.kind, 'away');
eq('SRLF never gets a shelf', R('SRLF', 'sr', 'WB 100 H248p 1970 [Barcode:AA0012928339]').hits.length, 0);
eq('LSC boxed is another library', R('LSC', 'lsyrboxm', 'Sontag RC46 .H32 1977b').route.kind, 'away');

// An unlisted Biomed code must degrade to "ask at the desk", never to a guessed shelf.
const unknown = R('BIOMED', 'bizzz', 'WB 115 H248p 1998');
eq('unknown Biomed code is not routed', unknown.route.kind, 'unknown');
eq('unknown Biomed code gets no shelf', unknown.hits.length, 0);

// Locations confirmed live against the endpoint.
['bi', 'biper', 'biprwt', 'bian', 'birf', 'birs', 'bicidperm', 'bicimm', 'biherb']
  .forEach(j => ok(`location ${j} is in the routing table`, !!sandbox.BIOMED_LOC[j]));

// Level 9 is Special Collections and must never be reached from a stacks code.
ok('no stacks lookup ever lands on level 9',
   shelfHits('WB 115 H248p 1998').every(h => h.lvl !== 9));

/* ================= 6. The fixtures, end to end ================= */
section('fixtures (live SRU responses, replayed offline)');

// Node has no DOMParser and this repo has no runtime dependencies; AVA fields in MARCXML
// are flat enough that a scanner is honest here. The browser side uses a real XML parser.
const UNESC = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
                    .replace(/&amp;/g, '&');
function avasFrom(file) {
  const xml = fs.readFileSync(path.join(ROOT, 'fixtures', file), 'utf8');
  const out = [];
  const df = /<datafield[^>]*\btag="AVA"[^>]*>([\s\S]*?)<\/datafield>/g;
  let m;
  while ((m = df.exec(xml))) {
    const sub = /<subfield[^>]*\bcode="([^"]+)"[^>]*>([\s\S]*?)<\/subfield>/g;
    const rec = {};
    let s;
    while ((s = sub.exec(m[1]))) rec[s[1]] = UNESC(s[2]).trim();
    out.push(rec);
  }
  return out;
}

const fixtures = ['focused-ultrasound.xml', 'harrisons.xml'];
const all = [];
fixtures.forEach(f => {
  const avas = avasFrom(f);
  ok(`${f} yielded holdings`, avas.length > 0, `parsed ${avas.length}`);
  avas.forEach(a => all.push({ file: f, a, r: resolve(a) }));
});

// The acceptance criterion, stated as a test: nothing is ever given a shelf unless it is
// a Biomed stacks location whose call number parsed cleanly.
all.forEach(({ file, a, r }) => {
  if (!r.hits.length) return;
  ok(`${file}: shelf only for Biomed — ${a.d}`, (a.b || '').toUpperCase() === 'BIOMED');
  ok(`${file}: shelf only for a stacks code — ${a.d}`, r.route.kind === 'stacks');
  ok(`${file}: shelf only for a parsed number — ${a.d}`, isLocatable(r.parts.cn) && !r.parts.prefix);
});

// Every holding lands in exactly one bucket — none is silently dropped.
all.forEach(({ file, a, r }) => {
  const routed = r.hits.length > 0 || r.reason === 'not-stacks' || !!sandbox.BIOMED_LOC[(a.j || '').toLowerCase()]
    || r.route.kind === 'away' || r.route.kind === 'unknown' || !!r.reason;
  ok(`${file}: holding is accounted for — ${a.d || '(no $d)'}`, routed);
});

// check_holdings arrives without $f/$g; nothing may invent a count for it.
const checks = all.filter(({ a }) => (a.e || '') === 'check_holdings');
ok('fixtures exercise check_holdings', checks.length > 0, `found ${checks.length}`);
checks.forEach(({ a }) => ok(`check_holdings carries no count — ${a.d}`, a.f === undefined && a.g === undefined));

// $f/$g are per holding, not per bib: the Harrison's fixture has one bib whose two AVAs
// report different totals. If that ever stops being true the UI is showing the wrong count.
const totals = new Set(all.filter(x => x.file === 'harrisons.xml' && x.a.f !== undefined).map(x => x.a.f));
ok('per-holding counts vary within the fixture', totals.size > 1, `saw ${[...totals].join(', ')}`);

// The specific Biomed rows that must reach a shelf.
[['WB 115 H248p 1998', 'harrisons.xml'],
 ['WJ 168 M665 2005', 'focused-ultrasound.xml'],
 ['WP 459 U89 2006', 'focused-ultrasound.xml']].forEach(([cn, file]) => {
  const hit = all.find(x => x.file === file && x.r.parts.cn === cn && (x.a.b || '').toUpperCase() === 'BIOMED');
  ok(`${cn} is present in ${file}`, !!hit);
  if (hit) ok(`${cn} resolves to a shelf`, hit.r.hits.length > 0, `reason: ${hit.r.reason}`);
});

// A real gap in the shelf map, pinned deliberately. The dataset jumps from WJ 348 C616
// (level 10) to WJ 752 P968 (level 8), so WJ 752 M2673 sits in unrecorded territory. The
// right behaviour is to say so, not to round it to the nearest mapped range — if someone
// later photographs those labels this assertion flips and should be updated, not deleted.
const gap = all.find(x => x.r.parts.cn === 'WJ 752 M2673 2004' && (x.a.b || '').toUpperCase() === 'BIOMED');
ok('the WJ 348–752 gap is present in the fixture', !!gap);
if (gap) eq('an unmapped range is reported, not guessed', gap.r.reason, 'unmapped');

// The 060-vs-AVA discrepancy: AVA $d is authoritative, and it is what we parsed.
const p9665 = all.find(x => x.r.parts.cn === 'WJ 752 P9665 2000');
ok('AVA $d (P9665) is used, not MARC 060 (P96665)', !!p9665);

/* ================= 7. Relevance ranking ================= */
// Alma returns hits in filing-title order with no ranking at all, so everything here is the
// difference between "Atlas shrugged" being the first result and being the fourth.
section('relevance');

eq('normalise drops articles', normTitle('The Art of Fiction'), 'art of fiction');
eq('normalise drops apostrophes without splitting', norm("Harrison's"), 'harrisons');
eq('normalise folds accents', normTitle('Pediatría'), 'pediatria');
eq('bounded lev counts one edit', lev('wtlas', 'atlas', 2), 1);
eq('bounded lev bails out over budget', lev('atlas', 'completely different', 2) > 2, true);

const rec = (titleMain, sub, author, year, biomed) => ({
  title: sub ? `${titleMain} : ${sub}` : titleMain,
  titleMain, author: author || '', year: year || null, hasBiomed: !!biomed, holdings: [],
});

// The reported bug: a search for the literal title must put the literal title first.
const atlas = [
  rec('The art of fiction', 'a guide for writers and readers', 'Rand, Ayn.', 2000),
  rec('Atlas shrugged', '', 'Rand, Ayn', 1957),
  rec('Atlas shrugged', 'manifesto of the mind', 'Gladstein, Mimi Reisel.', 2000),
  rec('Atlas Shrugged: Part 1.', '', '', 2011),
  rec("Ayn Rand's Atlas shrugged", 'a philosophical and literary companion', '', 2007),
  rec('Coordinates', 'placing science fiction and fantasy', '', 1983),
];
const rankBy = (list, q) =>
  list.map(r => ({ t: r.title, s: scoreRecord(r, q) })).sort((a, b) => b.s - a.s).map(x => x.t);

eq('exact title wins', rankBy(atlas, 'atlas shrugged')[0], 'Atlas shrugged');
ok('a subtitled near-namesake ranks below the plain title',
   scoreRecord(atlas[1], 'atlas shrugged') > scoreRecord(atlas[2], 'atlas shrugged'));
ok('an unrelated book by the same author scores near nothing',
   scoreRecord(atlas[0], 'atlas shrugged') < 20,
   `scored ${scoreRecord(atlas[0], 'atlas shrugged').toFixed(1)}`);

// Spelling tolerance — the whole point of the fuzzy pass.
eq('a one-letter typo still ranks the right book first', rankBy(atlas, 'wtlas shrugged')[0], 'Atlas shrugged');
eq('a typo in the second word too', rankBy(atlas, 'atlas shrugd')[0], 'Atlas shrugged');
eq('author-only search finds the author', rankBy(atlas, 'ayn rand')[0].includes('Rand') || rankBy(atlas, 'ayn rand')[0].includes('Atlas'), true);
ok('three-letter words get no typo slack', coverage(['cat'], ['bat']) === 0);
ok('longer words do get slack', coverage(['medicne'], ['medicine']) > 0);
ok('prefixes count', coverage(['medic'], ['medicine']) > 0);

// Biomed is a tiebreak, not an override: it must not beat a materially better title match.
const biomedNoise = rec('Atlas of human anatomy', '', '', 2020, true);
const exactPlain = rec('Atlas shrugged', '', 'Rand, Ayn', 1957);
ok('a Biomed copy does not outrank a much better title match',
   scoreRecord(exactPlain, 'atlas shrugged') > scoreRecord(biomedNoise, 'atlas shrugged'));
ok('but it does break a tie between equals',
   scoreRecord(rec('Internal medicine', '', '', 2020, true), 'internal medicine') >
   scoreRecord(rec('Internal medicine', '', '', 2020, false), 'internal medicine'));

// "Default to the newest edition" — identical titles score identically, so year decides.
const editions = [
  rec("Harrison's principles of internal medicine", '', '', 1998),
  rec("Harrison's principles of internal medicine", '', '', 2018),
  rec("Harrison's principles of internal medicine", '', '', 2015),
];
const q = "harrison's principles of internal medicine";
ok('every printing scores the same', new Set(editions.map(r => scoreRecord(r, q))).size === 1);

// Regression: older printings carry a MARC 100 for Tinsley Harrison and the 2018 edition does
// not. An author bonus for "harrison" — a word already in the title — used to give those five
// printings a lead the newest edition could never make up, burying it in sixth place.
const withAuthor = rec("Harrison's principles of internal medicine", '', 'Harrison, Tinsley Randolph, 1900-1978', 1980);
const noAuthor   = rec("Harrison's principles of internal medicine", '', '', 2018);
eq('a 100 field does not outrank an identical title without one',
   scoreRecord(withAuthor, q), scoreRecord(noAuthor, q));
// ...but an author word the title does not contain still counts.
const byRand   = rec('Atlas shrugged', '', 'Rand, Ayn', 1957);
const aboutIt  = rec('Atlas shrugged', '', 'Gladstein, Mimi Reisel', 2000);
ok('an author word absent from the title still earns credit',
   scoreRecord(byRand, 'atlas shrugged rand') > scoreRecord(aboutIt, 'atlas shrugged rand'));
eq('so the year tiebreak surfaces the newest',
   editions.map((r, i) => ({ r, i, s: scoreRecord(r, q), y: r.year }))
     .sort((a, b) => (b.s - a.s) || (b.y - a.y) || (a.i - b.i)).map(o => o.r.year),
   [2018, 2015, 1998]);

// Query relaxation: drop a word at a time, longest remaining query first.
const rx = relaxations('wtlas shrugged');
ok('relaxation drops a word', rx.length > 0);
ok('relaxation offers the surviving word', rx.indexOf('shrugged') >= 0, JSON.stringify(rx));
eq('a single word has nothing to relax to', relaxations('shrugged'), []);

/* ================= 8. Advanced query parsing ================= */
// One box, two languages: `field:value` tokens and everything else. A token that is
// misunderstood must end up as search text with a complaint attached, never be dropped —
// a filter that vanishes silently changes the answer without saying so.
section('query parsing');

eq('a bare word is free text', parseQuery('cardiology').text, 'cardiology');
eq('a token is not free text', parseQuery('mesh:neoplasms').text, '');
eq('a quoted value survives its spaces',
   parseQuery('series:"current clinical strategies"').pos, ['alma.series="current clinical strategies"']);
eq('free text and tokens coexist', parseQuery('atlas year:2015+ anatomy').text, 'atlas anatomy');
eq('a hyphenated word is not a negation', parseQuery('x-ray').text, 'x-ray');
eq('a leading dash negates', parseQuery('-lang:eng').neg, ['alma.language="eng"']);
eq('language names map to MARC codes', parseQuery('lang:spanish').pos, ['alma.language="spa"']);
eq('an unlisted language code passes through', parseQuery('lang:tur').pos, ['alma.language="tur"']);
eq('ISBN punctuation is stripped', parseQuery('isbn:978-0-07-180215-4').pos, ['alma.isbn="9780071802154"']);
eq('aliases resolve', parseQuery('au:longo').pos, ['alma.creator="longo"']);
eq('an unknown field becomes text, loudly', parseQuery('wibble:x').text, 'wibble:x');
ok('…and says so', parseQuery('wibble:x').errors.length === 1, JSON.stringify(parseQuery('wibble:x').errors));
ok('a bad year is reported, not guessed', parseQuery('year:soon').errors.length === 1);
eq('a bad year adds no clause', parseQuery('year:soon').pos, []);
ok('every filter applied is described in words', parseQuery('mesh:neoplasms year:2015+').notes.length === 2);

// Year expressions. `alma.main_pub_date` supports >, >=, <, <= — probed — so a range is two
// clauses rather than a string comparison.
eq('a plain year', yearClauses('2020'), ['alma.main_pub_date=2020']);
eq('an explicit operator', yearClauses('>=2015'), ['alma.main_pub_date>=2015']);
eq('a dashed range', yearClauses('2010-2020'), ['alma.main_pub_date>=2010', 'alma.main_pub_date<=2020']);
eq('a dotted range', yearClauses('2010..2020'), ['alma.main_pub_date>=2010', 'alma.main_pub_date<=2020']);
eq('an open-ended range', yearClauses('2015+'), ['alma.main_pub_date>=2015']);
eq('a leading-dots range', yearClauses('..1990'), ['alma.main_pub_date<=1990']);
eq('a decade', yearClauses('1990s'), ['alma.main_pub_date>=1990', 'alma.main_pub_date<=1999']);
eq('after: forces the operator', yearClauses('2015', '>'), ['alma.main_pub_date>2015']);
eq('nonsense yields nothing', yearClauses('recent'), null);

// type: is the only working format filter — alma.mms_resource_type answers every query with
// zero, so leader/06 and leader/07 do the work instead.
eq('type:book is leader 06 + 07', parseQuery('type:book').pos,
   ['alma.type_of_record=a', 'alma.bib_level=m']);
eq('type:journal is bibliographic level s', parseQuery('type:journal').pos, ['alma.bib_level=s']);
eq('type:audio needs an OR group and brings its own parens', parseQuery('type:audio').pos,
   ['(alma.type_of_record=i or alma.type_of_record=j)']);
ok('an unknown type is refused', parseQuery('type:hologram').errors.length === 1);

eq('at: sets the scope', parseQuery('at:stacks').scope, 'stacks');
eq('scope aliases resolve', parseQuery('in:reference').scope, 'ref');
eq('sort: sets the sort', parseQuery('sort:shelf').sort, 'shelf');
ok('an unknown scope is refused', parseQuery('at:mars').errors.length === 1);

// Client-side predicates never become CQL — the endpoint knows nothing about the shelf map.
eq('shelf: is local, not a clause', parseQuery('shelf:yes').pos, []);
eq('shelf:yes reads as true', parseQuery('shelf:yes').local.shelf, true);
eq('-shelf:yes inverts', parseQuery('-shelf:yes').local.shelf, false);
eq('level: collects levels', parseQuery('level:8,10').local.levels, [8, 10]);
eq('editions:all turns grouping off', parseQuery('editions:all').local.groupEditions, false);

/* ================= 9. CQL assembly — the endpoint's three unwritten rules ============== */
// All three were probed live. Rule 2 is the dangerous one: the failure is not an error, it
// is zero records, which reads at the desk as "the library does not have it".
section('CQL assembly');

const P = s => parseQuery(s);
const Q = (s, mode, scope, sort) => buildCQL(P(s), mode || 'keyword', scope || 'ucla', sort || 'best');

eq('a single clause is never parenthesised', orGroup(['alma.language=eng']), 'alma.language=eng');
eq('two clauses are', orGroup(['a=1', 'b=2']), '(a=1 or b=2)');

const kw = Q('cardiology');
ok('the keyword clause leads', kw.indexOf('alma.all_for_ui all "cardiology"') === 0, kw);
ok('and is not wrapped in parentheses', kw.indexOf('(alma.all_for_ui') < 0, kw);
ok('the sort clause is appended', / sortBy alma\.main_pub_date\/descending$/.test(kw), kw);

const scoped = Q('cardiology', 'keyword', 'stacks');
ok('a multi-code scope is one OR group',
   scoped.indexOf('(alma.permanentPhysicalLocation=bi or alma.permanentPhysicalLocation=biper or ' +
                  'alma.permanentPhysicalLocation=biprwt or alma.permanentPhysicalLocation=bian)') > 0, scoped);
ok('the keyword clause still leads under a scope',
   scoped.indexOf('alma.all_for_ui all "cardiology"') === 0, scoped);
const oneCode = Q('cardiology', 'keyword', 'ref');
ok('a single-code scope is bare', oneCode.indexOf('(alma.permanentPhysicalLocation=birf)') < 0, oneCode);
ok('…and still present', oneCode.indexOf('alma.permanentPhysicalLocation=birf') > 0, oneCode);
eq('an unscoped search adds no location clause',
   Q('cardiology').indexOf('permanentPhysicalLocation'), -1);

ok('negation is appended with not', / not alma\.language="eng"/.test(Q('cardiology -lang:eng')),
   Q('cardiology -lang:eng'));
ok('a not clause comes after every and clause',
   Q('cardiology -lang:eng year:2015+').indexOf(' not ') >
   Q('cardiology -lang:eng year:2015+').indexOf('alma.main_pub_date>=2015'));

// Mode pills choose the index the free text lands in; a phrase index is quoted with =,
// only alma.all_for_ui takes the `all` relation (quoting all_for_ui returns nothing).
ok('title mode uses the title index', Q('atlas shrugged', 'title').indexOf('alma.title="atlas shrugged"') === 0);
ok('author mode uses alma.creator, not alma.author (which does not exist)',
   Q('longo', 'author').indexOf('alma.creator="longo"') === 0);
ok('ISBN mode strips punctuation', Q('978-0-07-180215-4', 'isbn').indexOf('alma.isbn="9780071802154"') === 0);
eq('a query with nothing in it builds nothing', buildCQL(P(''), 'keyword', 'biomed', 'best'), '');
ok('a filter alone is still a query', Q('mesh:neoplasms').length > 0);
ok('quotes in a value cannot break out of the phrase',
   Q('title:"say \\"what\\""', 'keyword').indexOf('\\') < 0, Q('title:"say \\"what\\""'));

// Only three indexes are sortable; anything else is rejected by the endpoint outright.
ok('sort:title asks the server for a title sort', / sortBy alma\.title\/ascending$/.test(Q('x', 'keyword', 'ucla', 'title')));
ok('sort:oldest reverses the date sort', / sortBy alma\.main_pub_date\/ascending$/.test(Q('x', 'keyword', 'ucla', 'oldest')));
ok('sort:shelf still asks for newest — shelf order is computed here',
   / sortBy alma\.main_pub_date\/descending$/.test(Q('x', 'keyword', 'ucla', 'shelf')));

// Trailing truncation is not a feature this code adds — it is one the endpoint has and the
// builder must not destroy. `*` has to survive into the CQL untouched; `"` and `\` must not.
ok('a trailing star reaches the endpoint', Q('cardio*').indexOf('alma.all_for_ui all "cardio*"') === 0, Q('cardio*'));
ok('a star inside a phrase field survives too', Q('title:"cardio*"').indexOf('alma.title="cardio*"') === 0);

/* ================= 10. Ranking additions ================= */
section('ranking: idf, adjacency, residual fields');

// Without a context every word weighs the same. With one, a word in almost every title in
// the pool weighs almost nothing — which is the difference between "medicine" and
// "harrisons" deciding a search in a medical library.
const pool = [];
for (let i = 0; i < 40; i++) pool.push({ title: `Internal medicine volume ${i}`, author: '' });
pool.push({ title: "Harrison's principles of internal medicine", author: '' });
const idf = idfContext(pool);
ok('a ubiquitous word is worth less than a rare one', idf.weight('medicine') < idf.weight('harrisons'),
   `medicine ${idf.weight('medicine').toFixed(3)} vs harrisons ${idf.weight('harrisons').toFixed(3)}`);
eq('an empty pool has no context', idfContext([]), null);

const common = { title: 'Internal medicine volume 3', titleMain: 'Internal medicine volume 3', author: '', holdings: [] };
const rare = { title: "Harrison's internal medicine", titleMain: "Harrison's internal medicine", author: '', holdings: [] };
ok('the record carrying the rare query word wins once idf is applied',
   scoreRecord(rare, 'harrisons medicine', idf) > scoreRecord(common, 'harrisons medicine', idf));

eq('adjacency is nothing for a single word', runBonus(['medicine'], ['internal', 'medicine']), 0);
eq('a fully contiguous run is worth everything', runBonus(['internal', 'medicine'], ['of', 'internal', 'medicine']), 1);
eq('a broken run is worth nothing', runBonus(['internal', 'medicine'], ['internal', 'and', 'medicine']), 0);
const contiguous = { title: 'Principles of internal medicine today', titleMain: 'Principles of internal medicine today', author: '', holdings: [] };
const scattered  = { title: 'Internal notes on the principles of medicine', titleMain: 'Internal notes on the principles of medicine', author: '', holdings: [] };
ok('word order counts for something',
   scoreRecord(contiguous, 'principles of internal medicine') > scoreRecord(scattered, 'principles of internal medicine'));

// The residual rule generalised: series, subject and publisher earn credit only for words
// the title did not already explain, exactly as the author field does.
const inSeries = { title: 'Cardiology', titleMain: 'Cardiology', author: '', series: 'Lange medical books', holdings: [] };
const noSeries = { title: 'Cardiology', titleMain: 'Cardiology', author: '', series: '', holdings: [] };
ok('a series word absent from the title still counts',
   scoreRecord(inSeries, 'cardiology lange') > scoreRecord(noSeries, 'cardiology lange'));
eq('a series cannot reorder identical titles when the query is fully explained',
   scoreRecord(inSeries, 'cardiology'), scoreRecord(noSeries, 'cardiology'));

// The length penalty saturates instead of stopping dead at a flat cap.
const short = { title: 'Anatomy ' + 'x '.repeat(4), titleMain: 'Anatomy', author: '', holdings: [] };
const long  = { title: 'Anatomy ' + 'x '.repeat(40), titleMain: 'Anatomy', author: '', holdings: [] };
ok('a longer title is penalised more', scoreRecord(short, 'anatomy') > scoreRecord(long, 'anatomy'));
ok('but never unboundedly', scoreRecord(long, 'anatomy') > scoreRecord(short, 'anatomy') - 26);

// A copy that resolved to a real shelf face beats one that only exists at Biomed on paper.
const shelved   = { title: 'Anatomy', titleMain: 'Anatomy', author: '', holdings: [], hasBiomed: true, hasShelf: true };
const unshelved = { title: 'Anatomy', titleMain: 'Anatomy', author: '', holdings: [], hasBiomed: true, hasShelf: false };
ok('a walkable copy edges ahead', scoreRecord(shelved, 'anatomy') > scoreRecord(unshelved, 'anatomy'));

/* ================= 11. Edition clustering ================= */
// SRU has no FRBR group; a Harrison's search is 33 separate MMS IDs. Clustering on the full
// 245 ($a + $b) keeps the printings of one book together while leaving the companion
// handbook and the self-assessment as the different books they are.
section('edition clustering');

const ed = (title, year, mms) => ({
  title, titleMain: title.split(' : ')[0], author: '', year, mms: mms || String(year),
  holdings: [], online: [], isbns: [],
});
const harrisons = [
  ed("Harrison's principles of internal medicine", 1998),
  ed("Harrison's principles of internal medicine", 2025),
  ed("Harrison's principles of internal medicine", 2015),
  ed("Harrison's principles of internal medicine : companion handbook", 1995),
  ed("Harrison's principles of internal medicine : self-assessment and board review", 2001),
];
const clusters = clusterRecords(harrisons, "harrison's principles of internal medicine", null);
eq('printings of one book collapse to one cluster; different subtitles do not', clusters.length, 3);
const main = clusters.find(c => clusterKey(c.head) === 'harrisons principles of internal medicine');
eq('the newest printing leads its cluster', main.head.year, 2025);
eq('the rest are kept, not discarded', main.rest.map(r => r.year).sort(), [1998, 2015]);
eq('the companion handbook is its own cluster',
   clusters.filter(c => /companion/.test(c.key)).length, 1);

// A printing with no date must never displace one that has a date: "no date" is not
// evidence of being current.
const undated = clusterRecords([ed('Physiology', null, 'a'), ed('Physiology', 2001, 'b')], 'physiology', null);
eq('an undated printing does not lead', undated[0].head.year, 2001);

// Clustering must not change which book wins — only how many rows it takes to say so.
const mixed = [ed('Cardiology', 1990), ed('Cardiology', 2020), ed('Anatomy', 2024)];
eq('best-match order puts the queried title first',
   sortClusters(clusterRecords(mixed, 'cardiology', null), 'best')[0].head.title, 'Cardiology');
eq('…and picks its newest printing',
   sortClusters(clusterRecords(mixed, 'cardiology', null), 'best')[0].head.year, 2020);
eq('newest order ignores the query',
   sortClusters(clusterRecords(mixed, 'cardiology', null), 'newest')[0].head.title, 'Anatomy');
eq('oldest order reverses it',
   sortClusters(clusterRecords(mixed, 'cardiology', null), 'oldest')[0].head.year, 1990);
eq('title order is alphabetical',
   sortClusters(clusterRecords(mixed, 'cardiology', null), 'title')[0].head.title, 'Anatomy');

eq('recordYear prefers the bib year', recordYear({ year: 2018, holdings: [] }), 2018);
eq('…and falls back to the newest year on a spine', recordYear({
  year: null,
  holdings: [{ parts: splitCallNumber('WB 115 H248p 1998') }, { parts: splitCallNumber('WB 115 H322 2015') }],
}), 2015);
eq('…and gives up honestly', recordYear({ year: null, holdings: [] }), null);

/* ================= 12. Client-side predicates and shelf order ================= */
// These are facts about the shelf map, which the catalog knows nothing about, so they are
// applied here and the UI says how many records they removed.
section('local filters / shelf order');

const holdOf = (b, j, d) => resolve({ b, j, d });
const withShelf = { holdings: [holdOf('BIOMED', 'bi', 'WB 115 H248p 1998')], online: [] };
const noShelf   = { holdings: [holdOf('SRLF', 'sr', 'RC46 .H32 1974')], online: [] };
ok('the fixture row really does resolve', withShelf.holdings[0].hits.length > 0);

eq('shelf:yes keeps a shelved record', passesLocal(withShelf, { shelf: true }), true);
eq('shelf:yes drops an unshelved one', passesLocal(noShelf, { shelf: true }), false);
eq('shelf:no is the complement', passesLocal(noShelf, { shelf: false }), true);
eq('no filter keeps everything', passesLocal(noShelf, {}), true);
eq('level: matches the resolved level',
   passesLocal(withShelf, { levels: [withShelf.holdings[0].hits[0].lvl] }), true);
eq('level: drops the wrong level', passesLocal(withShelf, { levels: [99] }), false);
eq('online:yes needs an AVE', passesLocal({ holdings: [], online: [{ m: 'x' }] }, { online: true }), true);
eq('online:no excludes it', passesLocal({ holdings: [], online: [{ m: 'x' }] }, { online: false }), false);
eq('avail:yes reads AVA $e',
   passesLocal({ holdings: [resolve({ b: 'BIOMED', j: 'bi', d: 'WB 115 H248p 1998', e: 'available' })], online: [] },
               { avail: true }), true);
eq('avail:yes drops a checked-out copy',
   passesLocal({ holdings: [resolve({ b: 'BIOMED', j: 'bi', d: 'WB 115 H248p 1998', e: 'unavailable' })], online: [] },
               { avail: true }), false);

// Shelf order is a real walk: lower level first, then the call-number comparator — the same
// one the locator uses, decimal Cutters and all.
const lowCn  = { holdings: [holdOf('BIOMED', 'bi', 'WB 115 H248p 1998')], online: [] };
const highCn = { holdings: [holdOf('BIOMED', 'bi', 'WB 115 H322 2015')], online: [] };
ok('both ends of the pair are shelved', lowCn.holdings[0].hits.length && highCn.holdings[0].hits.length);
ok('H248p walks before H322 (0.248 < 0.322)', cmpShelf(lowCn, highCn) < 0);
ok('a record with no shelf sorts last', cmpShelf(noShelf, lowCn) > 0);
eq('two unshelved records tie', cmpShelf(noShelf, { holdings: [], online: [] }), 0);

// The one automatic mode switch: a bare ISBN typed into the keyword box.
eq('a 13-digit ISBN switches mode', detectMode('9780071802154', 'kw'), 'isbn');
eq('a hyphenated ISBN too', detectMode('978-0-07-180215-4', 'kw'), 'isbn');
eq('a title does not', detectMode('atlas shrugged', 'kw'), null);
eq('a 9-digit number does not', detectMode('123456789', 'kw'), null);
eq('author mode is left alone', detectMode('9780071802154', 'author'), null);

/* ================= 13. Carrier: a recording is not a newer edition of a book =========== */
// UCLA's "newest edition" of Atlas Shrugged is a 2022 Blackstone Audio recording whose record
// says text in every field designed to say otherwise. This is that record, field for field.
section('carrier detection');

const overdriveAudiobook = {
  ldr06: 'a', f007: [], term338: '', term336: '', gmd: '', phys: '',
  edition: 'Unabridged.', publisher: 'Blackstone Audio, Inc., and Buck 50 Productions, LLC',
  hasAVA: true, hasAVE: false,
};
eq('the Atlas Shrugged audiobook is detected despite a text leader',
   carrierOf(overdriveAudiobook), 'audio');
eq('...and it says so in words', carrierLabel('audio'), 'Audiobook');

// Both halves of that bottom rung are required, because either alone is ordinary.
eq('"Unabridged" alone is a print edition statement',
   carrierOf({ ldr06: 'a', edition: 'Unabridged.', publisher: 'Penguin Books' }), 'print');
eq('an audio-sounding publisher alone proves nothing',
   carrierOf({ ldr06: 'a', edition: '2nd ed.', publisher: 'Sound Medicine Press' }), 'print');

// 007/00 outranks everything, then the leader, then 33x/GMD/300.
eq('007 s is a sound recording', carrierOf({ ldr06: 'a', f007: ['sd fsngnnmmned'] }), 'audio');
eq('007 s with a music leader is music', carrierOf({ ldr06: 'j', f007: ['sd '] }), 'music');
eq('007 v is video', carrierOf({ ldr06: 'a', f007: ['vd cvaizq'] }), 'video');
eq('007 h is microform', carrierOf({ ldr06: 'a', f007: ['he bmb024bkak'] }), 'microform');
eq('the streaming films are video off the leader',
   carrierOf({ ldr06: 'g', f007: ['cr', 'vz'], term336: 'two-dimensional moving image' }), 'video');
eq('leader i is an audiobook', carrierOf({ ldr06: 'i' }), 'audio');
eq('leader e is a map', carrierOf({ ldr06: 'e' }), 'map');
eq('leader c is a score', carrierOf({ ldr06: 'c' }), 'score');
eq('a 338 term is read when the leader is silent',
   carrierOf({ ldr06: 'a', term338: 'audio disc' }), 'audio');
eq('so is a GMD', carrierOf({ ldr06: 'a', gmd: '[sound recording]' }), 'audio');
eq('so is a 300', carrierOf({ ldr06: 'a', phys: '1 sound cassette' }), 'audio');
eq('microfilm in the 300', carrierOf({ ldr06: 'a', phys: '1 microfilm reel' }), 'microform');
// The regression this rewrite exists for: Harrison's 19th edition is a two-volume printed
// book with a DVD-ROM in the pocket. Its second 007 describes the disc, not the book.
eq('a book with a DVD-ROM in the pocket is still a book',
   carrierOf({ ldr06: 'a', f007: ['ta', 'vf cbahos'], term336: 'text', term337: 'unmediated',
               term338: 'volume', phys: '2 volumes (various pagings)', hasAVA: true }), 'print');
eq('...and DVD-ROM in a phrase does not read as a film',
   carrierOf({ ldr06: 'a', phys: '1 DVD-ROM', hasAVA: true }), 'print');
eq('a real DVD still does', carrierOf({ ldr06: 'a', phys: '1 DVD (120 min.)' }), 'video');
eq('007 t says regular print outright',
   carrierOf({ ldr06: 'a', f007: ['ta'], phys: '1 sound disc' }), 'print');
eq('RDA text-in-a-volume settles it',
   carrierOf({ ldr06: 'a', term336: 'text', term338: 'volume', phys: 'ill. + 1 videodisc' }), 'print');
eq('an ordinary book is print',
   carrierOf({ ldr06: 'a', term336: 'text', term338: 'volume', phys: 'xxi, 2020 pages', hasAVA: true }), 'print');
eq('AVE with no AVA is online only', carrierOf({ ldr06: 'a', hasAVA: false, hasAVE: true }), 'online');
eq('nothing at all falls through to print', carrierOf({}), 'print');

// The point of all of it: the recording must not lead the novel's cluster.
const novel = { title: 'Atlas shrugged', titleMain: 'Atlas shrugged', author: 'Rand, Ayn',
                year: 1957, carrier: 'print', mms: 'p', holdings: [], online: [] };
const recording = { title: 'Atlas shrugged', titleMain: 'Atlas shrugged', author: 'Rand, Ayn',
                    year: 2022, carrier: 'audio', mms: 'a', holdings: [], online: [] };
ok('the recording clusters separately from the book',
   clusterKey(novel) !== clusterKey(recording), clusterKey(recording));
const both = clusterRecords([recording, novel], 'atlas shrugged', null);
eq('two clusters, not one', both.length, 2);
eq('the book is what a search for the book returns first',
   sortClusters(both, 'best')[0].head.carrier, 'print');
ok('a 2022 recording does not outrank a 1957 novel on the year tiebreak',
   scoreRecord(novel, 'atlas shrugged') > scoreRecord(recording, 'atlas shrugged'));
eq('but under an explicit carrier filter the preference is uniform and harmless',
   passesLocal(recording, { carrier: ['audio'] }), true);
eq('carrier:print excludes the recording', passesLocal(recording, { carrier: ['print'] }), false);
eq('-carrier:audio does too', passesLocal(recording, { carrierNot: ['audio'] }), false);
eq('a record with no carrier counts as print', passesLocal({ holdings: [] }, { carrier: ['print'] }), true);

eq('carrier: parses to a local filter, never to CQL', parseQuery('carrier:audio').pos, []);
eq('carrier: aliases resolve', parseQuery('is:audiobook').local.carrier, ['audio']);
eq('several at once', parseQuery('carrier:print,audio').local.carrier, ['print', 'audio']);
ok('an unknown carrier is refused', parseQuery('carrier:papyrus').errors.length === 1);

// A resource-sharing row is a request placeholder, not a copy in a building.
eq('RES_SHARE is not routed to a library',
   resolve({ b: 'RES_SHARE', j: 'OUT_RS_REQ', d: '' }).route.kind, 'phantom');
eq('RES_SHARE never gets a shelf', resolve({ b: 'RES_SHARE', j: 'OUT_RS_REQ', d: 'WB 115 H322 2018' }).hits.length, 0);
ok('and says what it actually is',
   /request placeholder/.test(resolve({ b: 'RES_SHARE', j: 'OUT_RS_REQ', d: '' }).route.note));

/* ---- report ---- */
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(f => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
