// The recognizer, in JavaScript. Keep in lockstep with the Swift — this is the model the
// offline tools reason about, and the whole point of TESTING.md §3 is that it is exact rather
// than approximate.
//
// It was copied into pipeline.js, replay.js and (partly) golden.js, which meant a grammar fix
// had to land in three places and only ever landed in some of them. One copy now; those tools
// require this file.
//
// Mirrors, in order:
//   CallNumberRecognizer.extract     -> normalize + PATTERNS + matches
//   CallNumberRecognizer.restoreO    -> repairConfusable
//   CallNumber.isWellFormed          -> wellFormed
//   CallNumber (parse + comparator)  -> parseCN / cmpCN
//   Router.locate                    -> makeLocator
//   CallNumberRecognizer.resolve     -> makeResolver

'use strict';

/* ── extraction ─────────────────────────────────────────────────────────── */

// `V.` and `PT.` were missing here while `TRAIL` and the shelf comparator both accepted them, so
// `W1 NA388 V.9` extracted as `W1 NA388` and the volume never reached ShelfOrder. Every spine on a
// v.-numbered run then keyed to the same base, the sequence was trivially in order, and no misfile
// on that shelf could be flagged. That is one of the three regressions shelforder.js exists to fix,
// unreachable from the camera.
const VOL = '(?:\\s+(?:NO|V|PT)\\.?\\s?\\d+[A-Z]?)?(?:\\s+(?:18|19|20)\\d{2}[A-Z]?)?';
const PATTERNS = [
  new RegExp('\\bW[1-4][A-Z]{0,2}\\s*(?:A1[A-Z]\\d{1,4}|[A-Z]{1,3}\\s?\\d{1,4})[A-Z]{0,2}(?![A-Z0-9])' + VOL, 'g'),
  new RegExp('\\b[A-Z]{1,3}\\s?\\d{1,4}(?:\\.\\d+)?[\\s.]+\\.?[A-Z]{1,3}\\d{1,5}[A-Z]{0,2}(?![A-Z0-9])' + VOL, 'g'),
];

/** Uppercase, drop the collection prefix and every character a call number cannot contain. */
function normalize(text) {
  const s = String(text || '').toUpperCase()
    .replace(/\bBIOMED\b/g, ' ')
    .replace(/[|=_]+/g, ' ')
    .replace(/[^A-Z0-9. ]/g, ' ')
    .replace(/\s+/g, ' ');
  return ' ' + s.trim() + ' ';
}

function matches(normalized) {
  const out = [];
  for (const rx of PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(normalized))) {
      const hit = m[0].trim().replace(/[ .]+$/, '');
      if (hit && !out.includes(hit)) out.push(hit);
    }
  }
  return out;
}

function extract(text) {
  return matches(normalize(text));
}

/* ── O/0 restoration ────────────────────────────────────────────────────── */
//
// Vision cannot tell O from 0 on these spines and neither can a person at arm's length. The
// notation can, in exactly one place, measured against the live dataset (906 endpoints,
// biomed-shelf-ranges.json): **a cutter's digit run never starts with 0** — 0 of 906. So in
// `J0506` the 0 sits where a digit is not allowed to sit, and the only legal reading is `JO506`.
// `JO` is a real and populous cutter block (49 endpoints, most of a floor); `J0` does not exist.
//
// The mirror rule — "a letter inside a digit run must be a 0" — was written, measured, and
// deleted. It is false here: `A1C7`, `R81R8` and `P3R5D` are real, so a letter between two
// digits is a jammed double cutter, not a misread. Under that rule a hypothetical `R81O8` would
// become `R8108`, which passes the grammar and locates — inventing a wrong shelf out of a book
// that currently just needs manual entry. Cutting it leaves `NA3O8` a miss, which is the safe
// failure and the one the review list already handles.
//
// This is not the character-repair pass DESIGN.md §3.4 deleted either. That one substituted
// glyphs and accepted whatever landed in a shelf range, which is a machine for inventing
// plausible wrong shelves. This one is scored on nothing: it restores the single reading the
// notation permits, and the result still has to pass the grammar gate like any other candidate.
// The grammar does the rejecting, as always.
//
// Returns null when nothing changed, so callers can skip a redundant second pass.
function repairConfusable(normalized) {
  // A 0 immediately after a cutter's single leading letter, with at least two more digits behind
  // it, is an O. Two guards, both measured rather than guessed:
  //
  //   * ONE leading letter, so the repair can only ever produce a TWO-letter block. Every cutter
  //     block in the collection is 1 or 2 letters (308 and 355 of 663); nothing is 3. Allowing
  //     two would let `CO0756` become `COO756`, which passes the grammar and locates — a wrong
  //     shelf invented out of a string that is currently just a harmless miss.
  //   * `\d{2,}`, which keeps trailers out: `PT03` and `NO.06` are volume tokens, not cutters,
  //     and neither reaches this rule.
  const s = normalized.replace(/(?<=[ ])([A-Z])0(\d{2,})([A-Z]{0,2})(?=[ ])/g, '$1O$2$3');
  return s === normalized ? null : s;
}

/** Every reading of one OCR string worth trying, best-supported first. */
function readings(text) {
  const base = normalize(text);
  const repaired = repairConfusable(base);
  return repaired ? [base, repaired] : [base];
}

/* ── grammar ────────────────────────────────────────────────────────────── */

// `[1-9]\d*` rather than `\d+`: a cutter's digit run cannot start with 0 (0 of 906 real
// endpoints do). Without this, `W1 J0506` is well-formed, locates, and confidently sends you to
// a shelf that is not the one the book is on — the same class of failure as `NA3B8`, and it
// covers most of a floor because `JO` is a large cutter block.
const CUTTER = /^[A-Z]{1,3}[1-9]\d*[A-Z]{0,2}$/;
const A1FORM = /^A1[A-Z][1-9]\d*[A-Z]{0,2}$/;
const TRAIL = /^(NO\.?\d+[A-Z]?|(18|19|20)\d{2}[A-Z]?|V\.?\d+|PT\.?\d+)$/;
const isCut = (t) => CUTTER.test(t) || A1FORM.test(t);

/* Two token-level facts the grammar and the shelf comparator have to agree on exactly. They were
   written out twice, once here and once in shelforder.js, and the copies disagreed: `NO 66` became
   a shape `parseKey` normalized and `wellFormed` rejected, so a whole serials face read as
   unreadable. One definition, both callers. */

/**
 * Rejoin a volume token OCR handed over split: `["NO", "66"] -> ["NO66"]`.
 *
 * Not a hypothetical spelling. `VOL` allows the space, so `matches()` really does emit
 * `W1 NA388 NO 66`, and every spelling of a volume token has to reach the comparator as one shape.
 */
function joinVolumeTokens(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (/^(NO|V|PT)\.?$/.test(toks[i]) && i + 1 < toks.length && /^\d+[A-Z]?$/.test(toks[i + 1])) {
      out.push(toks[i].replace(/\.$/, '') + toks[i + 1]);
      i++;
    } else out.push(toks[i]);
  }
  return out;
}

/**
 * How many leading tokens the class number occupies: `W1` -> 1, `WM 13` -> 2, `QL737` -> 1, and
 * -1 when the head is not a class number at all.
 *
 * The three branches are the grammar's own, so one place decides where the class ends and the
 * cutter begins. `parseKey` needs the same answer: it may strip trailers but never the cutter, and
 * counting tokens could not tell the two apart.
 */
function classTokens(toks) {
  if (!toks.length) return -1;
  if (/^W[1-4][A-Z]{0,2}$/.test(toks[0])) return 1;
  if (/^[A-Z]{1,3}$/.test(toks[0]) && toks[1] && /^\d+(\.\d+)?$/.test(toks[1])) return 2;
  if (/^[A-Z]{1,3}\d+(\.\d+)?$/.test(toks[0])) return 1;
  return -1;
}

function wellFormed(raw) {
  const s = String(raw).toUpperCase().replace(/\.(?=[A-Z])/g, ' ').trim();
  const toks = joinVolumeTokens(s.split(/\s+/).filter(Boolean));
  const cls = classTokens(toks);
  if (cls < 0) return false;
  const rest = toks.slice(cls);
  if (!rest.length || !isCut(rest[0])) return false;
  return rest.slice(1).every((t) => isCut(t) || TRAIL.test(t));
}

/* ── comparator + lookup (ported; do not tune) ──────────────────────────── */

function parseCN(raw) {
  const s = String(raw || '').toUpperCase().replace(/\*/g, '').replace(/\.(?=[A-Z])/g, ' ');
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
  if (!a) return -1;
  if (!b) return 1;
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

const scheme = (cn) => (/^\s*W[1-4]([A-Z]|\b)/i.test(cn || '') ? 'w1' : 'nlm');

// Level 9 is Special Collections: seventeen faces running `A` to `ZWZ 330`, so it contains
// almost every call number in the building. Including it here and then taking the lowest level
// routed every level-10 and level-11 book to level 9 — all of both floors. It is excluded from
// routing, exactly as the catalog lookup already excluded it.
function makeLocator(DATA) {
  return function locate(cn) {
    const qs = scheme(cn);
    const hits = [];
    for (const key in DATA) {
      const d = DATA[key];
      if (key.startsWith('9|')) continue;
      if (!d.start || !d.end || scheme(d.start) !== qs) continue;
      if (cmpCN(cn, d.start) >= 0 && cmpCN(cn, d.end) <= 0) {
        const [lvl, id, side] = key.split('|');
        hits.push({ key, lvl: +lvl, id, side });
      }
    }
    hits.sort((a, b) => (a.lvl !== b.lvl ? a.lvl - b.lvl : (a.key < b.key ? -1 : 1)));
    return hits[0] || null;
  };
}

/* ── resolve ────────────────────────────────────────────────────────────── */

const MIN_CONFIDENCE = 0.4;   // CallNumberRecognizer.minConfidence

/**
 * Walk the ranked candidates and take the first reading that obeys the grammar.
 *
 * Both readings of ONE candidate are tried before moving to the next candidate, so a repair
 * never outranks a higher-confidence candidate that reads cleanly on its own.
 *
 * Accepts `["text", …]` or `[{text, confidence}, …]`.
 */
function makeResolver(DATA) {
  const locate = makeLocator(DATA);
  return function resolve(candidates) {
    for (const c of candidates || []) {
      const text = typeof c === 'string' ? c : c.text;
      const confidence = typeof c === 'string' ? 1 : c.confidence;
      if (confidence < MIN_CONFIDENCE) continue;
      for (const reading of readings(text)) {
        for (const found of matches(reading)) {
          if (!parseCN(found).length) continue;
          if (!wellFormed(found)) continue;
          const hit = locate(found);
          return hit ? { state: 'located', cn: found, hit } : { state: 'unlocated', cn: found };
        }
      }
    }
    return null;
  };
}

module.exports = {
  PATTERNS, VOL, MIN_CONFIDENCE,
  normalize, matches, extract, repairConfusable, readings,
  CUTTER, A1FORM, TRAIL, joinVolumeTokens, classTokens, wellFormed,
  parseCN, cmpSeg, cmpCN, scheme,
  makeLocator, makeResolver,
};
