// Golden vectors for shelf ordering. JS produces them; the Swift XCTest asserts against them.
//
//   node ios/Tools/shelfOrderGolden.js biomed-shelf-ranges.json ios/Tests/ShelfOrderGolden.json
//
// Three keys, and `swiftcheck.test.js` enforces that ShelfOrderTests.swift reads exactly these
// three — a key with no Swift decoder is a hard failure, and a fixture nobody registered is
// silently unchecked, which is worse.
//
//   trailers   pairwise ordering, weighted to the cases CallNumber.compare gets wrong
//   sequences  whole rows with expected per-spine verdicts, one per guard
//   faces      real Router.search results, so wrong-shelf is tested against the real dataset

'use strict';
const fs = require('fs');
const S = require('./shelforder.js');
const R = require('./recognizer.js');

const DATA = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const K = (s) => S.parseKey(s);

/* 1. Pairwise ordering. Every entry here is a pair the shipping comparator answers wrongly, plus
      enough base-comparator cases to catch a port that fixed trailers by breaking cutters. */
const trailerPairs = [
  ['W1 NA388 no.9', 'W1 NA388 no.10'],
  ['W1 NA388 no.2', 'W1 NA388 no.11'],
  ['W1 NA388 no.66', 'W1 NA388 no.7'],
  ['W1 NA388 v.9', 'W1 NA388 v.10'],
  ['W1 NA388 pt.9', 'W1 NA388 pt.10'],
  ['W1 NA388 no.65', 'W1 NA388 no.66'],
  ['W1 NA388 no66', 'W1 NA388 no.7'],
  ['W1 NA388 no 66', 'W1 NA388 no.7'],
  ['W1 NA388 no.66', 'W1 NA388 no66'],
  ['W1 NA388 no.66', 'W1 NA388 NO 66'],
  ['W1 NA388', 'W1 NA388 no.66'],
  ['W1 NA388 no.66', 'W1 NA388 no.66 1984'],
  ['W1 NA388 no.66 1984', 'W1 NA388 no.66 1985'],
  ['W4C Z89P 2009', 'W4C Z89P 2010'],
  ['W1 NA388', 'W1 NA1991'],
  ['W1 AM477', 'W1 AM4733'],
  ['W1 NA388', 'W1 NA835'],
  ['WM 13 D5537', 'WM 13 D5537 1984'],
  ['W 2000', 'W 2001'],
  // An NLM cutter that reads as a volume token. `WK 835 V3315` is a real range endpoint, and the
  // shelf puts .3315 before .44 — a port that strips it as a volume and compares 3315 as an
  // integer answers this pair backwards.
  ['WK 835 V3315', 'WK 835 V44'],
  ['WM 13 NO52', 'WM 13 NO6'],
  ['WA 100 PT9', 'WA 100 PT91'],
  ['WM 13 D5537 no.5', 'WM 13 D5537 no.40'],
].map(([a, b]) => ({ a, b, cmp: S.cmpKey(K(a), K(b)) }));

/* 2. Whole rows. Each one is a named guard rather than a random shelf, because a failure should
      say which rule broke. `null` is an unreadable spine. */
const A = 'W1 AA100', B = 'W1 BB100', C = 'W1 CC100', D = 'W1 DD100', E = 'W1 EE100', F = 'W1 FF100';
const v = (n) => `W1 NA388 no.${n}`;

const rows = [
  ['in order, flags nothing', [A, B, C, D]],
  ['duplicate copies are not a misfile', [A, A, B, B]],
  ['A B F D E blames F alone', [A, B, F, D, E]],
  ['A F B blames F alone', [A, F, B]],
  ['two books never accuse each other', [F, A]],
  ['the first readable book is never flagged', [F, A, B]],
  ['the last readable book is never flagged', [A, B, F]],
  ['an unreadable spine does not break the run', [A, null, B, null, C]],
  ['a read that fails the grammar is unknown', [A, 'NOT A CALL NUMBER', B, C]],
  ['a lone NLM book on a W1 shelf is excluded', [A, B, 'WM 13 D5537', C, D]],
  ['an intact serial run flags nothing', [v(1), v(2), v(3), v(4), v(5)]],
  ['no.10 after no.2 is correct', [v(1), v(2), v(10), v(11), v(12)]],
  ['one volume out of place is a volumeBreak', [v(1), v(2), v(9), v(3), v(4)]],
  // A trailer-kind mismatch inside one run is OCR variance, not a misfile: the volume line
  // resolved on one spine and only the year on its neighbours.
  ['a mixed trailer shape in one run is not a misfile',
    ['W1 NA388 1982', 'W1 NA388 1983', 'W1 NA388 no.10 1984', 'W1 NA388 1985', 'W1 NA388 1986']],
  ['nor is one spine spelled v. among no.',
    ['W1 NA388 v.1', 'W1 NA388 v.2', 'W1 NA388 no.3', 'W1 NA388 v.4', 'W1 NA388 v.5']],
  // …but the guard is scoped to one run, so another title really is still flagged.
  ['a different title inside a run is still flagged',
    [v(1), v(2), 'W1 ZZ900 A1', v(4), v(5)]],
  // The split spelling has to pass the grammar, or the whole face reads as unreadable.
  ['a run spelled "no 66" is ordered, not written off',
    ['W1 NA388 no 5', 'W1 NA388 no 6', 'W1 NA388 no 7', 'W1 NA388 no 8']],
  ['and a break in that spelling is caught',
    ['W1 NA388 no 1', 'W1 NA388 no 2', 'W1 NA388 no 9', 'W1 NA388 no 4', 'W1 NA388 no 5']],
  ['a v. run can be judged at all',
    ['W1 NA388 v.1', 'W1 NA388 v.2', 'W1 NA388 v.9', 'W1 NA388 v.4', 'W1 NA388 v.5']],
].map(([name, cns]) => ({
  name,
  spines: cns,
  verdicts: S.judge(cns.map(cn => ({ cn })), {}).map(x => x.verdict),
}));

// The two guards that need per-spine flags rather than a plain list.
const flagged = [
  {
    name: 'a column at the frame edge is never flagged',
    spines: [A, B, F, D, E],
    edge: [false, false, true, false, false],
    anchored: [true, true, true, true, true],
  },
  {
    name: 'an unanchored read is shown but never judged',
    spines: [A, B, F, D, E],
    edge: [false, false, false, false, false],
    anchored: [true, true, false, true, true],
  },
].map(r => Object.assign(r, {
  verdicts: S.judge(
    r.spines.map((cn, i) => ({ cn, edge: r.edge[i], anchored: r.anchored[i] })), {}
  ).map(x => x.verdict),
}));

const sequences = rows
  .map(r => Object.assign(r, {
    edge: r.spines.map(() => false),
    anchored: r.spines.map(() => true),
  }))
  .concat(flagged);

/* 3. Real faces. Router.search, ported exactly as golden.js does it — level 9 excluded, sorted by
      (level, key) because Dictionary iteration order is randomized per launch in Swift and the
      seam ties have to land the same way in all three implementations. */
function searchAll(cn) {
  const qs = R.scheme(cn), hits = [];
  for (const key in DATA) {
    const d = DATA[key];
    if (!d.start || !d.end) continue;
    if (key.startsWith('9|')) continue;
    if (R.scheme(d.start) !== qs) continue;
    if (R.cmpCN(cn, d.start) >= 0 && R.cmpCN(cn, d.end) <= 0) {
      const [lvl, id, side] = key.split('|');
      hits.push({ key, lvl: +lvl, id, side });
    }
  }
  hits.sort((a, b) => (a.lvl !== b.lvl ? a.lvl - b.lvl : (a.key < b.key ? -1 : 1)));
  return hits.map(({ lvl, id, side }) => ({ lvl, id, side }));
}

const endpoints = [...new Set(
  Object.values(DATA).flatMap(d => [d.start, d.end]).filter(Boolean)
)];
const samples = ['W1 NA388 no.66 1984', 'W1 AM477', 'WM 13 D5537', 'W1 NA1991', 'W1 NA835'];
const faces = [...new Set([...endpoints, ...samples])].map(cn => ({ cn, faces: searchAll(cn) }));

fs.writeFileSync(process.argv[3], JSON.stringify({ trailers: trailerPairs, sequences, faces }, null, 1));

const seams = faces.filter(f => f.faces.length > 1).length;
console.log('trailer pairs:', trailerPairs.length, '| sequences:', sequences.length,
  '| face cases:', faces.length, '| on a seam:', seams);
