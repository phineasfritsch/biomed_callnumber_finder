// O/0 restoration, measured against the whole live dataset rather than a handful of examples.
//
//   node ios/Tools/confusable.test.js biomed-shelf-ranges.json
//
// Three questions, in the order they matter:
//
//   1. Does the tightened grammar still accept every real book? (A grammar fix that quietly
//      drops shelves is worse than the bug it fixes.)
//   2. Does a `JO` -> `J0` misread now land on the RIGHT shelf, where before it landed
//      confidently on a wrong one?
//   3. Does anything else change? Every endpoint is resolved before and after; any endpoint
//      whose answer moved is a failure unless it is one of the misreads above.
//
// The pipeline under test is ios/Tools/recognizer.js, which mirrors the Swift.

'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./recognizer.js');

const rangesPath = process.argv[2] || path.join(__dirname, '..', '..', 'biomed-shelf-ranges.json');
const DATA = JSON.parse(fs.readFileSync(rangesPath, 'utf8'));
const locate = R.makeLocator(DATA);
const resolve = R.makeResolver(DATA);

let pass = 0, fail = 0;
const section = (s) => console.log(`\n${s}`);
function ok(cond, label, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
}

/* Every distinct endpoint in the building. */
const endpoints = [...new Set(
  Object.values(DATA).flatMap((d) => [d.start, d.end]).filter(Boolean),
)].sort();

const place = (h) => (h ? `L${h.lvl} ${h.id}/${h.side}` : 'nil');

/* ── 1. the premise ─────────────────────────────────────────────────────── */
// The whole fix rests on two claims about the notation. If either stops being true of the data,
// the repair becomes a guess and these tests must be revisited before it ships.

section('the dataset facts the repair is built on');

const cutterTokens = endpoints.flatMap((e) => e.toUpperCase().split(/\s+/).slice(1));
const leadingZero = cutterTokens.filter((t) => /^[A-Z]+0/.test(t));
ok(leadingZero.length === 0,
  'no cutter digit run starts with 0',
  `${leadingZero.length} do: ${leadingZero.slice(0, 8).join(', ')}`);

// The mirror rule (a letter inside a digit run must be a misread 0) is NOT implemented, and this
// is why: real jammed double cutters put a letter between two digits. Asserted rather than
// commented, so that if the collection ever stops containing them the note stops being a lie.
const letterInDigits = cutterTokens.filter((t) => /\d[A-Z]\d/.test(t));
ok(letterInDigits.length > 0,
  'letters DO appear inside digit runs, so O-between-digits cannot be repaired',
  'none found — re-read the note in recognizer.js before adding that rule');
console.log(`  (jammed double cutters: ${[...new Set(letterInDigits)].slice(0, 6).join(', ')})`);
ok(R.repairConfusable(' W1 NA3O8 ') === null,
  'O between digits is deliberately left alone');

const blocks = cutterTokens.map((t) => (t.match(/^([A-Z]+)\d/) || [])[1]).filter(Boolean);
const maxBlock = Math.max(...blocks.map((b) => b.length));
ok(maxBlock === 2,
  'no cutter letter block is longer than two letters',
  `longest is ${maxBlock}`);

const joCount = endpoints.filter((e) => /\bJO\d/.test(e.toUpperCase())).length;
ok(joCount > 0, 'the JO block exists and is populous', `found ${joCount}`);
console.log(`  (JO endpoints: ${joCount}; cutter tokens examined: ${cutterTokens.length})`);

/* ── 2. the grammar still accepts every real book ───────────────────────── */

section('the tightened grammar loses nothing real');

// Baseline: the grammar as it stood before `[1-9]\d*`, so the comparison is exact rather than
// remembered. Anything this accepts and the new one rejects is a regression.
const OLD_CUTTER = /^[A-Z]{1,3}\d+[A-Z]{0,2}$/;
const OLD_A1 = /^A1[A-Z]\d+[A-Z]{0,2}$/;
function wellFormedOld(raw) {
  const s = String(raw).toUpperCase().replace(/\.(?=[A-Z])/g, ' ').trim();
  const toks = s.split(/\s+/).filter(Boolean);
  if (!toks.length) return false;
  const isCut = (t) => OLD_CUTTER.test(t) || OLD_A1.test(t);
  let rest;
  if (/^W[1-4][A-Z]{0,2}$/.test(toks[0])) rest = toks.slice(1);
  else if (/^[A-Z]{1,3}$/.test(toks[0]) && toks[1] && /^\d+(\.\d+)?$/.test(toks[1])) rest = toks.slice(2);
  else if (/^[A-Z]{1,3}\d+(\.\d+)?$/.test(toks[0])) rest = toks.slice(1);
  else return false;
  if (!rest.length || !isCut(rest[0])) return false;
  return rest.slice(1).every((t) => isCut(t) || R.TRAIL.test(t));
}

/** The pipeline exactly as it stood before this change: old grammar, no repair pass. */
function resolveOld(candidates) {
  for (const c of candidates) {
    const text = typeof c === 'string' ? c : c.text;
    for (const found of R.matches(R.normalize(text))) {
      if (!R.parseCN(found).length) continue;
      if (!wellFormedOld(found)) continue;
      const hit = locate(found);
      return hit ? { state: 'located', cn: found, hit } : { state: 'unlocated', cn: found };
    }
  }
  return null;
}

const lost = endpoints.filter((e) => wellFormedOld(e) && !R.wellFormed(e));
ok(lost.length === 0,
  'every endpoint the old grammar accepted is still accepted',
  `${lost.length} lost: ${lost.slice(0, 10).join(' | ')}`);

const acceptedNow = endpoints.filter((e) => R.wellFormed(e)).length;
const acceptedBefore = endpoints.filter((e) => wellFormedOld(e)).length;
ok(acceptedNow === acceptedBefore,
  'the accepted count is unchanged',
  `${acceptedBefore} -> ${acceptedNow}`);
console.log(`  (${acceptedNow} of ${endpoints.length} endpoints well-formed, unchanged)`);

// And it does reject the thing it was tightened for.
ok(!R.wellFormed('W1 J0506'), 'W1 J0506 is rejected as malformed');
ok(R.wellFormed('W1 JO506'), 'W1 JO506 is accepted');
ok(!R.wellFormed('W1 NA3B8'), 'W1 NA3B8 is still rejected (the original gate still works)');
ok(!R.wellFormed('WI NA388'), 'WI NA388 is still rejected (scheme flip)');

/* ── 3. the misread now lands on the right shelf ────────────────────────── */

section('a JO -> J0 misread routes correctly instead of confidently wrongly');

// Every JO endpoint in the building, as Vision would render it with the O read as a zero.
const joEndpoints = endpoints.filter((e) => /\bJO\d/.test(e.toUpperCase()));
const asMisread = (e) => e.toUpperCase().replace(/\bJO(\d)/, 'J0$1');

let repaired = 0, wrongBefore = 0, textWrongBefore = 0;
for (const e of joEndpoints) {
  const truth = locate(e);
  const misread = asMisread(e);

  // What the old pipeline did with it: `J0506` is well-formed under the old grammar, so it
  // resolved — to whatever shelf `J` + .0506 happens to fall in, under the wrong text.
  const b = resolveOld([misread]);
  const before = b && b.state === 'located' ? b.hit : null;
  if (place(before) !== place(truth)) wrongBefore++;
  if (b && b.cn !== e.toUpperCase()) textWrongBefore++;

  const after = resolve([misread]);
  const got = after && after.state === 'located' ? place(after.hit) : (after ? 'unlocated' : 'nil');
  if (got === place(truth)) repaired++;
  else {
    ok(false, `misread ${misread}`, `want ${place(truth)} (from ${e}), got ${got}`);
  }
}
ok(repaired === joEndpoints.length,
  `all ${joEndpoints.length} JO misreads now resolve to the true shelf`,
  `${repaired}/${joEndpoints.length}`);
console.log(`  (before the fix: ${wrongBefore} of ${joEndpoints.length} routed to the WRONG shelf,`
  + ` ${textWrongBefore} of ${joEndpoints.length} recorded the wrong text on the trip list)`);

// The same shape outside the JO block, and the digit-run rule.
const spot = [
  ['W1 J0506', 'W1 JO506'],
  ['W1 J0955', 'W1 JO955'],
  ['W1 J0551V', 'W1 JO551V'],
  ['W1 J05221', 'W1 JO5221'],
  ['W1 M0644', 'W1 MO644'],
  ['W1 C0756TA', 'W1 CO756TA'],
  ['BIOMED\nW1\nJ0506\nno.66\n1984', 'W1 JO506 NO.66 1984'],   // as Vision actually returns it
];
for (const [misread, want] of spot) {
  const r = resolve([misread]);
  ok(r && r.cn === want, `${misread} reads as ${want}`, `got ${r ? r.cn : 'nil'}`);
}

/* ── 4. nothing else moved ──────────────────────────────────────────────── */

section('no endpoint changes where it routes');

// Same pipeline, same input, old vs new — the only honest way to show the change is confined to
// the misread it was written for.
let moved = 0;
for (const e of endpoints) {
  const b = resolveOld([e]), a = resolve([e]);
  const before = `${b ? b.cn : 'nil'} @ ${b && b.state === 'located' ? place(b.hit) : 'nil'}`;
  const after = `${a ? a.cn : 'nil'} @ ${a && a.state === 'located' ? place(a.hit) : 'nil'}`;
  if (before !== after) {
    moved++;
    if (moved <= 5) console.log(`  MOVED ${e}: ${before} -> ${after}`);
  }
}
ok(moved === 0, 'every endpoint reads and routes exactly as it did before', `${moved} moved`);

/* ── 5. the repair does not fire where it must not ──────────────────────── */

section('the repair stays out of the way');

const untouched = [
  'W1 NA388 NO.66 1984',   // clean label
  'W1 A1C7',               // jammed double cutter
  'WM 13 D5537',           // NLM
  'QL737.C22',             // LC with cutter dot
  'W1 NA388 PT.3',         // trailer that contains a digit
  'W1 NA388 V.2',
  'W1 NA388 2001',         // a year with a zero in it
  'W1 NA1991 NO.100',      // a volume with zeros in it
];
for (const s of untouched) {
  ok(R.repairConfusable(R.normalize(s)) === null, `left alone: ${s}`,
    `became ${JSON.stringify(R.repairConfusable(R.normalize(s)))}`);
}

// Trailers that superficially look like the repair target.
for (const s of ['PT03', 'NO.06', 'V.05']) {
  ok(R.repairConfusable(` W1 NA388 ${s} `) === null, `trailer untouched: ${s}`,
    `became ${JSON.stringify(R.repairConfusable(` W1 NA388 ${s} `))}`);
}

// A clean read must never be outranked by a repair of a lower-ranked candidate.
const ranked = resolve([
  { text: 'W1 NA388 no.66 1984', confidence: 0.9 },
  { text: 'W1 J0506', confidence: 0.95 },
]);
ok(ranked && ranked.cn === 'W1 NA388 NO.66 1984',
  'the first candidate that reads cleanly still wins',
  `got ${ranked ? ranked.cn : 'nil'}`);

// …and within one candidate, the unrepaired reading is tried first.
const order = R.readings('W1 J0506');
ok(order.length === 2 && order[0].includes('J0506') && order[1].includes('JO506'),
  'readings are ordered original-then-repair',
  JSON.stringify(order));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
