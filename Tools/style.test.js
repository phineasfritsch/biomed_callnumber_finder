// House style, checked mechanically where that is possible.
//
//   node Tools/style.test.js            # report and fail on regressions
//   node Tools/style.test.js --list     # every offending line, for working through a file
//
// The rules this can actually enforce:
//
//   * No em dashes in prose.
//   * No filler openers ("In today's fast-paced world", "It is worth noting that").
//   * No false contrasts ("not just X, it's Y", "isn't about X, it's about Y").
//   * No marching rhythm: three consecutive sentences of near-identical length.
//
// The rules it cannot: whether a sentence restates the one before it, and whether a closing
// paragraph is a real conclusion or a summary of what you just read. Those need eyes.
//
// Scope is prose the reader sees: the site's visible copy, the app's user-facing strings, and the
// documentation. Code comments are excluded, which is a decision rather than an oversight; a
// comment is an argument aimed at whoever is about to change the line under it, and the rules
// above are about published prose.
//
// BUDGETS below record what each file was carrying when the rule was adopted. A file at its
// budget is not clean, it is queued. Lower the number as you work through it; the test fails if a
// count goes back up.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIST = process.argv.includes('--list');

// Files whose prose is not yet rewritten, and what they held when measured. Drive these to 0.
const BUDGETS = {
  'README.md': 57,
  'CATALOG.md': 72,
  'ENDPOINTS.md': 30,
  'SEARCH-REPORT.md': 3,
  'ios/DESIGN.md': 80,
};

const DOCS = [
  'README.md', 'CATALOG.md', 'ENDPOINTS.md', 'SEARCH-REPORT.md',
  'ios/README.md', 'ios/DESIGN.md', 'ios/TESTING.md',
  // The operator docs are held to the same rules as everything else, with no budget. A house
  // style that the house's own operating manual is exempt from is a preference, not a rule.
  'OPERATIONS.md', 'ops/QUEUE.md',
];
const PAGES = [
  'index.html', 'about.html', 'hours.html', 'databases.html',
  'methodology.html', 'map.html', '404.html',
];

let pass = 0, fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
}

/** Visible page copy: markup with script, style and comments removed. */
function visibleCopy(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/** Markdown prose: fenced code and inline code dropped, since those are not writing. */
function prose(md) {
  return md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

/* ── em dashes ──────────────────────────────────────────────────────────── */

console.log('em dashes in prose');

const EM = '—';
// HTML writes the same character three ways, and the first draft of this test only looked for
// one of them. about.html read as clean while carrying four `&mdash;`.
const ANY_EM = /—|&mdash;|&#8212;|&#x2014;/gi;
let queued = 0;

function countEm(label, text, budget) {
  const lines = text.split('\n');
  const hits = [];
  lines.forEach((l, i) => { if (l.match(ANY_EM)) hits.push([i + 1, l.trim()]); });
  const n = hits.reduce((a, [, l]) => a + (l.match(ANY_EM) || []).length, 0);

  if (budget === undefined) {
    ok(n === 0, `${label} is free of em dashes`,
      hits.slice(0, 4).map(([i, l]) => `${i}: ${l.slice(0, 100)}`).join('\n       '));
  } else {
    queued += n;
    ok(n <= budget, `${label} is at or under its budget of ${budget}`, `now ${n}`);
    if (n < budget) {
      console.log(`  (${label}: ${n} left, down from ${budget} — lower the budget in this file)`);
    }
  }
  if (LIST && n) {
    console.log(`\n  --- ${label} (${n}) ---`);
    hits.forEach(([i, l]) => console.log(`  ${i}: ${l}`));
  }
  return n;
}

for (const f of PAGES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const text = visibleCopy(fs.readFileSync(p, 'utf8'));
  // Page titles use an em dash as a delimiter ("Library hours — Shelfmark"). That is a separator
  // between two names, not a sentence, and changing it would rewrite every tab, OG card and
  // shared link. Excluded deliberately.
  const body = text.replace(/<title>[^<]*<\/title>/g, '').replace(/<meta[^>]*>/g, '');
  countEm(f, body, BUDGETS[f]);
}

for (const f of DOCS) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  countEm(f, prose(fs.readFileSync(p, 'utf8')), BUDGETS[f]);
}

// The app's user-facing strings. Three bare "—" survive as placeholders meaning "no value"; a
// lone glyph in a table cell is not prose, and one of them is pinned by a golden fixture.
{
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.swift')) files.push(p);
    }
  })(path.join(ROOT, 'ios', 'BiomedShelfScanner'));

  const offenders = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      for (const m of line.matchAll(/"([^"]*)"/g)) {
        const s = m[1];
        if (s.includes(EM) && s.trim() !== EM) {
          offenders.push(`${path.relative(ROOT, f)}:${i + 1}: ${s.slice(0, 90)}`);
        }
      }
    });
  }
  ok(offenders.length === 0, 'the app\'s user-facing strings are free of em dashes',
    offenders.slice(0, 6).join('\n       '));
}

/* ── openers, false contrasts, restatement ──────────────────────────────── */

console.log('\nfiller openers and false contrasts');

const BANNED = [
  [/\bIn today's [a-z-]+ world\b/i, "\"In today's ... world\""],
  [/\bIn an era (of|where)\b/i, '"In an era of/where"'],
  [/\bIt('s| is) worth noting that\b/i, '"It is worth noting that"'],
  [/\bAt the end of the day\b/i, '"At the end of the day"'],
  [/\bWhen it comes to\b/i, '"When it comes to"'],
  [/\bIt('s| is) important to (note|remember|understand)\b/i, '"It is important to note"'],
  [/\bnot just [^.,;]{2,40}, (it'?s|but) /i, 'a false contrast ("not just X, it\'s Y")'],
  [/\bisn'?t (just )?about [^.,;]{2,40}, it'?s about\b/i, 'a false contrast ("isn\'t about X, it\'s about Y")'],
  [/\bIn conclusion\b/i, '"In conclusion"'],
  [/\bIn summary\b/i, '"In summary"'],
  [/\bTo sum up\b/i, '"To sum up"'],
];

for (const f of [...DOCS, ...PAGES]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const raw = fs.readFileSync(p, 'utf8');
  const text = f.endsWith('.html') ? visibleCopy(raw) : prose(raw);
  for (const [rx, what] of BANNED) {
    const m = text.match(rx);
    ok(!m, `${f} avoids ${what}`, m ? `found ${JSON.stringify(m[0])}` : undefined);
  }
}

/* ── marching rhythm ────────────────────────────────────────────────────── */

console.log('\nsentence rhythm');

// Three sentences in a row within 15% of each other's length read as a drum. This is a blunt
// instrument and it only looks at documentation prose, where paragraphs are long enough for the
// measure to mean anything.
function marching(text) {
  const paras = text.split(/\n\s*\n/);
  const runs = [];
  for (const para of paras) {
    const p = para.trim();
    if (p.startsWith('#') || p.startsWith('|') || p.startsWith('-') || p.startsWith('*')) continue;
    if (p.startsWith('>') || p.length < 200) continue;
    const sentences = p.replace(/\n/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim()).filter((s) => s.length > 25);
    for (let i = 0; i + 2 < sentences.length; i++) {
      const [a, b, c] = [sentences[i].length, sentences[i + 1].length, sentences[i + 2].length];
      const lo = Math.min(a, b, c), hi = Math.max(a, b, c);
      if (hi - lo <= hi * 0.15) runs.push(sentences[i].slice(0, 70));
    }
  }
  return runs;
}

for (const f of ['ios/README.md', 'ios/TESTING.md', 'ios/DESIGN.md']) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const runs = marching(prose(fs.readFileSync(p, 'utf8')));
  ok(runs.length === 0, `${f}: no three consecutive sentences of the same length`,
    runs.slice(0, 3).map((r) => `starting "${r}…"`).join('\n       '));
}

if (queued) {
  console.log(`\n${queued} em dashes still queued across the budgeted files.`);
  console.log('Run with --list to work through one.');
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
