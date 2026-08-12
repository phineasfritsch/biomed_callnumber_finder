// Named cases through the FULL recognizer pipeline, exactly as the Swift now stands:
//   normalize -> repair -> extract -> parse -> isWellFormed -> locate, over ranked candidates.
//
//   node ios/Tools/pipeline.js biomed-shelf-ranges.json
//
// The model lives in recognizer.js and is shared with replay.js and confusable.test.js. Dataset-
// scale proof of the O/0 rule is in confusable.test.js; this file is the readable list of what
// the pipeline is supposed to do with a handful of real inputs.
const fs = require('fs');
const path = require('path');
const R = require('./recognizer.js');

const rangesPath = process.argv[2] || path.join(__dirname, '..', '..', 'biomed-shelf-ranges.json');
const resolve = R.makeResolver(JSON.parse(fs.readFileSync(rangesPath, 'utf8')));

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

  // ── O read as zero. `JO` is a large cutter block on this collection and `J0` does not exist,
  // so every one of these used to route to a shelf the book is not on. See recognizer.js.
  { name: 'JO read as J0 (stacked, as Vision returns it)',
    cands: ['Biomed\nW1\nJ0506\nno.66\n1984'],
    want: 'LOCATED W1 JO506 NO.66 1984 -> L3 top-0/single' },
  { name: 'JO read as J0, bare',
    cands: ['W1 J0955'], want: 'LOCATED W1 JO955 -> L3 top-14/right' },
  { name: 'JO read as J0, with a suffix letter',
    cands: ['W1 J0551V'], want: 'LOCATED W1 JO551V -> L3 bot-2/left' },
  { name: 'a clean read outranks a repair of a later candidate',
    cands: ['W1 NA388 no.66 1984', 'W1 J0506'],
    want: 'LOCATED W1 NA388 NO.66 1984 -> L2 top-5/right' },
  { name: 'O between digits is left alone (jammed double cutters are real)',
    cands: ['W1 NA3O8'], want: 'nil' },
];

let fails = 0;
for (const c of cases) {
  const r = resolve(c.cands);
  const got = !r ? 'nil'
    : r.state === 'located' ? `LOCATED ${r.cn} -> L${r.hit.lvl} ${r.hit.id}/${r.hit.side}`
    : `UNLOCATED ${r.cn}`;
  const ok = got === c.want;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(52)} => ${got}${ok ? '' : `\n       want: ${c.want}`}`);
}
console.log(fails === 0 ? '\nall pass' : `\n${fails} FAILING`);
process.exit(fails === 0 ? 0 : 1);
