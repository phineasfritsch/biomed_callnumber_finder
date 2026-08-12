// Shelf order and misfile verdicts, offline.
//
//   node ios/Tools/shelforder.test.js [biomed-shelf-ranges.json]
//
// The pipeline under test is ios/Tools/shelforder.js, which mirrors Models/ShelfOrder.swift.
//
// The highest-stakes failure in shelf reading is not a missed misfile — it is a **false** one,
// because it sends a librarian to reshelve a book that was already in the right place, and after
// that happens twice nobody trusts a red box again. So the last section here is not a handful of
// examples: it is ten thousand rows built out of the real dataset, all of them correctly ordered,
// asserting that nothing is flagged. That is the only place a false-positive rate can be measured
// before a device exists.

'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./shelforder.js');
const R = require('./recognizer.js');

const rangesPath = process.argv[2] || path.join(__dirname, '..', '..', 'biomed-shelf-ranges.json');
const DATA = JSON.parse(fs.readFileSync(rangesPath, 'utf8'));

let pass = 0, fail = 0;
const section = (s) => console.log(`\n${s}`);
function ok(cond, label, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log('  FAIL ' + label + (detail ? '\n       ' + detail : ''));
}

const K = (s) => S.parseKey(s);
const cmp = (a, b) => S.cmpKey(K(a), K(b));
const spine = (cn, extra) => Object.assign({ cn }, extra || {});
const verdicts = (rows, opts) => S.judge(rows, opts).map(v => v.verdict);

/* ── 1. the bug this module exists for ──────────────────────────────────── */

section('volumes order as integers, in all three spellings a label can produce');

// Every one of these is wrong under CallNumber.compare. The first three are the measured
// regressions; the rest cover the spellings OCR actually returns for the same physical label.
const PAIRS = [
  ['W1 NA388 NO.9', 'W1 NA388 NO.10', -1],
  ['W1 NA388 NO.2', 'W1 NA388 NO.11', -1],
  ['W1 NA388 NO.66', 'W1 NA388 NO.7', 1],
  ['W1 NA388 V.9', 'W1 NA388 V.10', -1],
  ['W1 NA388 PT.9', 'W1 NA388 PT.10', -1],
  ['W1 NA388 NO.65', 'W1 NA388 NO.66', -1],
  ['W1 NA388 NO66', 'W1 NA388 NO.7', 1],       // OCR dropped the dot
  ['W1 NA388 NO 66', 'W1 NA388 NO.7', 1],      // OCR split the token
  ['W1 NA388 no.66', 'W1 NA388 NO66', 0],      // …and all three are the same book
  ['W1 NA388', 'W1 NA388 NO.66', -1],          // a missing trailer sorts first
  ['W4C Z89P 2009', 'W4C Z89P 2010', -1],
  ['W1 NA388 NO.66 1984', 'W1 NA388 NO.66 1985', -1],
];
for (const [a, b, want] of PAIRS) {
  ok(cmp(a, b) === want, `${a} vs ${b}`, `got ${cmp(a, b)}, want ${want}`);
}

// The base comparator still has to work, or the trailer fix bought nothing.
ok(cmp('W1 NA388', 'W1 NA1991') === 1, 'decimal cutters still sort as decimals');
// .477 > .4733 — a longer digit run is a SMALLER decimal, which is the trap in Cutter notation
// and the reason CallNumber parses these as `Double("0." + digits)` rather than as integers.
ok(cmp('W1 AM477', 'W1 AM4733') === 1, 'a longer cutter digit run is still the smaller decimal');

section('trailers are stripped without eating the base');

ok(K('W1 NA388').trailers.length === 0, 'a bare call number has no trailers');
ok(K('W1 NA388').base === 'W1 NA388', 'and keeps its whole base');
ok(K('W1 NA388 no.66 1984').trailers.length === 2, 'volume and year are both trailers');
ok(K('W1 NA388 no.66 1984').base === 'W1 NA388', 'and neither is left in the base');
ok(K('WM 13 D5537 1984').base === 'WM 13 D5537', 'an NLM class number survives year stripping');
ok(K('W 2000').base === 'W 2000', 'a two-token NLM call number keeps its class number',
  'the >2 floor is what stops "2000" being read as a year');
ok(K('W4C Z89P 2009').base === 'W4C Z89P', 'the one real endpoint with a trailer splits correctly');

/* ── 2. which book moved ────────────────────────────────────────────────── */

section('the subsequence blames one book, not two');

const row = (...cns) => cns.map(cn => spine(cn));
const A = 'W1 AA100', B = 'W1 BB100', C = 'W1 CC100', D = 'W1 DD100', E = 'W1 EE100', F = 'W1 FF100';

ok([...S.longestNonDecreasing([A, B, F, D, E].map(K))].sort().join() === '0,1,3,4',
  'A B F D E keeps A B D E');

// The mis-blame this whole approach exists to avoid: pairwise comparison flags (F, D), which
// accuses D exactly as loudly as F.
ok(verdicts(row(A, B, F, D, E)).join() === 'ok,ok,outOfOrder,ok,ok',
  'A B F D E flags only F', JSON.stringify(verdicts(row(A, B, F, D, E))));

// And the case a naive "disagrees with both neighbours" rule misses entirely.
ok(verdicts(row(A, F, B)).join() === 'ok,outOfOrder,ok',
  'A F B flags only F', JSON.stringify(verdicts(row(A, F, B))));

ok(verdicts(row(A, B, C, D)).every(v => v === 'ok'),
  'a correctly ordered row flags nothing');
ok(verdicts(row(A, A, B, B)).every(v => v === 'ok'),
  'duplicate copies side by side are not a misfile',
  'the subsequence is non-DEcreasing for exactly this reason');

section('the guards that stop a false accusation');

ok(verdicts(row(F, A)).every(v => v === 'ok'),
  'two books never accuse each other', 'neither one can be shown to be the one that moved');
ok(verdicts(row(F, A, B)).join() === 'ok,ok,ok',
  'the first readable book is never flagged', 'its true neighbour is off-frame');
ok(verdicts(row(A, B, F)).join() === 'ok,ok,ok',
  'nor is the last');
ok(verdicts([spine(A), spine(B), spine(F, { edge: true }), spine(D), spine(E)])
  .join() === 'ok,ok,ok,ok,ok',
  'a column at the frame edge is never flagged', 'it is physically half-cropped');

ok(verdicts([spine(A), spine(B), spine(F, { anchored: false }), spine(D), spine(E)])
  .join() === 'ok,ok,unanchored,ok,ok',
  'an unanchored read is shown but never judged',
  'no verdict without knowing which physical book it belongs to');

ok(verdicts([spine(A), spine(null), spine(B), spine(null), spine(C)])
  .join() === 'ok,unknown,ok,unknown,ok',
  'an unreadable spine is excluded, not guessed at, and does not break the run');
ok(verdicts([spine(A), spine('NOT A CALL NUMBER'), spine(B), spine(C)])
  .join() === 'ok,unknown,ok,ok',
  'so is a read that fails the grammar');

ok(verdicts(row(A, B, 'WM 13 D5537', C, D)).join() === 'ok,ok,unknown,ok,ok',
  'a lone NLM book on a W1 shelf is excluded, not accused',
  'cross-scheme comparison is meaningless — Router gates on it too');

/* ── 3. volume breaks say something different ───────────────────────────── */

section('a volume out of sequence is its own verdict');

const v = (n) => `W1 NA388 no.${n}`;
ok(verdicts(row(v(1), v(2), v(9), v(3), v(4))).join() === 'ok,ok,volumeBreak,ok,ok',
  'a serial run with one volume out of place reports volumeBreak',
  JSON.stringify(verdicts(row(v(1), v(2), v(9), v(3), v(4)))));
ok(verdicts(row(A, B, F, D, E)).join().includes('outOfOrder'),
  'a different title in the wrong place is still outOfOrder',
  'the book is on the right face in the wrong slot vs carry it away — different action');
ok(verdicts(row(v(1), v(2), v(3), v(4), v(5))).every(x => x === 'ok'),
  'an intact serial run flags nothing');
ok(verdicts(row(v(1), v(2), v(10), v(11), v(12))).every(x => x === 'ok'),
  'no.10 after no.2 is correct, and this is the pair the shipping comparator gets wrong');

/* ── 4. wrong shelf ─────────────────────────────────────────────────────── */

section('wrong shelf, which needs no ordering at all');

function searchAll(cn) {
  const qs = R.scheme(cn), hits = [];
  for (const key in DATA) {
    const d = DATA[key];
    if (!d.start || !d.end) continue;
    if (key.startsWith('9|')) continue;                  // Special Collections, as Router.search does
    if (R.scheme(d.start) !== qs) continue;
    if (R.cmpCN(cn, d.start) >= 0 && R.cmpCN(cn, d.end) <= 0) {
      const [lvl, id, side] = key.split('|');
      hits.push({ key, lvl: +lvl, id, side });
    }
  }
  hits.sort((a, b) => (a.lvl !== b.lvl ? a.lvl - b.lvl : (a.key < b.key ? -1 : 1)));
  return hits.map(({ lvl, id, side }) => ({ lvl, id, side }));
}

const sample = 'W1 NA388 no.66 1984';
const sampleFaces = searchAll(sample);
ok(sampleFaces.length > 0, 'the sample book locates at all', JSON.stringify(sampleFaces));

const elsewhere = { lvl: 11, id: 'bot-1', side: 'a' };
ok(S.judge([spine(sample)], { expected: sampleFaces[0], search: searchAll })[0].verdict === 'ok',
  'a book on its own face is fine');
ok(S.judge([spine(sample)], { expected: elsewhere, search: searchAll })[0].verdict === 'wrongShelf',
  'a book on someone else\'s face is wrongShelf');
// Stubbed rather than probed, because shelf ranges are broad intervals and nearly any string
// falls inside SOME range — `W1 ZZZ999` "locates" happily, which is the whole point of
// CallNumber.isWellFormed existing separately from Router.locate. The guard under test is what
// happens when the lookup genuinely comes back empty.
ok(S.judge([spine(sample)], { expected: elsewhere, search: () => [] })[0].verdict === 'ok',
  'a call number no face contains is never wrongShelf',
  'Reference and unmapped stacks exist and this app does not know about them');

// The reason this uses `search` and not `locate`: a serial legitimately spans several faces, and
// 237 of 651 endpoints sit on a seam contained by two. Judging against the lowest face alone would
// flag whole runs.
const seamy = Object.values(DATA).map(d => d.start).filter(Boolean)
  .find(cn => searchAll(cn).length > 1);
if (seamy) {
  const faces = searchAll(seamy);
  ok(faces.every(f => S.judge([spine(seamy)], { expected: f, search: searchAll })[0].verdict === 'ok'),
    'a book on a seam is at home on EVERY face that contains it',
    `${seamy} -> ${JSON.stringify(faces)}`);
} else {
  ok(false, 'the dataset still has a call number contained by two faces');
}

ok(S.judge(row(A, B, F, D, E), { expected: elsewhere, search: searchAll })
  .map(x => x.verdict).every(x => x === 'wrongShelf' || x === 'unknown' || x === 'ok'),
  'wrong shelf takes precedence over out of order', 'carry it away beats move it a slot');

section('inferring the face instead of demanding it');

const shelfmates = Object.entries(DATA)
  .filter(([k, d]) => !k.startsWith('9|') && d.start && d.end)[0];
if (shelfmates) {
  const [key, d] = shelfmates;
  const [lvl, id, side] = key.split('|');
  const guess = S.inferFace([d.start, d.start, d.end], searchAll);
  ok(guess !== null, 'three books off one face infer a face', key);
  ok(S.inferFace([d.start, d.start], searchAll) === null,
    'two books do not', 'below the floor, no guess is offered');
  ok(guess && searchAll(d.start).some(f => f.lvl === guess.lvl && f.id === guess.id && f.side === guess.side),
    'and the guess is a face those books are actually on',
    JSON.stringify(guess) + ' vs ' + JSON.stringify({ lvl: +lvl, id, side }));
}

/* ── 5. the false-positive floor ────────────────────────────────────────── */

section('ten thousand correctly ordered shelves, none of them flagged');

// A seeded generator, so a failure here is reproducible rather than a story about last Tuesday.
let seed = 20260812;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

const endpoints = [...new Set(
  Object.values(DATA).flatMap(d => [d.start, d.end]).filter(Boolean)
)].filter(cn => R.wellFormed(cn));

// Endpoints have to be grouped by scheme before sorting: a mixed row is excluded by the judge
// anyway, and building one here would be testing the exclusion rather than the ordering.
const byScheme = { w1: [], nlm: [] };
for (const cn of endpoints) byScheme[R.scheme(cn)].push(cn);
byScheme.w1.sort((a, b) => S.cmpKey(K(a), K(b)));
byScheme.nlm.sort((a, b) => S.cmpKey(K(a), K(b)));

const SPELLINGS = [
  (n) => `no.${n}`, (n) => `no. ${n}`, (n) => `NO${n}`, (n) => `no ${n}`,
  (n) => `v.${n}`, (n) => `pt.${n}`,
];

function realRow() {
  const pool = rnd() < 0.5 ? byScheme.w1 : byScheme.nlm;
  const n = 3 + Math.floor(rnd() * 8);
  const at = Math.floor(rnd() * Math.max(1, pool.length - n));
  return pool.slice(at, at + n);
}

function serialRow() {
  // One title, many bound volumes — the shape that makes up most of a Biomed serials face, and
  // the shape the shipping comparator gets wrong.
  const base = pick(byScheme.w1);
  const spell = pick(SPELLINGS);
  const start = 1 + Math.floor(rnd() * 70);
  const n = 3 + Math.floor(rnd() * 8);
  const year = 1960 + Math.floor(rnd() * 60);
  const withYear = rnd() < 0.4;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(`${base} ${spell(start + i)}` + (withYear ? ` ${year + i}` : ''));
  }
  return out;
}

let flagged = 0;
const examples = [];
for (let t = 0; t < 10000; t++) {
  const cns = t % 2 ? serialRow() : realRow();
  if (cns.length < 3) continue;
  const vs = S.judge(cns.map(cn => spine(cn)), {});
  for (let i = 0; i < vs.length; i++) {
    if (vs[i].verdict === 'outOfOrder' || vs[i].verdict === 'volumeBreak' ) {
      flagged++;
      if (examples.length < 5) examples.push(`${vs[i].verdict}: ${cns.join(' | ')} (at ${i})`);
    }
  }
}
ok(flagged === 0, 'no correctly ordered row produces a misfile verdict',
  flagged + ' false positives\n       ' + examples.join('\n       '));

// The counterweight: a suite that flags nothing is also a suite that passes when judge() is
// `return []`. Break one row per shape and check it is caught.
let caught = 0, tried = 0;
seed = 771;
for (let t = 0; t < 400; t++) {
  const cns = t % 2 ? serialRow() : realRow();
  if (cns.length < 5) continue;
  const j = 1 + Math.floor(rnd() * (cns.length - 2));
  const moved = cns.slice();
  const [taken] = moved.splice(j, 1);
  moved.splice(j === 1 ? cns.length - 2 : 1, 0, taken);      // move it somewhere it does not belong
  if (moved.join() === cns.join()) continue;
  tried++;
  if (S.judge(moved.map(cn => spine(cn)), {}).some(x => x.verdict === 'outOfOrder' || x.verdict === 'volumeBreak')) caught++;
}
ok(tried > 50, 'the recall check actually ran', tried + ' rows');
ok(caught / tried > 0.8, 'a deliberately moved book is caught',
  `${caught} of ${tried}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
