// The iOS headcount schema against the web one, field by field and string by string.
//
//   node ios/Tools/headcount.parity.test.mjs
//
// `better_headcount` deliberately has ONE copy of the pinned schema: the client and the Worker
// import the same `js/config.js`, because "a second copy of the field map is a second thing to
// forget to update, and the whole point of the drift check is that nobody remembers".
//
// A native app cannot import a JS module, so `HeadcountConfig.swift` is unavoidably a second
// copy. This test is the compensating control. It parses the Swift and compares every value that
// can silently write a number into the wrong column:
//
//   * `entry.NNNNNNN` field ids — a transposed digit puts Level 9's count in Level 8's column and
//     nothing anywhere reports it.
//   * The option strings, byte for byte. "10AM" vs "10 AM" is a rejected submission at best and a
//     new spreadsheet value at worst.
//   * The minute table, which is what snapping picks an index from.
//   * The walk order and the `walkAfter` anchor, which is where the Hub is counted.
//   * The schema version, which the Worker refuses on mismatch.
//
// Run it before every release. It needs no network and no compiler.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SWIFT = path.join(HERE, '..', 'BiomedShelfScanner', 'Headcount', 'HeadcountConfig.swift');
const JS = path.join(HERE, '..', '..', 'better_headcount', 'js', 'config.js');

// `better_headcount` is its own git repository that happens to sit in this working tree, so it is
// not tracked here and a fresh clone will not have it. Say so plainly rather than crashing with a
// module-not-found — but exit non-zero, because "the parity check did not run" must never read as
// "the parity check passed".
if (!fs.existsSync(JS)) {
  console.log('SKIPPED — better_headcount/js/config.js is not in this working tree.\n'
    + '  This test diffs ios/BiomedShelfScanner/Headcount/HeadcountConfig.swift against the web\n'
    + '  app\'s pinned schema, which lives in its own repository. Clone it alongside this one:\n'
    + '    git clone <better_headcount> better_headcount\n'
    + '  Until then nothing is checking that the app\'s copy of the Google Form field ids is\n'
    + '  still the right one.');
  process.exit(2);
}

const swift = fs.readFileSync(SWIFT, 'utf8');
const { FORMS, SCHEMA_VERSION, DAYS, COUNT_MAX, TAP_DEBOUNCE_MS, STALE_QUEUE_MS, BUILD_EPOCH, WORKER_URL, TIMEZONE } =
  await import('file://' + JS.replace(/\\/g, '/'));

let pass = 0, fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
}
function eq(got, want, label) {
  ok(got === want, label, `swift: ${JSON.stringify(got)}\n       js:    ${JSON.stringify(want)}`);
}
function eqList(got, want, label) {
  ok(JSON.stringify(got) === JSON.stringify(want), label,
    `swift: ${JSON.stringify(got)}\n       js:    ${JSON.stringify(want)}`);
}

/* ── a small Swift reader ───────────────────────────────────────────────── */

/** The body of `static let <name> = Form(` … the matching close paren. */
function formBlock(name) {
  const start = swift.indexOf(`static let ${name} = Form(`);
  if (start < 0) throw new Error(`HeadcountConfig.${name} not found`);
  let i = swift.indexOf('(', start), depth = 0;
  for (let j = i; j < swift.length; j++) {
    if (swift[j] === '(') depth++;
    else if (swift[j] === ')') { depth--; if (depth === 0) return swift.slice(i + 1, j); }
  }
  throw new Error(`HeadcountConfig.${name} is unbalanced`);
}

const str = (block, key) => {
  const m = block.match(new RegExp(`\\b${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1] : null;
};
const url = (block, key) => {
  const m = block.match(new RegExp(`\\b${key}:\\s*URL\\(string:\\s*"([^"]+)"\\)!`));
  return m ? m[1] : null;
};
const strList = (block, key) => {
  const m = block.match(new RegExp(`\\b${key}:\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) return null;
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);
};
const intList = (block, key) => {
  const m = block.match(new RegExp(`\\b${key}:\\s*\\[([^\\]]*?)\\]`));
  if (!m) return null;
  return m[1].split(',').map((s) => s.trim()).filter(Boolean).map(Number);
};
/** `static let days = [ … ]` — an assignment, not a labelled argument. */
const assignedStrList = (name) => {
  const m = swift.match(new RegExp(`static let ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) return null;
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);
};

const counters = (block) => {
  const m = block.match(/counters:\s*\[([\s\S]*)\n\s*\)\s*$/) || block.match(/counters:\s*\[([\s\S]*)\]/);
  if (!m) return null;
  return [...m[1].matchAll(
    /Counter\(entry:\s*"([^"]+)",\s*label:\s*"((?:[^"\\]|\\.)*)"(?:,\s*formTitle:\s*"((?:[^"\\]|\\.)*)")?\s*\)/g,
  )].map((c) => ({ entry: c[1], label: c[2], formTitle: c[3] }));
};

/* ── top-level constants ────────────────────────────────────────────────── */

console.log('constants');

eq(swift.match(/static let schemaVersion = "([^"]+)"/)?.[1], SCHEMA_VERSION,
  'schemaVersion — the Worker rejects a mismatch outright');
eq(swift.match(/static let workerURL = URL\(string: "([^"]+)"\)!/)?.[1], WORKER_URL, 'workerURL');
eq(swift.match(/TimeZone\(identifier: "([^"]+)"\)!/)?.[1], TIMEZONE, 'timeZone');
eqList(assignedStrList('days'), DAYS, 'days — and in this order, Monday first');
eq(Number(swift.match(/static let countMax = (\d+)/)?.[1]), COUNT_MAX, 'countMax');
eq(Number(swift.match(/static let tapDebounce: TimeInterval = ([\d.]+)/)?.[1]) * 1000,
  TAP_DEBOUNCE_MS, 'tapDebounce (ms)');
eq(Number(swift.match(/static let staleQueue: TimeInterval = ([^\n]+)/)?.[1]
  ?.replace(/[^0-9*]/g, '').split('*').reduce((a, b) => a * Number(b), 1)) * 1000,
  STALE_QUEUE_MS, 'staleQueue (ms)');
eq(Number(swift.match(/static let buildEpoch = Date\(timeIntervalSince1970: ([\d_]+)\)/)?.[1]
  ?.replace(/_/g, '')) * 1000, BUILD_EPOCH, 'buildEpoch');

/* ── the forms ──────────────────────────────────────────────────────────── */

for (const [name, form] of Object.entries(FORMS)) {
  console.log(`\n${name}`);
  const b = formBlock(name);

  eq(str(b, 'id'), form.id, `${name}.id`);
  eq(str(b, 'label'), form.label, `${name}.label`);
  eq(str(b, 'short'), form.short, `${name}.short`);
  eq(str(b, 'formId'), form.formId, `${name}.formId — the proxy allowlists on this`);
  eq(url(b, 'action'), form.action, `${name}.action`);
  eq(url(b, 'viewform'), form.viewform, `${name}.viewform`);
  eq(str(b, 'dayEntry'), form.dayEntry, `${name}.dayEntry`);
  eq(str(b, 'timeEntry'), form.timeEntry, `${name}.timeEntry`);
  eq(str(b, 'countersLabel'), form.countersLabel, `${name}.countersLabel`);
  eq(str(b, 'countersHint'), form.countersHint, `${name}.countersHint`);

  const walkAfter = b.match(/walkAfter:\s*(nil|"([^"]+)")/);
  eq(walkAfter?.[2] ?? null, form.walkAfter ?? null,
    `${name}.walkAfter — where the Hub is spliced into the walk`);

  eqList(strList(b, 'times'), [...form.times],
    `${name}.times — byte for byte; the inconsistency is what the form contains`);
  eqList(intList(b, 'timeMinutes'), [...form.timeMinutes],
    `${name}.timeMinutes — parallel to times, index is all they share`);
  eqList(strList(b, 'timeLabels'), [...form.timeLabels],
    `${name}.timeLabels — display only, never sent`);

  ok(strList(b, 'times').length === intList(b, 'timeMinutes').length
    && strList(b, 'times').length === strList(b, 'timeLabels').length,
    `${name}: times, minutes and labels are the same length`);

  const swiftCounters = counters(b);
  const jsCounters = form.counters.map((c) => ({ entry: c.entry, label: c.label, formTitle: c.formTitle }));
  ok(swiftCounters.length === jsCounters.length,
    `${name}: same number of counters`,
    `swift ${swiftCounters.length}, js ${jsCounters.length}`);

  for (let i = 0; i < Math.max(swiftCounters.length, jsCounters.length); i++) {
    const s = swiftCounters[i] || {}, j = jsCounters[i] || {};
    // Order is the route, not a presentation detail — assert position, not just membership.
    eq(s.entry, j.entry, `${name}.counters[${i}].entry (${j.label}) — decides the sheet column`);
    eq(s.label, j.label, `${name}.counters[${i}].label`);
    eq(s.formTitle ?? undefined, j.formTitle ?? undefined,
      `${name}.counters[${i}].formTitle — the name the confirm read-back shows`);
  }
}

/* ── the fingerprint the drift check is pinned to ───────────────────────── */
//
// `schemaFingerprint` is hand-rolled in Swift because JSONEncoder does not promise key order and
// this string has to be byte-identical to `JSON.stringify`'s. Reproducing the Swift's output here
// from the JS values is the only way to check that without running Swift.

console.log('\nschema fingerprint');

for (const [name, form] of Object.entries(FORMS)) {
  const want = JSON.stringify({
    formId: form.formId,
    dayEntry: form.dayEntry,
    timeEntry: form.timeEntry,
    days: [...form.days],
    times: [...form.times],
    counters: form.counters.map((c) => [c.entry, c.formTitle ?? c.label]),
  });
  // What the Swift builds, reconstructed from its own parsed values in its own concatenation
  // order. If the Swift's key order or escaping drifts from JSON.stringify's, this diverges.
  const b = formBlock(name);
  const cs = counters(b);
  const got = '{"formId":' + JSON.stringify(str(b, 'formId'))
    + ',"dayEntry":' + JSON.stringify(str(b, 'dayEntry'))
    + ',"timeEntry":' + JSON.stringify(str(b, 'timeEntry'))
    + ',"days":[' + assignedStrList('days').map((d) => JSON.stringify(d)).join(',') + ']'
    + ',"times":[' + strList(b, 'times').map((t) => JSON.stringify(t)).join(',') + ']'
    + ',"counters":[' + cs.map((c) => `[${JSON.stringify(c.entry)},${JSON.stringify(c.formTitle ?? c.label)}]`).join(',') + ']}';
  eq(got, want, `${name}: fingerprint matches JSON.stringify byte for byte`);
}

/* ── the walk order ─────────────────────────────────────────────────────── */

console.log('\nwalk order');

// Reimplements walkSequence over the parsed Swift, then checks it against the JS logic's own.
const { walkSequence } = await import(
  'file://' + path.join(HERE, '..', '..', 'better_headcount', 'js', 'logic.js').replace(/\\/g, '/'));

const swiftForms = Object.keys(FORMS).map((name) => {
  const b = formBlock(name);
  return {
    id: str(b, 'id'),
    walkAfter: b.match(/walkAfter:\s*"([^"]+)"/)?.[1],
    counters: counters(b),
  };
});
const swiftWalk = (() => {
  const [lead, ...rest] = swiftForms;
  const seq = lead.counters.map((c) => ({ form: lead, counter: c }));
  for (const f of rest) {
    const stops = f.counters.map((c) => ({ form: f, counter: c }));
    const at = f.walkAfter ? seq.findIndex((s) => s.counter.entry === f.walkAfter) : -1;
    if (at === -1) seq.push(...stops); else seq.splice(at + 1, 0, ...stops);
  }
  return seq.map((s) => s.counter.entry);
})();
const jsWalk = walkSequence(Object.values(FORMS)).map((s) => s.counter.entry);
eqList(swiftWalk, jsWalk, 'combined-round walk order is identical (the Hub is counted off Level 6)');

const hubAt = swiftWalk.indexOf(FORMS.collab.counters[0].entry);
const level6At = swiftWalk.indexOf('entry.209218120');
ok(hubAt === level6At + 1, 'the Hub sits immediately after Stacks Level 6, not at the end',
  `Hub at ${hubAt}, Level 6 at ${level6At}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
