// Shelf order, in JavaScript. Keep in lockstep with `Models/ShelfOrder.swift` — this is the
// model the offline tools reason about (TESTING.md §3), and shelf reading is the one feature
// whose failures accuse a real book of being in the wrong place. It has to be exact.
//
// Mirrors, in order:
//   ShelfOrder.ShelfKey / splitTrailers  -> parseKey
//   ShelfOrder.compare                   -> cmpKey
//   ShelfOrder.longestNonDecreasing      -> longestNonDecreasing
//   ShelfOrder.judge                     -> judge
//   ShelfOrder.inferFace                 -> inferFace
//
// ── Why this file exists at all ────────────────────────────────────────────────────────────
//
// `CallNumber.compare` cannot order volumes, and a Biomed serials face is mostly one title with
// many bound volumes. Measured against the shipping comparator:
//
//   "W1 NA388 NO.9"  vs "W1 NA388 NO.10"  ->  1   (want -1)
//   "W1 NA388 NO.66" vs "W1 NA388 NO.7"   -> -1   (want  1)
//   "W1 NA388 V.9"   vs "W1 NA388 V.10"   ->  1   (want -1)
//
// Two different causes, one per spelling. `NO.66` fails `CallNumber`'s cutter regex (the dot),
// falls through to the catch-all branch, and is compared as a *lexical string* — so "NO.10"
// sorts before "NO.9". And when OCR drops the dot, `NO66` *does* match, becomes a decimal
// cutter `0.66`, and sorts before `NO7` = `0.7`. All three spellings a label can produce
// (`NO.66`, `NO66`, `NO 66`) are wrong, and they are wrong differently.
//
// Feeding a serials shelf through a longest-subsequence check with that comparator flags most of
// the shelf. So trailers are parsed out and compared as integers here.
//
// **`CallNumber` and `Router` are deliberately not touched.** Routing rests on that comparator
// and it is golden-tested against 651 endpoints; only one of those endpoints (`W4C Z89P 2009`)
// even carries a trailer, so there is nothing to gain there and a working router to lose. New
// behaviour lives with the new feature.

'use strict';

const { TRAIL, joinVolumeTokens, classTokens, wellFormed, cmpCN, scheme } = require('./recognizer');

/* ── trailers ───────────────────────────────────────────────────────────── */

// Kind ranks. Only consulted when two spines carry different trailer kinds in the same position,
// which is a mixed-shelf fallback rather than a real ordering claim — but it has to be
// deterministic, because Swift and JS must agree on every pair.
const KIND = { NO: 0, V: 1, PT: 2, YEAR: 3, OTHER: 4 };

function parseTrailer(t) {
  let m;
  if ((m = t.match(/^NO\.?(\d+)([A-Z]?)$/))) return { k: KIND.NO, n: +m[1], s: m[2] || '' };
  if ((m = t.match(/^V\.?(\d+)$/))) return { k: KIND.V, n: +m[1], s: '' };
  if ((m = t.match(/^PT\.?(\d+)$/))) return { k: KIND.PT, n: +m[1], s: '' };
  if ((m = t.match(/^((?:18|19|20)\d{2})([A-Z]?)$/))) return { k: KIND.YEAR, n: +m[1], s: m[2] || '' };
  return { k: KIND.OTHER, n: 0, s: t };
}

/**
 * Split a call number into an ordering base and its trailing volume/year tokens.
 *
 * The base is what `CallNumber.compare` is good at; the trailers are what it is not. Tokenizing
 * matches `wellFormed` exactly (uppercase, a dot before a letter becomes a space) so the two
 * cannot disagree about where a token starts.
 */
function parseKey(raw) {
  const s = String(raw || '').toUpperCase().replace(/\*/g, '').replace(/\.(?=[A-Z])/g, ' ').trim();
  // "NO 66" is the third spelling OCR produces and it arrives as two tokens. Rejoin it before
  // anything else looks at the list, using the grammar's own helper so the two cannot disagree.
  const toks = joinVolumeTokens(s.split(/\s+/).filter(Boolean));
  if (!toks.length) return { base: '', trailers: [], raw: String(raw || '') };

  /* Trailers are a suffix run, never the whole call number, and — the part a token count cannot
     express — never the *cutter*. `TRAIL` cannot tell a volume from a cutter, because it has no
     way to: `V3315` and `NO52` are both legal cutter blocks and both legal volume tokens, and
     which one they are depends only on the position they sit in.

     The old floor of 2 read that position by counting, which is right for `W1 NA388` (a one-token
     class) and wrong for every NLM number, whose class is two tokens. `WK 835 V3315` is a real
     range endpoint; its cutter was stripped and re-compared as the integer 3315, which sorts after
     `V44` where the shelf puts .3315 before .44. A correctly shelved row of them was reported as a
     volume break — the exact failure this file's header says must never happen.

     Asking the grammar where the class ends gives the cutter its own token, and only what follows
     the cutter can be a trailer. */
  const cls = classTokens(toks);
  const floor = cls < 0 ? 2 : cls + 1;          // class + cutter, kept out of reach
  const trailers = [];
  while (toks.length > floor && TRAIL.test(toks[toks.length - 1])) {
    trailers.unshift(parseTrailer(toks.pop()));
  }
  return { base: toks.join(' '), trailers, raw: String(raw || '') };
}

function cmpTrailer(a, b) {
  if (!a) return b ? -1 : 0;   // a missing trailer sorts first: "W1 NA388" precedes "W1 NA388 no.66"
  if (!b) return 1;
  if (a.k !== b.k) return a.k < b.k ? -1 : 1;
  if (a.n !== b.n) return a.n < b.n ? -1 : 1;
  if (a.s !== b.s) return a.s < b.s ? -1 : 1;
  return 0;
}

/** -1 / 0 / 1, the shelf order of two parsed keys. */
function cmpKey(a, b) {
  const c = cmpCN(a.base, b.base);
  if (c !== 0) return c;
  const n = Math.max(a.trailers.length, b.trailers.length);
  for (let i = 0; i < n; i++) {
    const t = cmpTrailer(a.trailers[i], b.trailers[i]);
    if (t !== 0) return t;
  }
  return 0;
}

/** Whether two keys are the same serial run — same class, same cutter, trailers aside. */
const sameRun = (a, b) => cmpCN(a.base, b.base) === 0;

/** Whether two keys carry the same *shape* of trailer, so comparing them means something. */
const sameTrailerShape = (a, b) =>
  a.trailers.length === b.trailers.length &&
  a.trailers.every((t, i) => t.k === b.trailers[i].k);

/* ── longest non-decreasing subsequence ─────────────────────────────────── */

/**
 * Indices of one longest non-decreasing subsequence, by patience sorting. O(n log n).
 *
 * Non-*de*creasing rather than strictly increasing because duplicate copies of the same book sit
 * side by side legitimately and must not be read as a misfile.
 *
 * Why a subsequence rather than adjacent-pair comparison: pairwise mis-blames. In `A B F D E` the
 * pair (F, D) is out of order, which accuses D as loudly as it accuses F. The subsequence is
 * `A B D E`, so the one book outside it — F — is the one that moved.
 */
function longestNonDecreasing(keys) {
  const tails = [];                              // tails[l] = index of the smallest tail of a run of length l+1
  const prev = new Array(keys.length).fill(-1);
  for (let i = 0; i < keys.length; i++) {
    let lo = 0, hi = tails.length;
    while (lo < hi) {                            // upper bound: first tail strictly greater than keys[i]
      const mid = (lo + hi) >> 1;
      if (cmpKey(keys[tails[mid]], keys[i]) <= 0) lo = mid + 1; else hi = mid;
    }
    prev[i] = lo > 0 ? tails[lo - 1] : -1;
    tails[lo] = i;
  }
  const out = new Set();
  let k = tails.length ? tails[tails.length - 1] : -1;
  while (k >= 0) { out.add(k); k = prev[k]; }
  return out;
}

/* ── the judge ──────────────────────────────────────────────────────────── */

const OK = 'ok';
const OUT_OF_ORDER = 'outOfOrder';
const WRONG_SHELF = 'wrongShelf';
const VOLUME_BREAK = 'volumeBreak';
const UNKNOWN = 'unknown';          // no label, unreadable, or off-scheme — excluded, never guessed
const UNANCHORED = 'unanchored';    // read, but not attributable to one physical book

const MIN_SPINES = 3;               // two books cannot tell you which of them is wrong

/* Mirrors `ShelfOrder.schemeRank` in the Swift. The tally below has to break an exact tie the same
   way in both twins, and keying it by the strings 'w1'/'nlm' did not: ascending by name puts
   'nlm' first, ascending by rank puts w1 first, and the two implementations excluded opposite
   halves of a face that straddles the W1-serials / NLM-monograph boundary. Ranked, and w1 wins the
   tie in both — Biomed's stacks are mostly W1 serials, which is the shelf this app is for. */
const SCHEME_RANK = { w1: 0, nlm: 1 };

/**
 * Per-spine verdicts for one frame. Pure: no camera, no Vision, no temporal state — stability is
 * the tracker's job, not this function's.
 *
 * @param spines  in shelf order (left to right, or top to bottom for a flat stack). Each is
 *                `{ cn, anchored = true, edge = false }`, where `cn` is the resolved call-number
 *                string or null.
 * @param opts    `{ expected, search }` — the shelf face the reader is standing at, and a
 *                `search(cn) -> [{lvl,id,side}]` returning every face containing a call number.
 */
function judge(spines, opts) {
  opts = opts || {};
  const expected = opts.expected || null;
  const search = opts.search || null;

  const out = spines.map(() => ({ verdict: OK }));
  const keys = spines.map(() => null);

  // 1. Who is even eligible to be judged.
  const readable = [];
  for (let i = 0; i < spines.length; i++) {
    const sp = spines[i] || {};
    if (sp.anchored === false) { out[i].verdict = UNANCHORED; continue; }
    if (!sp.cn || !wellFormed(sp.cn)) { out[i].verdict = UNKNOWN; continue; }
    keys[i] = parseKey(sp.cn);
    readable.push(i);
  }

  // 2. Cross-scheme comparison is meaningless (`Router` gates on it), so a lone NLM book on a W1
  //    shelf is excluded rather than declared a misfile — the comparator has nothing to say.
  if (readable.length) {
    const tally = {};
    readable.forEach(i => { const s = scheme(spines[i].cn); tally[s] = (tally[s] || 0) + 1; });
    const modal = Object.keys(tally)
      .sort((a, b) => tally[b] - tally[a] || SCHEME_RANK[a] - SCHEME_RANK[b])[0];
    for (let j = readable.length - 1; j >= 0; j--) {
      const i = readable[j];
      if (scheme(spines[i].cn) !== modal) { out[i].verdict = UNKNOWN; keys[i] = null; readable.splice(j, 1); }
    }
  }

  // 3. Class (b), wrong shelf. Needs no neighbours and no ordering, so unlike the order verdicts
  //    it applies at the frame edges too — a half-cropped spine still knows what floor it is on.
  //    `search`, not `locate`: `locate` returns only the lowest containing face, and 237 of 651
  //    endpoints sit on a seam contained by two faces, so judging with it would flag whole serial
  //    runs. An empty result is `unknown`, never `wrongShelf` — Reference and unmapped stacks
  //    exist and this app does not know about them.
  if (expected && search) {
    for (const i of readable) {
      // Searched on the base, never the raw call number, and `inferFace` below does the same.
      // The two disagree about 1224 of the 1600 volume call numbers the range data can build:
      // `W1 DE244 no.1` is contained by one face and `W1 DE244` by two, so a run judged on raw
      // numbers can straddle a face boundary and report half of itself as misfiled. The run's
      // shelf position is the base's, and every volume of it has to get the same answer.
      const faces = search(keys[i].base) || [];
      if (!faces.length) continue;
      if (!faces.some(f => sameFace(f, expected))) {
        out[i] = { verdict: WRONG_SHELF, faces, belongs: faces[0] };
      }
    }
  }

  // 4. Classes (a) and (c), order within the shelf.
  if (readable.length >= MIN_SPINES) {
    const seq = readable.map(i => keys[i]);
    const lis = longestNonDecreasing(seq);

    for (let j = 0; j < readable.length; j++) {
      if (lis.has(j)) continue;
      const i = readable[j];
      if (out[i].verdict === WRONG_SHELF) continue;      // carry it away beats move it a slot

      // The true neighbour of the first or last readable book is off-frame, and a shelf boundary
      // is indistinguishable from a misfile. Same for a column at the edge of the frame, which is
      // also physically half-cropped.
      if (j === 0 || j === readable.length - 1) continue;
      if (spines[i].edge) continue;

      // Anchored-interval test. `L` and `R` are the nearest books we have positive evidence are
      // in the right place; flag only if this one does not belong between them. This is what
      // stops `A B F D E` from accusing D as well as F.
      let l = j - 1; while (l >= 0 && !lis.has(l)) l--;
      let r = j + 1; while (r < readable.length && !lis.has(r)) r++;
      if (l < 0 || r >= readable.length) continue;
      const L = seq[l], R = seq[r], me = seq[j];
      if (cmpKey(me, L) >= 0 && cmpKey(me, R) <= 0) continue;

      /* A trailer *kind* mismatch inside one run is not evidence of anything. `KIND` exists to
         keep the order total, not to claim that every `no.3` precedes every `1984`, and within a
         run the spelling varies spine by spine for reasons that have nothing to do with where the
         book sits: OCR resolves the volume line on one label and only the year on its neighbour.
         Ranking those against each other put a correctly shelved book outside the subsequence and
         then accused it — as `outOfOrder`, the verdict that says carry it away, because
         `sameTrailerShape` failed and the softer `volumeBreak` branch was never reached. The guard
         written to soften the message was escalating it.

         Scoped to one run on purpose. When the base differs the book really is from another title
         and the misfile is real, so that case still gets flagged below. */
      if (sameRun(me, L) && sameRun(me, R) &&
          !(sameTrailerShape(me, L) && sameTrailerShape(me, R))) continue;

      // (c) rather than (a) when the whole neighbourhood is one serial run and only the volume
      // sequence broke. Same detection, different message and different action: a volume break
      // means the book is on the right face in the wrong slot, not that it should be carried away.
      const volume = sameRun(me, L) && sameRun(me, R) &&
        sameTrailerShape(me, L) && sameTrailerShape(me, R) && me.trailers.length > 0;
      out[i] = { verdict: volume ? VOLUME_BREAK : OUT_OF_ORDER, after: L.raw, before: R.raw };
    }
  }

  return out;
}

const sameFace = (a, b) => a && b && +a.lvl === +b.lvl && a.id === b.id && a.side === b.side;

/* ── which shelf am I standing at ───────────────────────────────────────── */

/**
 * The shelf face most of these books agree on, or null.
 *
 * Asking the reader to pick a face before every shelf is a setup tax nobody pays twice, and the
 * inference is the detector anyway: if seven books say L2/top-5/right and one says L4, the odd one
 * out is the misfile. Each book votes once per face it could be on, so a book on a seam does not
 * out-vote a book that is only on one face.
 */
function inferFace(callNumbers, search, opts) {
  opts = opts || {};
  // `??`, not `||`: a caller asking for no floor at all means it, and `|| 3` silently rewrote 0
  // to 3. The Swift twin takes these as real default arguments, so `||` also made the two
  // disagree for any caller that passed one.
  const minSpines = opts.minSpines ?? 3;
  const minAgreement = opts.minAgreement ?? 0.6;

  // Bases, for the reason `judge` searches on them: a face inferred from raw volume numbers and a
  // wrong-shelf verdict computed from bases are answers to two different questions, and this
  // function's guess is what that verdict is then measured against.
  const readable = callNumbers.filter(cn => cn && wellFormed(cn)).map(cn => parseKey(cn).base);
  if (readable.length < minSpines) return null;

  const tally = new Map();
  for (const cn of readable) {
    for (const f of (search(cn) || [])) {
      const k = `${f.lvl}|${f.id}|${f.side}`;
      tally.set(k, (tally.get(k) || 0) + 1);
    }
  }
  if (!tally.size) return null;

  const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  if (best[1] / readable.length < minAgreement) return null;
  const [lvl, id, side] = best[0].split('|');
  return { lvl: +lvl, id, side, agree: best[1], of: readable.length };
}

module.exports = {
  KIND, parseTrailer, parseKey, cmpTrailer, cmpKey, sameRun, sameTrailerShape,
  longestNonDecreasing, judge, inferFace, sameFace,
  OK, OUT_OF_ORDER, WRONG_SHELF, VOLUME_BREAK, UNKNOWN, UNANCHORED, MIN_SPINES,
};
