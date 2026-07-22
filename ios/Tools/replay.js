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
//   3. Edit RECOGNIZER below, re-run, compare. Seconds per iteration.
//   4. When it's right, port the change to the Swift (same regexes, same order) and deploy ONCE.
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
// RECOGNIZER — keep in lockstep with the Swift. This is the part you tune.
// ─────────────────────────────────────────────────────────────────────────────

// CallNumberRecognizer.extract
const VOL = '(?:\\s+NO\\.?\\s?\\d+[A-Z]?)?(?:\\s+(?:18|19|20)\\d{2}[A-Z]?)?';
const PATTERNS = [
  new RegExp('\\bW[1-4][A-Z]{0,2}\\s*(?:A1[A-Z]\\d{1,4}|[A-Z]{1,3}\\s?\\d{1,4})[A-Z]{0,2}(?![A-Z0-9])' + VOL, 'g'),
  new RegExp('\\b[A-Z]{1,3}\\s?\\d{1,4}(?:\\.\\d+)?[\\s.]+\\.?[A-Z]{1,3}\\d{1,5}[A-Z]{0,2}(?![A-Z0-9])' + VOL, 'g'),
];
function extract(text) {
  let s = text.toUpperCase()
    .replace(/\bBIOMED\b/g, ' ')
    .replace(/[|=_]+/g, ' ')
    .replace(/[^A-Z0-9. ]/g, ' ')
    .replace(/\s+/g, ' ');
  s = ' ' + s.trim() + ' ';
  const out = [];
  for (const rx of PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(s))) {
      const hit = m[0].trim().replace(/[ .]+$/, '');
      if (hit && !out.includes(hit)) out.push(hit);
    }
  }
  return out;
}

// CallNumber.isWellFormed
const CUTTER = /^[A-Z]{1,3}\d+[A-Z]{0,2}$/;
const A1FORM = /^A1[A-Z]\d+[A-Z]{0,2}$/;
const TRAIL = /^(NO\.?\d+[A-Z]?|(18|19|20)\d{2}[A-Z]?|V\.?\d+|PT\.?\d+)$/;
const isCut = t => CUTTER.test(t) || A1FORM.test(t);
function wellFormed(raw) {
  const s = raw.toUpperCase().replace(/\.(?=[A-Z])/g, ' ').trim();
  const toks = s.split(/\s+/).filter(Boolean);
  if (!toks.length) return false;
  let rest;
  if (/^W[1-4][A-Z]{0,2}$/.test(toks[0])) rest = toks.slice(1);
  else if (/^[A-Z]{1,3}$/.test(toks[0]) && toks[1] && /^\d+(\.\d+)?$/.test(toks[1])) rest = toks.slice(2);
  else if (/^[A-Z]{1,3}\d+(\.\d+)?$/.test(toks[0])) rest = toks.slice(1);
  else return false;
  if (!rest.length || !isCut(rest[0])) return false;
  return rest.slice(1).every(t => isCut(t) || TRAIL.test(t));
}

const MIN_CONFIDENCE = 0.4;   // CallNumberRecognizer.minConfidence

// ─────────────────────────────────────────────────────────────────────────────
// Comparator + lookup (ported; do not tune)
// ─────────────────────────────────────────────────────────────────────────────

function parseCN(raw) {
  let s = (raw || '').toUpperCase().replace(/\*/g, '').replace(/\.(?=[A-Z])/g, ' ');
  const toks = s.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  let classAlpha, classNum = 0, rest = toks.slice(1);
  if (/^W[1-4][A-Z]{0,2}$/.test(toks[0])) classAlpha = toks[0];
  else {
    const m0 = toks[0].match(/^([A-Z]+)(\d+\.?\d*)?(.*)$/);
    if (m0) {
      classAlpha = m0[1];
      if (m0[2]) classNum = parseFloat(m0[2]);
      if (m0[3]) rest = [m0[3]].concat(rest);
    } else classAlpha = toks[0];
    if (!classNum && rest.length && /^\d+\.?\d*$/.test(rest[0])) { classNum = parseFloat(rest[0]); rest = rest.slice(1); }
  }
  out.push({ t: 'A', a: classAlpha }, { t: 'N', n: classNum });
  for (const t of rest) {
    const mm = t.match(/^([A-Z]+)(\d*)([A-Z]*)$/);
    if (mm) out.push({ t: 'C', a: mm[1], n: mm[2] ? parseFloat('0.' + mm[2]) : 0, s: mm[3] });
    else out.push({ t: 'C', a: t, n: 0, s: '' });
  }
  return out;
}
function cmpSeg(a, b) {
  if (!a) return -1; if (!b) return 1;
  if (a.t !== b.t) return a.t < b.t ? -1 : 1;
  if (a.t === 'A') return a.a === b.a ? 0 : (a.a < b.a ? -1 : 1);
  if (a.t === 'N') return a.n === b.n ? 0 : (a.n < b.n ? -1 : 1);
  if (a.a !== b.a) return a.a < b.a ? -1 : 1;
  if (a.n !== b.n) return a.n < b.n ? -1 : 1;
  if (a.s !== b.s) return a.s < b.s ? -1 : 1;
  return 0;
}
function cmpCN(x, y) {
  const a = parseCN(x), b = parseCN(y), n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) { const c = cmpSeg(a[i], b[i]); if (c !== 0) return c < 0 ? -1 : 1; }
  return 0;
}
const scheme = cn => /^\s*W[1-4]([A-Z]|\b)/i.test(cn || '') ? 'w1' : 'nlm';
function locate(cn) {
  const hits = [];
  for (const key in DATA) {
    const d = DATA[key];
    if (!d.start || !d.end || scheme(d.start) !== scheme(cn)) continue;
    if (cmpCN(cn, d.start) >= 0 && cmpCN(cn, d.end) <= 0) {
      const [lvl, id, side] = key.split('|');
      hits.push({ key, lvl: +lvl, id, side });
    }
  }
  hits.sort((a, b) => a.lvl !== b.lvl ? a.lvl - b.lvl : (a.key < b.key ? -1 : 1));
  return hits[0] || null;
}

function resolve(candidates) {
  for (const c of candidates) {
    if (c.confidence < MIN_CONFIDENCE) continue;
    for (const text of extract(c.text)) {
      if (!wellFormed(text)) continue;
      const hit = locate(text);
      return hit ? { state: 'located', cn: text, hit } : { state: 'unlocated', cn: text };
    }
  }
  return null;
}

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
