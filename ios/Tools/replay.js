// Replay a corpus captured on the phone against the recognizer model.
//
//   node ios/Tools/replay.js biomed-shelf-ranges.json corpus.json [--verbose]
//
// The point: the build loop for this project is ~10 minutes (cloud Mac, no USB device). Tuning the
// grammar or extraction against that loop is unbearable. So capture reality once with the app's
// Scan Diagnostics screen, then iterate here — the recognizer is pure logic, so a replay is exact,
// not an approximation.
//
// Workflow:
//   1. Turn on recording in the app, scan a shelf, export, AirDrop the folder.
//   2. Run this. It reports what the current pipeline does with those exact Vision candidates.
//   3. Edit ios/Tools/recognizer.js — that is the model, shared with pipeline.js and
//      confusable.test.js — re-run, compare. Seconds per iteration.
//   4. When it's right, port the change to the Swift (same regexes, same order) and deploy ONCE.
//      Then run `node ios/Tools/pipeline.js` and `node ios/Tools/confusable.test.js` to check the
//      change did not move anything it was not aimed at.
//
// To score accuracy, add an "expected" field to records in corpus.json — the correct call number,
// or "" if the frame genuinely contains none. Records without it are reported but not scored.

const fs = require('fs');

const [, , rangesPath, corpusPath, ...flags] = process.argv;
if (!rangesPath || !corpusPath) {
  console.error('usage: node replay.js <biomed-shelf-ranges.json> <corpus.json> [--verbose]');
  process.exit(2);
}
const VERBOSE = flags.includes('--verbose');
const DATA = JSON.parse(fs.readFileSync(rangesPath, 'utf8'));
const CORPUS = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// RECOGNIZER — one copy, shared with pipeline.js and confusable.test.js, kept in
// lockstep with the Swift. This is the part you tune; edit recognizer.js.
// ─────────────────────────────────────────────────────────────────────────────

const R = require('./recognizer.js');
const resolve = R.makeResolver(DATA);

// ─────────────────────────────────────────────────────────────────────────────
// Replay
// ─────────────────────────────────────────────────────────────────────────────

const norm = s => (s || '').toUpperCase().replace(/\s+/g, ' ').trim();

let located = 0, unlocated = 0, none = 0;
let scored = 0, correct = 0;
const wrong = [], missed = [], spurious = [];

for (const rec of CORPUS) {
  const r = resolve(rec.candidates || []);
  if (!r) none++;
  else if (r.state === 'located') located++;
  else unlocated++;

  if (rec.expected === undefined || rec.expected === null) continue;
  scored++;
  const want = norm(rec.expected);
  const got = r ? norm(r.cn) : '';

  if (got === want) { correct++; continue; }
  if (want && !got) missed.push({ rec, want });
  else if (!want && got) spurious.push({ rec, got });
  else wrong.push({ rec, want, got });
}

console.log(`corpus: ${CORPUS.length} frames`);
console.log(`  located   ${located}`);
console.log(`  unlocated ${unlocated}`);
console.log(`  no match  ${none}`);

if (scored === 0) {
  console.log('\nNothing scored. Add "expected" to records in corpus.json to measure accuracy:');
  console.log('  "expected": "W1 NA388 no.66 1984"   ← the right answer');
  console.log('  "expected": ""                       ← frame has no call number');
} else {
  const pct = ((correct / scored) * 100).toFixed(1);
  console.log(`\nscored ${scored} · correct ${correct} (${pct}%)`);
  const show = (label, list, fmt) => {
    if (!list.length) return;
    console.log(`\n${label} (${list.length}):`);
    for (const x of list.slice(0, VERBOSE ? list.length : 12)) console.log('  ' + fmt(x));
    if (!VERBOSE && list.length > 12) console.log(`  … ${list.length - 12} more (--verbose)`);
  };
  // Wrong is the dangerous bucket: the app was confident and incorrect.
  show('WRONG — confidently wrong, walks you to the wrong shelf', wrong,
    x => `want ${x.want.padEnd(24)} got ${x.got}`);
  show('MISSED — a real label the pipeline threw away', missed,
    x => `want ${x.want.padEnd(24)} candidates: ${JSON.stringify((x.rec.candidates || []).map(c => c.text).slice(0, 3))}`);
  show('SPURIOUS — invented a call number from non-label text', spurious,
    x => `got  ${x.got.padEnd(24)} candidates: ${JSON.stringify((x.rec.candidates || []).map(c => c.text).slice(0, 3))}`);
}

if (VERBOSE) {
  console.log('\n--- every frame ---');
  for (const rec of CORPUS) {
    const r = resolve(rec.candidates || []);
    const top = (rec.candidates || [])[0];
    console.log(
      (r ? (r.state === 'located' ? `L${r.hit.lvl} ${r.hit.id}/${r.hit.side}` : 'unlocated') : 'none').padEnd(22),
      '|', (r ? r.cn : '—').padEnd(24),
      '| vision#1:', top ? JSON.stringify(top.text) : '—'
    );
  }
}
