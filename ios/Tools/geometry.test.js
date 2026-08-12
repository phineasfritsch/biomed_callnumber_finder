// The scan band, checked without a compiler.
//
//   node ios/Tools/geometry.test.js
//
// `ScanGeometryTests.swift` asserts all of this too, but nothing in this project can be compiled
// on the machine it is written on — the Mac is in the cloud and the build loop is ten minutes.
// So the constants are read out of ScanGeometry.swift itself and the same arithmetic is run here.
// It is not a mirror that can drift: if someone changes `sheetPeek` in the Swift, this file picks
// up the new value on the next run.
//
// What it protects: the band is what FrameProcessor filters Vision observations by, so the drawn
// outline and the scanned region are the same rect by construction. Any control drawn on top of
// the preview is therefore a region the frame promises to scan and the user cannot see into. The
// shipped bug was the precision band (0.18–0.82) running straight through the single-shot
// shutter (~0.72–0.81).

'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'BiomedShelfScanner', 'Scanning', 'ScanGeometry.swift');
const swift = fs.readFileSync(SRC, 'utf8');

/** Pull `static let name: CGFloat = 12` out of the Swift, so the numbers under test are the
 *  numbers that ship. A missing constant is a failure, not a default. */
function constant(name) {
  const m = swift.match(new RegExp(`static let ${name}\\s*:\\s*CGFloat\\s*=\\s*([\\d.]+)`));
  if (!m) throw new Error(`ScanGeometry.${name} not found — did it get renamed?`);
  return parseFloat(m[1]);
}

const G = {
  barHeight: constant('barHeight'),
  barTopPadding: constant('barTopPadding'),
  shutter: constant('shutter'),
  sheetPeek: constant('sheetPeek'),
  gap: constant('gap'),
  minBandHeight: constant('minBandHeight'),
  sweepHeightFraction: constant('sweepHeightFraction'),
};

const shutterBottomPadding = (safeBottom) => Math.max(G.gap, G.sheetPeek + G.gap - safeBottom);
const topChrome = (safeTop) => safeTop + G.barTopPadding + G.barHeight + G.gap;
const bottomChrome = (safeBottom) => safeBottom + shutterBottomPadding(safeBottom) + G.shutter + G.gap;

function band(precision, screen, safeTop, safeBottom) {
  const h = screen.height;
  if (!(h > 0)) return { x: 0, y: 0.25, w: 1, h: 0.5 };
  const bottom = Math.min(bottomChrome(safeBottom), h);
  const top = Math.min(topChrome(safeTop), Math.max(0, h - bottom - G.minBandHeight));
  const free = Math.max(0, h - top - bottom);
  const heightPt = precision ? free : Math.min(free, h * G.sweepHeightFraction);
  const topPt = top + (free - heightPt) / 2;
  return {
    x: precision ? 0.30 : 0,
    y: Math.max(0, (h - topPt - heightPt) / h),
    w: precision ? 0.40 : 1,
    h: Math.min(1, heightPt / h),
  };
}

// Portrait point sizes and safe areas for every iPhone iOS 17 runs on.
const DEVICES = [
  ['SE (2nd/3rd gen)', 375, 667, 20, 0],
  ['8 Plus', 414, 736, 20, 0],
  ['13 mini', 375, 812, 50, 34],
  ['11 / XR', 414, 896, 48, 34],
  ['14 / 13', 390, 844, 47, 34],
  ['15 / 14 Pro', 393, 852, 59, 34],
  ['15 Pro Max', 430, 932, 59, 34],
];

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; return; }
  fail++;
  console.log(`  FAIL ${label}`);
}

console.log('constants read from ScanGeometry.swift:', JSON.stringify(G));
console.log('\nband vs chrome, every device, both modes');

for (const [name, w, h, safeTop, safeBottom] of DEVICES) {
  const shutterTop = safeBottom + shutterBottomPadding(safeBottom) + G.shutter;
  const shutterBottom = safeBottom + shutterBottomPadding(safeBottom);
  const barBottom = safeTop + G.barTopPadding + G.barHeight;

  ok(shutterBottom >= G.sheetPeek + G.gap,
    `${name}: shutter (bottom ${shutterBottom}) clears the sheet peek ${G.sheetPeek}`);

  for (const precision of [false, true]) {
    const b = band(precision, { width: w, height: h }, safeTop, safeBottom);
    const mode = precision ? 'precision' : 'sweep    ';
    const bandBottomPt = b.y * h;                 // from screen bottom
    const bandTopPt = (1 - (b.y + b.h)) * h;      // from screen top
    const heightPt = b.h * h;

    ok(bandBottomPt >= shutterTop,
      `${name} ${mode}: band bottom ${bandBottomPt.toFixed(0)} clears shutter top ${shutterTop}`);
    ok(bandBottomPt >= G.sheetPeek,
      `${name} ${mode}: band bottom ${bandBottomPt.toFixed(0)} clears the sheet ${G.sheetPeek}`);
    ok(bandTopPt >= barBottom,
      `${name} ${mode}: band top ${bandTopPt.toFixed(0)} clears the mode chips ${barBottom}`);
    ok(heightPt >= G.minBandHeight,
      `${name} ${mode}: band is ${heightPt.toFixed(0)}pt tall (min ${G.minBandHeight})`);
    ok(b.y >= 0 && b.y + b.h <= 1.0001, `${name} ${mode}: band inside the screen`);

    if (precision) {
      ok(heightPt > b.w * w, `${name} precision: taller than wide (a spine is vertical)`);
      ok(Math.abs(b.x + b.w / 2 - 0.5) < 0.001, `${name} precision: centred`);
    } else {
      ok(b.h <= G.sweepHeightFraction + 1e-9, `${name} sweep: stays a strip`);
      ok(b.w === 1, `${name} sweep: full width`);
    }
  }
}

// What the old constants did, so the regression is on the record rather than in a commit message.
console.log('\nthe bug this replaced');
{
  const h = 844, safeBottom = 34;
  const OLD_PRECISION = { y: 0.18, h: 0.64 };
  const oldBottomPt = OLD_PRECISION.y * h;
  const oldShutterTop = safeBottom + 128 + 78;   // the old hard-coded padding
  ok(oldBottomPt < oldShutterTop,
    `old precision band bottom ${oldBottomPt.toFixed(0)} DID overlap the shutter top ${oldShutterTop}`);
  const b = band(true, { width: 390, height: h }, 47, safeBottom);
  console.log(`  old: band bottom ${oldBottomPt.toFixed(0)}pt vs shutter top ${oldShutterTop}pt`
    + `  → ${(oldShutterTop - oldBottomPt).toFixed(0)}pt of overlap`);
  console.log(`  new: band bottom ${(b.y * h).toFixed(0)}pt vs shutter top `
    + `${(safeBottom + shutterBottomPadding(safeBottom) + G.shutter).toFixed(0)}pt`);
}

// The chip that shows what Vision currently sees used to be drawn 28pt BELOW the band, which put
// it on the shutter. It is now drawn 24pt inside the band's lower edge; assert it stays inside.
console.log('\nthe seeing chip stays inside the band');
{
  const view = fs.readFileSync(
    path.join(__dirname, '..', 'BiomedShelfScanner', 'Views', 'ScanView.swift'), 'utf8');
  const m = view.match(/\.position\(x: rect\.midX, y: rect\.(maxY|minY)\s*([+-])\s*(\d+)\)/);
  ok(!!m, 'the chip position is still expressed relative to the band');
  if (m) {
    const [, edge, sign, amount] = m;
    ok(edge === 'maxY' && sign === '-' && Number(amount) < G.minBandHeight,
      `chip is inset ${amount}pt inside the band's ${edge}, not outside it`);
  }
}

// The band is measured off the sheet's peek detent. If someone changes the detent and not the
// constant, every clearance above is computed against a sheet height that no longer exists.
console.log('\nthe sheet detent and the constant agree');
{
  const view = fs.readFileSync(
    path.join(__dirname, '..', 'BiomedShelfScanner', 'Views', 'ScanView.swift'), 'utf8');
  ok(/presentationDetents\(\[\.height\(ScanGeometry\.sheetPeek\)/.test(view),
    'ScanView derives the peek detent from ScanGeometry.sheetPeek rather than repeating it');
  ok(/padding\(\.bottom, ScanGeometry\.shutterBottomPadding\(safeBottom: safeBottom\)\)/.test(view),
    'the shutter uses the derived bottom padding rather than a literal');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
