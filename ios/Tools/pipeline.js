// Simulate the FULL Swift recognizer pipeline exactly as it now stands:
//   extract -> parse -> isWellFormed -> locate, over ranked candidates.
// Mirrors CallNumberRecognizer.resolve + CallNumber.isWellFormed + Router.locate.
const fs = require('fs');
const DATA = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function parseCN(raw) {
  let s = (raw || '').toUpperCase().replace(/\*/g, '');
  s = s.replace(/\.(?=[A-Z])/g, ' ');
  const toks = s.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  let classAlpha, classNum = 0, rest = toks.slice(1);
  if (/^W[1-4][A-Z]{0,2}$/.test(toks[0])) { classAlpha = toks[0]; }
  else {
    const m0 = toks[0].match(/^([A-Z]+)(\d+\.?\d*)?(.*)$/);
    if (m0) {
      classAlpha = m0[1];
      if (m0[2]) classNum = parseFloat(m0[2]);
      if (m0[3]) rest = [m0[3]].concat(rest);
    } else classAlpha = toks[0];
    if (!classNum && rest.length && /^\d+\.?\d*$/.test(rest[0])) { classNum = parseFloat(rest[0]); rest = rest.slice(1); }
  }
  out.push({ t: 'A', a: classAlpha });
  out.push({ t: 'N', n: classNum });
  rest.forEach(t => {
    const mm = t.match(/^([A-Z]+)(\d*)([A-Z]*)$/);
    if (mm) { const d = mm[2] ? parseFloat('0.' + mm[2]) : 0; out.push({ t: 'C', a: mm[1], n: d, s: mm[3] }); }
    else out.push({ t: 'C', a: t, n: 0, s: '' });
  });
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

// --- CallNumber.isWellFormed ---
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

// --- CallNumberRecognizer.extract ---
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

// --- CallNumberRecognizer.resolve ---
function resolve(candidates) {
  for (const c of candidates) {
    for (const text of extract(c)) {
      if (!parseCN(text).length) continue;
      if (!wellFormed(text)) continue;
      const hit = locate(text);
      return hit ? { state: 'located', cn: text, hit } : { state: 'unlocated', cn: text };
    }
  }
  return null;
}

const cases = [
  { name: 'real label (stacked, as Vision returns it)',
    cands: ['Biomed\nW1\nNA388\nno.66\n1984'],
    want: 'LOCATED W1 NA388 NO.66 1984 -> L2 top-5/right' },
  { name: 'ranked: corrupt top pick, truth third',
    cands: ['Biomed W1 NA3B8 no.66 1984', 'Photochemotherapeutic Aspects of', 'Biomed W1 NA388 no.66 1984'],
    want: 'LOCATED W1 NA388 NO.66 1984 -> L2 top-5/right' },
  { name: 'scheme-flip misread (must NOT reach L9)',
    cands: ['Biomed WI NA388 no.66 1984'], want: 'nil' },
  { name: 'spine title noise only',
    cands: ['Photochemotherapeutic Aspects of Psoriasis'], want: 'nil' },
  { name: 'title + label in one frame',
    cands: ['Photochemotherapeutic Aspects\nBiomed W1 NA388 no.66 1984'],
    want: 'LOCATED W1 NA388 NO.66 1984 -> L2 top-5/right' },
  { name: 'NLM label',
    cands: ['WM 13 D5537'], want: 'LOCATED WM 13 D5537 -> L8 bot-3/right' },
  { name: 'jammed double cutter (real)',
    cands: ['W1 A1C7'], want: 'LOCATED W1 A1C7 -> L7 top-0/single' },
  { name: 'well-formed nonsense (grammar cannot reject; OCR never emits it)',
    cands: ['W1 ZZZ999 no.1 1900'], want: 'LOCATED W1 ZZZ999 NO.1 1900 -> L1 top-14/left' },
];

let fails = 0;
for (const c of cases) {
  const r = resolve(c.cands);
  const got = !r ? 'nil'
    : r.state === 'located' ? `LOCATED ${r.cn} -> L${r.hit.lvl} ${r.hit.id}/${r.hit.side}`
    : `UNLOCATED ${r.cn}`;
  const ok = got === c.want;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(42)} => ${got}${ok ? '' : `\n       want: ${c.want}`}`);
}
console.log(fails === 0 ? '\nall pass' : `\n${fails} FAILING`);
