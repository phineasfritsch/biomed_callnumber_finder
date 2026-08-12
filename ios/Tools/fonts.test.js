// The bundled fonts, checked without a compiler.
//
//   node ios/Tools/fonts.test.js
//
// A custom font on iOS fails *silently*. `Font.custom("Fraunces-SemiBold", …)` with no such font
// registered does not throw, does not warn, and does not render wrong — it renders the system
// face, which looks fine and is simply not the design. On a ten-minute build loop with no local
// compiler that is the kind of mistake that survives several rounds before anyone names it.
//
// So this checks the three things that have to line up, by reading the actual files:
//
//   1. Every filename in Info.plist's UIAppFonts exists in Resources/Fonts.
//   2. Every file's PostScript name is the name the Swift asks for. iOS resolves by PostScript
//      name, not by filename, and the two are easy to let drift.
//   3. Every font name the Swift references is one of those files.
//
// Plus a subsetting check: the glyphs the UI actually draws must be in the font, or they fall
// back mid-line to the system face — which reads as a rendering bug.

'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'BiomedShelfScanner');
const FONT_DIR = path.join(APP, 'Resources', 'Fonts');
const PLIST = path.join(APP, 'Info.plist');
const THEME = path.join(APP, 'Views', 'Theme.swift');

let pass = 0, fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
}

/* ── a minimal TrueType name-table reader ───────────────────────────────── */

function fontNames(file) {
  const d = fs.readFileSync(file);
  const numTables = d.readUInt16BE(4);
  let nameOff = null;
  let cmapOff = null;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + 16 * i;
    const tag = d.toString('latin1', rec, rec + 4);
    if (tag === 'name') nameOff = d.readUInt32BE(rec + 8);
    if (tag === 'cmap') cmapOff = d.readUInt32BE(rec + 8);
  }
  if (nameOff === null) throw new Error(`${file}: no name table`);

  const count = d.readUInt16BE(nameOff + 2);
  const strOff = nameOff + d.readUInt16BE(nameOff + 4);
  const names = {};
  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + 12 * i;
    const platform = d.readUInt16BE(r);
    const nameID = d.readUInt16BE(r + 6);
    const len = d.readUInt16BE(r + 8);
    const off = d.readUInt16BE(r + 10);
    const raw = d.subarray(strOff + off, strOff + off + len);
    // Platform 3 strings are UTF-16BE and Node has no such decoder, so swap the byte pairs and
    // read as UTF-16LE. (Doing this with a regex on the decoded string, as a first draft did,
    // "succeeds" and returns mojibake — which then reads as a font naming bug that isn't one.)
    let value;
    if (platform === 3) {
      const swapped = Buffer.from(raw);
      for (let b = 0; b + 1 < swapped.length; b += 2) {
        const t = swapped[b]; swapped[b] = swapped[b + 1]; swapped[b + 1] = t;
      }
      value = swapped.toString('utf16le');
    } else {
      value = raw.toString('latin1');
    }
    names[nameID] = names[nameID] || value;
  }
  return { family: names[1], subfamily: names[2], full: names[4], postscript: names[6], cmapOff, buffer: d };
}

/** Unicode coverage, from a format-4 or format-12 cmap subtable. */
function coverage(font) {
  const d = font.buffer;
  const base = font.cmapOff;
  const n = d.readUInt16BE(base + 2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const rec = base + 4 + 8 * i;
    const platform = d.readUInt16BE(rec);
    const encoding = d.readUInt16BE(rec + 2);
    const off = base + d.readUInt32BE(rec + 4);
    if (platform === 3 && (encoding === 1 || encoding === 10)) best = off;
  }
  if (best === null) return null;
  const format = d.readUInt16BE(best);
  const has = new Set();
  if (format === 4) {
    const segX2 = d.readUInt16BE(best + 6);
    const endBase = best + 14;
    const startBase = endBase + segX2 + 2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = d.readUInt16BE(endBase + s * 2);
      const start = d.readUInt16BE(startBase + s * 2);
      if (start === 0xFFFF) continue;
      for (let c = start; c <= end && c !== 0xFFFF; c++) has.add(c);
    }
  } else if (format === 12) {
    const groups = d.readUInt32BE(best + 12);
    for (let g = 0; g < groups; g++) {
      const r = best + 16 + 12 * g;
      const start = d.readUInt32BE(r), end = d.readUInt32BE(r + 4);
      for (let c = start; c <= end; c++) has.add(c);
    }
  }
  return has;
}

/* ── 1. UIAppFonts ↔ the files on disk ──────────────────────────────────── */

console.log('Info.plist UIAppFonts vs Resources/Fonts');

const plist = fs.readFileSync(PLIST, 'utf8');
const block = plist.match(/<key>UIAppFonts<\/key>\s*<array>([\s\S]*?)<\/array>/);
ok(!!block, 'Info.plist declares UIAppFonts');
const declared = block ? [...block[1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]) : [];
const onDisk = fs.existsSync(FONT_DIR)
  ? fs.readdirSync(FONT_DIR).filter((f) => f.toLowerCase().endsWith('.ttf')).sort()
  : [];

for (const f of declared) {
  ok(onDisk.includes(f), `declared font exists on disk: ${f}`,
    `Resources/Fonts holds: ${onDisk.join(', ') || '(nothing)'}`);
}
for (const f of onDisk) {
  ok(declared.includes(f), `bundled font is declared in UIAppFonts: ${f}`,
    'an undeclared font is copied into the app and never registered');
}
console.log(`  (${declared.length} declared, ${onDisk.length} on disk)`);

/* ── 2. PostScript names ────────────────────────────────────────────────── */

console.log('\nPostScript names, which is what iOS resolves by');

const fonts = {};
for (const f of onDisk) {
  const info = fontNames(path.join(FONT_DIR, f));
  fonts[info.postscript] = info;
  const stem = f.replace(/\.ttf$/i, '');
  ok(info.postscript === stem, `${f}: PostScript name is "${info.postscript}"`,
    `filename says ${stem}; iOS looks the font up by the PostScript name, so these must agree`);
}

// Two files claiming the same PostScript name means one of them never loads.
ok(Object.keys(fonts).length === onDisk.length,
  'every bundled font has a distinct PostScript name',
  `${onDisk.length} files, ${Object.keys(fonts).length} distinct names`);

// Fraunces' variable default instance is Black; a static build must not still say so.
for (const [ps, info] of Object.entries(fonts)) {
  if (!ps.startsWith('Fraunces')) continue;
  ok(!/black/i.test(info.subfamily),
    `${ps}: subfamily is "${info.subfamily}", not the variable default Black`);
}

/* ── 3. what the Swift asks for ─────────────────────────────────────────── */

console.log('\nnames referenced by Theme.FontName');

const theme = fs.readFileSync(THEME, 'utf8');
const referenced = [...theme.matchAll(/static let \w+ = "([^"]+)"/g)].map((m) => m[1]);
ok(referenced.length >= 6, 'Theme.FontName lists the faces', `found ${referenced.length}`);
for (const name of referenced) {
  ok(name in fonts, `Theme asks for "${name}" and it is bundled`,
    `bundled: ${Object.keys(fonts).join(', ')}`);
}

// Anything else calling .custom with a string literal is bypassing the token list.
const literals = [...theme.matchAll(/\.custom\("([^"]+)"/g)].map((m) => m[1]);
for (const lit of literals) {
  ok(lit in fonts, `literal font name "${lit}" is bundled`);
}

/* ── 4. glyph coverage for what the UI draws ────────────────────────────── */

console.log('\nglyphs the UI actually draws');

// Subsetting is what keeps six fonts to ~220 KB, and it is also how a character silently starts
// rendering in the system face halfway through a line.
const NEEDED = [
  [0x00B7, '· (separates level / shelf / side)'],
  [0x00D7, '× (copy count)'],
  [0x2014, '— (em dash)'],
  [0x2013, '– (shelf range)'],
  [0x2026, '… (ellipsis)'],
  [0x0030, '0'],
  [0x004F, 'O'],
  [0x0031, '1'],
  [0x0049, 'I'],
];
for (const [ps, info] of Object.entries(fonts)) {
  const has = coverage(info);
  if (!has) { ok(false, `${ps}: no readable cmap`); continue; }
  const missing = NEEDED.filter(([c]) => !has.has(c)).map(([, d]) => d);
  ok(missing.length === 0, `${ps} covers every glyph the UI draws`, `missing: ${missing.join(', ')}`);
}

// The arrow is the one the sources do NOT have, which is why shelf ranges use an en dash. If a
// future font does carry it this test says so rather than leaving the workaround unexplained.
const arrowCarriers = Object.entries(fonts)
  .filter(([, info]) => (coverage(info) || new Set()).has(0x2192))
  .map(([ps]) => ps);
console.log(`  (U+2192 → is absent from ${arrowCarriers.length === 0 ? 'all' : 'some'} faces`
  + `${arrowCarriers.length ? `; present in ${arrowCarriers.join(', ')}` : ', hence the en dash in ranges'})`);

const views = path.join(APP, 'Views');
const arrowUse = fs.readdirSync(views)
  .filter((f) => f.endsWith('.swift'))
  .flatMap((f) => {
    const src = fs.readFileSync(path.join(views, f), 'utf8');
    return src.split('\n')
      .map((l, i) => [f, i + 1, l])
      .filter(([, , l]) => l.includes('→') && !l.trimStart().startsWith('//') && !l.includes('///'));
  });
ok(arrowUse.length === 0 || arrowCarriers.length > 0,
  'no view draws an arrow the fonts cannot render',
  arrowUse.map(([f, n, l]) => `${f}:${n} ${l.trim()}`).join('\n       '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
