// A compiler stand-in, for the things a compiler would have caught first.
//
//   node ios/Tools/swiftcheck.test.js
//
// Nothing in this project can be compiled on the machine it is written on: the Mac is in the
// cloud and the loop is ten minutes. That is survivable for logic, because the logic is mirrored
// in JavaScript and tested there. It is not survivable for *renames* — change
// `Theme.callNumber(_ style: Font.TextStyle)` to take a CGFloat and every call site is a build
// error you find out about fifteen minutes later, one at a time.
//
// So this reads the Swift as text and checks the cheap, high-yield things:
//
//   1. Delimiters balance in every file. Scripted edits truncate files; a truncated Swift file
//      looks completely fine until it does not.
//   2. Every `Type.member` reference for the project's own enums resolves to something declared.
//   3. Every SwiftUI view type used in another file exists.
//   4. No file leans on a system colour, because the app opts out of dark mode and every surface
//      has to paint itself.
//
// It is not a type checker. It will not catch a wrong argument type or a missing `await`. It
// catches the class of mistake that comes from editing across twenty files at once.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = [path.join(ROOT, 'BiomedShelfScanner'), path.join(ROOT, 'Tests')];

let pass = 0, fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith('.swift') ? [p] : [];
  });
}
const files = DIRS.filter(fs.existsSync).flatMap(walk);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/** Strip comments and string literals so the scanners below see code only. */
function strip(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], next = src[i + 1];
    if (c === '/' && next === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && next === '*') {
      let depth = 1; i += 2;
      while (i < n && depth) {
        if (src[i] === '/' && src[i + 1] === '*') { depth++; i += 2; }
        else if (src[i] === '*' && src[i + 1] === '/') { depth--; i += 2; }
        else i++;
      }
      continue;
    }
    if (c === '"' && src.slice(i, i + 3) === '"""') {
      i += 3;
      while (i < n && src.slice(i, i + 3) !== '"""') i++;
      i += 3;
      continue;
    }
    if (c === '"') {
      i++;
      // Interpolations carry real code and must survive.
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\' && src[i + 1] === '(') {
          let depth = 1; i += 2;
          const start = i;
          while (i < n && depth) {
            if (src[i] === '(') depth++;
            else if (src[i] === ')') depth--;
            if (depth) i++;
          }
          out += ' ' + src.slice(start, i) + ' ';
          i++;
          continue;
        }
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      out += ' "" ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const sources = files.map((f) => ({ file: f, raw: fs.readFileSync(f, 'utf8') }));
sources.forEach((s) => { s.code = strip(s.raw); });

/* ── 1. delimiters ──────────────────────────────────────────────────────── */

console.log('delimiters balance');

for (const s of sources) {
  const stack = [];
  const open = { '{': '}', '(': ')', '[': ']' };
  const close = { '}': '{', ')': '(', ']': '[' };
  let bad = null;
  let line = 1;
  for (const ch of s.code) {
    if (ch === '\n') line++;
    else if (open[ch]) stack.push({ ch, line });
    else if (close[ch]) {
      const top = stack.pop();
      if (!top || top.ch !== close[ch]) { bad = `unexpected '${ch}' at line ${line}`; break; }
    }
  }
  if (!bad && stack.length) {
    const t = stack[stack.length - 1];
    bad = `'${t.ch}' opened at line ${t.line} is never closed`;
  }
  ok(!bad, `${rel(s.file)} balances`, bad);
}

/* ── 2. own-namespace members ───────────────────────────────────────────── */

console.log('\nreferences to the project\'s own namespaces resolve');

// Namespaces worth checking: hand-written token/config enums whose members are referenced by
// name across many files, which is exactly where a rename goes wrong.
const NAMESPACES = ['Theme', 'ScanGeometry', 'HeadcountConfig', 'HeadcountLogic'];

/** Members declared inside `enum X { … }` (or struct/final class), one nesting level deep. */
function membersOf(name) {
  for (const s of sources) {
    const m = s.code.match(new RegExp(`(?:enum|struct|final class|class)\\s+${name}\\s*(?::[^{]*)?\\{`));
    if (!m) continue;
    let i = s.code.indexOf('{', m.index), depth = 0, end = i;
    for (let j = i; j < s.code.length; j++) {
      if (s.code[j] === '{') depth++;
      else if (s.code[j] === '}') { depth--; if (!depth) { end = j; break; } }
    }
    const body = s.code.slice(i + 1, end);
    const out = new Set();
    for (const r of body.matchAll(/\b(?:static\s+)?(?:let|var|func)\s+([A-Za-z_]\w*)/g)) out.add(r[1]);
    // Nested types and enum cases are reachable as members too.
    for (const r of body.matchAll(/\b(?:enum|struct|final class|class)\s+([A-Za-z_]\w*)/g)) out.add(r[1]);
    for (const r of body.matchAll(/\bcase\s+([A-Za-z_]\w*)/g)) out.add(r[1]);
    return out;
  }
  return null;
}

for (const ns of NAMESPACES) {
  const declared = membersOf(ns);
  ok(declared !== null, `${ns} is declared somewhere`);
  if (!declared) continue;

  const seen = new Map();
  for (const s of sources) {
    for (const m of s.code.matchAll(new RegExp(`\\b${ns}\\.([A-Za-z_]\\w*)`, 'g'))) {
      if (!seen.has(m[1])) seen.set(m[1], rel(s.file));
    }
  }
  for (const [member, where] of seen) {
    ok(declared.has(member), `${ns}.${member} exists (used in ${where})`,
      `${ns} declares: ${[...declared].sort().join(', ')}`);
  }
  console.log(`  (${ns}: ${seen.size} distinct members referenced, ${declared.size} declared)`);
}

/* ── 3. view types ──────────────────────────────────────────────────────── */

console.log('\nevery view constructed by name is declared');

const declaredTypes = new Set();
for (const s of sources) {
  for (const m of s.code.matchAll(/\b(?:struct|enum|final class|class|actor)\s+([A-Z]\w*)/g)) {
    declaredTypes.add(m[1]);
  }
}

// Views this project constructs directly. Listed rather than inferred: inferring "every
// capitalised identifier followed by (" sweeps in the whole of SwiftUI and Foundation.
const OWN_VIEWS = [
  'ScanView', 'TripSheet', 'TripRow', 'RouteView', 'SearchView', 'ManualEntryView',
  'SheetImportReview', 'HistoryView', 'DiagnosticsView', 'WalkMapView', 'CameraPreview',
  'DocumentScanner', 'ViewfinderOverlay', 'StatusChip', 'Chip', 'MicroLabel',
  'PaperBackground', 'ShelfButton', 'TransitRow', 'FloorSection', 'StopRow', 'TruckSortView',
  'HeadcountView', 'HeadcountWalkView', 'HeadcountConfirmSheet',
  'HeadcountStore', 'HeadcountSubmitter', 'HeadcountFeedback', 'HeadcountClient',
  'ScanEngine', 'ScanFeedback', 'TripStore', 'Router', 'CallNumber', 'CallNumberRecognizer',
];
for (const t of OWN_VIEWS) {
  ok(declaredTypes.has(t), `${t} is declared`);
}

// …and everything constructed as `SomeType(` in a Views file resolves to a declared type or to a
// known framework one. This is the check that catches a view renamed in one place only.
const FRAMEWORK = new Set([
  'Text', 'Image', 'Button', 'VStack', 'HStack', 'ZStack', 'ScrollView', 'List', 'Form', 'Section',
  'NavigationStack', 'Spacer', 'Divider', 'Color', 'Circle', 'Rectangle', 'RoundedRectangle',
  'Capsule', 'Path', 'Canvas', 'GeometryReader', 'Toggle', 'Picker', 'ProgressView', 'Label',
  'Menu', 'ToolbarItem', 'EdgeInsets', 'CGRect', 'CGSize', 'CGPoint', 'CGFloat', 'Binding',
  'State', 'Environment', 'FocusState', 'Set', 'Date', 'UUID', 'URL', 'URLRequest', 'Task',
  'ContentUnavailableView', 'LazyVGrid', 'GridItem', 'EmptyView', 'ForEach', 'Animation',
  'Font', 'UIFont', 'UIColor', 'UINavigationBarAppearance', 'Dictionary', 'Array', 'String',
  'Int', 'Double', 'Float', 'Bool', 'JSONEncoder', 'JSONDecoder', 'ISO8601DateFormatter',
  'NSRegularExpression', 'NSRange', 'CHHapticEvent', 'CHHapticPattern', 'AVAudioEngine',
  'AVAudioPlayerNode', 'AVAudioPCMBuffer', 'UIImpactFeedbackGenerator', 'CHHapticEngine',
  'UINotificationFeedbackGenerator', 'AVCaptureSession', 'AVCaptureVideoDataOutput',
  'DispatchQueue', 'CIImage', 'CIContext', 'CIVector', 'UIImage', 'VNRecognizeTextRequest',
  'VNImageRequestHandler', 'VNDocumentCameraViewController', 'CharacterSet', 'Calendar',
  'TimeZone', 'DateComponents', 'UserDefaults', 'FileManager', 'Data', 'Bundle', 'Character',
  'TimeInterval', 'AVCaptureDeviceInput', 'AVCaptureDevice', 'Coordinator', 'PreviewView',
  'URLSessionConfiguration', 'URLSession', 'JSONSerialization', 'TextField', 'Group',
  'UIApplication', 'UIPasteboard', 'WindowGroup', 'Card', 'DragGesture', 'Slot',
  'AVAudioFrameCount', 'CMSampleBufferGetImageBuffer', 'LabeledContent', 'Sendable',
  'UIActivityViewController',
]);
// XCTest's assertions are functions, not types, and there are hundreds of call sites.
const isAssertion = (t) => t.startsWith('XCT');
const unknown = new Map();
for (const s of sources) {
  for (const m of s.code.matchAll(/\b([A-Z]\w*)\s*\(/g)) {
    const t = m[1];
    if (FRAMEWORK.has(t) || declaredTypes.has(t) || isAssertion(t)) continue;
    // Nested types are referenced qualified; those are covered by the namespace check.
    if (s.code.includes(`.${t}(`)) continue;
    if (!unknown.has(t)) unknown.set(t, rel(s.file));
  }
}
// Reported once per name, not once per call site: a renamed view is one mistake, and forty
// identical lines about it buries the other thirty-nine findings.
for (const [t, where] of unknown) {
  ok(false, `${t}( … ) resolves — first used in ${where}`,
    'neither declared in this project nor a known framework type. If it is a framework type, '
    + 'add it to FRAMEWORK; if it is ours, it has been renamed or deleted.');
}
ok(unknown.size === 0, 'every constructed type resolves');

/* ── 4. no system colours ───────────────────────────────────────────────── */

console.log('\nnothing leans on a system colour');

// The app opts out of dark mode (`preferredColorScheme(.light)`), so a system background or a
// `.secondary` foreground is not "adaptive" — it is an unpainted surface that happens to look
// right in one mode.
const BANNED = [
  [/Color\(\.system\w+\)/, 'Color(.systemBackground) and friends'],
  [/foregroundStyle\(\.secondary\)/, '.foregroundStyle(.secondary)'],
  [/foregroundStyle\(\.tertiary\)/, '.foregroundStyle(.tertiary)'],
  [/\bColor\.secondary\b/, 'Color.secondary'],
];
for (const s of sources) {
  if (rel(s.file).startsWith('Tests/')) continue;
  for (const [rx, what] of BANNED) {
    const m = s.code.match(rx);
    ok(!m, `${rel(s.file)} avoids ${what}`,
      m ? `found ${JSON.stringify(m[0])}` : undefined);
  }
}

/* ── 5. the design decisions that are easy to undo by accident ──────────── */

console.log('\nload-bearing settings still set');

const all = sources.map((s) => s.code).join('\n');
ok(/usesLanguageCorrection\s*=\s*false/.test(all),
  'Vision language correction stays off (it bends call numbers toward English words)');
ok((all.match(/usesLanguageCorrection\s*=\s*false/g) || []).length >= 2,
  'both the live scanner and the request-sheet scanner turn it off');
ok(/preferredColorScheme\(\.light\)/.test(all),
  'one theme, as the shared design system requires');
ok(/isIdleTimerDisabled\s*=\s*true/.test(all),
  'the screen is kept awake during eyes-off work');
ok(/schemaVersion/.test(all) && /HeadcountConfig\.schemaVersion/.test(all),
  'the pinned schema version is sent with every submission');

/* ── 6. golden fixtures match what the tests decode ─────────────────────── */

console.log('\ngolden fixtures decode into the shapes the tests expect');

// A stale fixture fails as a decode crash in the first test that touches it, fifteen minutes
// after you pushed the build. The top-level shape is cheap to check here.
for (const [fixture, decoder, keys] of [
  ['HeadcountGolden.json', 'HeadcountLogicTests.swift',
   ['days', 'slots', 'named', 'payloads', 'validations', 'clamps', 'walk', 'ages', 'transitions', 'backoffs', 'csv']],
  ['CallNumberGolden.json', 'CallNumberTests.swift',
   ['sortedOrder', 'locates', 'searches', 'pairs']],
]) {
  const p = path.join(ROOT, 'Tests', fixture);
  if (!fs.existsSync(p)) { ok(false, `${fixture} exists`); continue; }
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const k of keys) {
    ok(k in json, `${fixture} carries "${k}" (decoded by ${decoder})`);
  }
  // And the reverse: a key the fixture grew that no test reads is a generator running ahead of
  // the tests, which is how a "passing" suite stops covering the new thing.
  for (const k of Object.keys(json)) {
    ok(keys.includes(k), `${fixture}: "${k}" is decoded by ${decoder}`,
      'the generator emits it but the Swift Decodable does not read it');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
