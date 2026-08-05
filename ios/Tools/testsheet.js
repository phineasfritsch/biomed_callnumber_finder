// Generate a printable sheet of real spine labels for bench-testing the scanner.
//
//   node ios/Tools/testsheet.js biomed-shelf-ranges.json ios/Tools/test-labels.html
//
// Why: the build loop is slow and the stacks are not at your desk. Print this, tape it to a shelf
// edge or just hold it, and you can exercise the whole scan path — including the cases that are
// *supposed* to fail — without walking anywhere. Every call number here is real and comes from the
// live dataset, so the expected shelf is the true answer, not a guess.

const fs = require('fs');
const [, , rangesPath, outPath] = process.argv;
if (!rangesPath || !outPath) {
  console.error('usage: node testsheet.js <biomed-shelf-ranges.json> <out.html>');
  process.exit(2);
}
const DATA = JSON.parse(fs.readFileSync(rangesPath, 'utf8'));

// --- comparator (same as everywhere else) ---
function parseCN(raw) {
  let s = (raw || '').toUpperCase().replace(/\*/g, '').replace(/\.(?=[A-Z])/g, ' ');
  const toks = s.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!toks.length) return [];
  const out = []; let classAlpha, classNum = 0, rest = toks.slice(1);
  if (/^W[1-4][A-Z]{0,2}$/.test(toks[0])) classAlpha = toks[0];
  else {
    const m0 = toks[0].match(/^([A-Z]+)(\d+\.?\d*)?(.*)$/);
    if (m0) { classAlpha = m0[1]; if (m0[2]) classNum = parseFloat(m0[2]); if (m0[3]) rest = [m0[3]].concat(rest); }
    else classAlpha = toks[0];
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
// Level 9 is Special Collections: seventeen faces running `A` to `ZWZ 330`, so it
// contains almost every call number in the building. Including it here and then taking
// the lowest level routed every level-10 and level-11 book to level 9 -- all of both
// floors. It is excluded from routing, exactly as the catalog lookup already excluded it.
function locate(cn) {
  const hits = [];
  for (const key in DATA) {
    const d = DATA[key];
    if (key.startsWith('9|')) continue;
    if (!d.start || !d.end || scheme(d.start) !== scheme(cn)) continue;
    if (cmpCN(cn, d.start) >= 0 && cmpCN(cn, d.end) <= 0) {
      const [lvl, id, side] = key.split('|');
      hits.push({ key, lvl: +lvl, id, side });
    }
  }
  hits.sort((a, b) => a.lvl !== b.lvl ? a.lvl - b.lvl : (a.key < b.key ? -1 : 1));
  return hits[0] || null;
}

// --- pick labels ---
const endpoints = new Set();
for (const v of Object.values(DATA)) { if (v.start) endpoints.add(v.start); if (v.end) endpoints.add(v.end); }
const all = [...endpoints];

const picked = [];
const add = (cn, note) => { if (!picked.some(p => p.cn === cn)) picked.push({ cn, note }); };

// The label from the original photo — the canonical smoke test.
add('W1 NA388 no.66 1984', 'the original photo');

// Forms that stress specific parts of the grammar.
add(all.find(c => /^W1 A1[A-Z]/.test(c)), 'jammed double cutter');
add(all.find(c => /^W1 [A-Z]{2}\d+[A-Z]{2}$/.test(c)), 'two-letter suffix');
add(all.find(c => /^W1 [A-Z]{2}\d+[A-Z]$/.test(c)), 'one-letter suffix');
add(all.find(c => /^W[234]/.test(c)), 'W2–W4 prefix');
add(all.find(c => /^W[A-Z] \d+ /.test(c)), 'NLM class + number');
add(all.find(c => /\d\.\d/.test(c)), 'decimal class number');

// A spread across floors, so a full pass exercises multi-floor routing.
//
// Two traps here, both learned the hard way from the first version of this script:
//  * Degenerate endpoints like the bare "A" must not land in the happy-path group — they belong
//    in the reject group below.
//  * The level a call number is *stored under* is not necessarily the level `locate` returns.
//    `locate` yields the LOWEST matching floor and ranges do repeat across floors, mostly at
//    seams, so label the card with the resolved level or the sheet tells you to expect the
//    wrong answer. This used to say a level-11 label could "legitimately resolve to level 9";
//    it could not. That was the Special Collections bug — level 9 spans the whole alphabet and
//    swallowed every level-10 and level-11 book — and `locate` now excludes it.
const seenResolved = new Set();
const bySourceLevel = {};
for (const [key, v] of Object.entries(DATA)) {
  const lvl = +key.split('|')[0];
  if (v.start && !bySourceLevel[lvl]) bySourceLevel[lvl] = v.start;
}
for (const lvl of Object.keys(bySourceLevel).map(Number).sort((a, b) => a - b)) {
  const cn = bySourceLevel[lvl];
  if (cn.trim().length < 4) continue;                 // skip degenerate endpoints like "A"
  const hit = locate(cn);
  if (!hit || seenResolved.has(hit.lvl)) continue;    // one card per *resolved* floor
  seenResolved.add(hit.lvl);
  add(cn, `level ${hit.lvl}`);
}

// Known-odd real endpoints: these SHOULD fail the grammar and require manual entry.
// Printing them is the point — you want to see the failure path work, not just the happy path.
const odd = ['A', 'ZWZ 330', 'Q 41 R81R8', 'WC 160 G7.78T', 'BF 789 D4 6456s']
  .filter(c => endpoints.has(c));

const rows = picked.filter(p => p.cn).map(p => {
  const hit = locate(p.cn);
  return { ...p, expect: hit ? `L${hit.lvl} · ${hit.id} · ${hit.side}` : 'not in mapped ranges' };
});

// Render a label the way Biomed actually prints them: one token per line, monospaced.
const labelLines = cn => cn.toUpperCase().split(/\s+/);

const card = (cn, expect, note, expectFail) => `
  <div class="card${expectFail ? ' fail' : ''}">
    <div class="label">
      <div class="collection">Biomed</div>
      ${labelLines(cn).map(l => `<div class="line">${l}</div>`).join('')}
    </div>
    <div class="meta">
      <div class="expect">${expect}</div>
      <div class="note">${note}</div>
    </div>
  </div>`;

const html = `<!doctype html>
<meta charset="utf-8">
<title>Shelf Scanner — test labels</title>
<style>
  @page { size: letter; margin: 12mm; }
  body { font: 12px/1.4 -apple-system, Segoe UI, sans-serif; color: #111; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  p.sub { margin: 0 0 14px; color: #555; font-size: 11px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .card { border: 1px solid #ccc; border-radius: 6px; padding: 8px; break-inside: avoid; }
  .card.fail { border-color: #c66a25; border-style: dashed; }
  /* Mimics the real spine label: white sticker, black monospace, one token per line. */
  .label {
    background: #fff; border: 1px solid #222; border-radius: 3px;
    padding: 6px 8px; font-family: "SF Mono", Consolas, monospace;
    font-size: 15px; font-weight: 600; letter-spacing: 0.4px; line-height: 1.25;
    min-height: 92px;
  }
  .collection { font-size: 11px; font-weight: 400; }
  .meta { margin-top: 6px; font-size: 10px; }
  .expect { font-family: "SF Mono", Consolas, monospace; color: #1a5; }
  .card.fail .expect { color: #c66a25; }
  .note { color: #777; }
  h2 { font-size: 13px; margin: 18px 0 6px; }
</style>
<h1>Shelf Scanner — test labels</h1>
<p class="sub">
  Real call numbers from the live dataset. Print at 100% (no “fit to page” — it changes the glyph size
  the scanner sees). Green = expected shelf. Orange dashed = <b>expected to fail</b> the grammar gate
  and require manual entry; that failure is correct behaviour, not a bug.
</p>

<h2>Should scan and locate</h2>
<div class="grid">
${rows.map(r => card(r.cn, r.expect, r.note, false)).join('')}
</div>

<h2>Should NOT scan — verifies the manual-entry path</h2>
<div class="grid">
${odd.map(c => card(c, 'grammar rejects · type by hand', 'known-odd real endpoint', true)).join('')}
</div>
`;

fs.writeFileSync(outPath, html);
console.log(`wrote ${outPath}`);
console.log(`  ${rows.length} labels expected to locate`);
console.log(`  ${odd.length} labels expected to be rejected`);
for (const r of rows) console.log(`   ${r.cn.padEnd(26)} -> ${r.expect}   (${r.note})`);
