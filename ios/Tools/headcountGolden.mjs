// Emit golden vectors for the Swift headcount port, from the known-good JavaScript.
//
//   node ios/Tools/headcountGolden.mjs ios/Tests/HeadcountGolden.json
//
// Same idea as CallNumberGolden.json: the JS in `better_headcount/js/logic.js` is the thing that
// has been run against real rounds and is covered by 52 of its own tests. The Swift is a port,
// and a port is a rewrite with a plausible alibi. So the JS generates the answers and
// `HeadcountLogicTests` has to reproduce them exactly.
//
// The slot cases are the ones that matter most. Snapping decides which row a walk is filed under,
// it wraps across midnight, and the wrap moves the day of week with it — none of which is visible
// when it goes wrong, because a round filed under the wrong slot looks exactly like a round.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const libPath = (f) => path.join(HERE, '..', '..', 'better_headcount', 'js', f);
const lib = (f) => 'file://' + libPath(f).replace(/\\/g, '/');

// See the note in headcount.parity.test.mjs: better_headcount is its own repository and is not
// tracked here. The generated fixture IS committed, so the Swift tests run without it — only
// regenerating needs the source.
if (!fs.existsSync(libPath('logic.js'))) {
  console.error('better_headcount/js/logic.js is not in this working tree, so the golden vectors\n'
    + 'cannot be regenerated. ios/Tests/HeadcountGolden.json is committed and still valid; clone\n'
    + 'better_headcount alongside this repo if you need to rebuild it.');
  process.exit(2);
}

const { FORMS, DAYS } = await import(lib('config.js'));
const L = await import(lib('logic.js'));

const out = process.argv[2] || path.join(HERE, '..', 'Tests', 'HeadcountGolden.json');

/* ── slot snapping ──────────────────────────────────────────────────────── */
//
// A full week at ten-minute resolution, in the counting timezone. 1008 instants per form covers
// every slot, every gap between slots, both midnight crossings, and a DST boundary if one falls
// in the chosen week.

const slots = [];
// Sunday 2026-08-02 00:00 Pacific through the following Saturday. Pinned, not `Date.now()` — a
// golden file that changes when you regenerate it proves nothing.
const start = Date.UTC(2026, 7, 2, 7, 0, 0);   // 00:00 PDT
for (const [name, form] of Object.entries(FORMS)) {
  for (let m = 0; m < 7 * 24 * 60; m += 10) {
    const instant = start + m * 60_000;
    const s = L.snapSlot(instant, form);
    slots.push({
      form: name,
      instant,
      index: s.index,
      value: s.value,
      minutesLate: s.minutesLate,
      wrapped: s.wrapped,
      dayShift: s.dayShift,
      dayIndex: s.dayIndex,
      dayValue: s.dayValue,
      minutes: s.parts.minutes,
      dateKey: s.parts.dateKey,
      weekday: s.parts.weekday,
    });
  }
}

// And the awkward instants, called out by name so a failure says what broke.
const named = [
  ['exactly 2:00 PM', Date.UTC(2026, 7, 6, 21, 0)],
  ['one minute before the 8 AM slot', Date.UTC(2026, 7, 6, 14, 59)],
  ['midway between 4 PM and 6 PM', Date.UTC(2026, 7, 6, 24, 0)],
  ['00:20 — belongs to the previous night', Date.UTC(2026, 7, 7, 7, 20)],
  ['23:50 — Biomed has an 11 PM slot, Collab does not', Date.UTC(2026, 7, 7, 6, 50)],
  ['03:00 — nearest slot is hours away', Date.UTC(2026, 7, 7, 10, 0)],
  ['Sunday 00:05 — wrap moves the day back to Saturday', Date.UTC(2026, 7, 9, 7, 5)],
].flatMap(([label, instant]) =>
  Object.entries(FORMS).map(([name, form]) => {
    const s = L.snapSlot(instant, form);
    return {
      label, form: name, instant,
      index: s.index, value: s.value, minutesLate: s.minutesLate,
      wrapped: s.wrapped, dayShift: s.dayShift, dayIndex: s.dayIndex, dayValue: s.dayValue,
    };
  }));

/* ── payload, validation, fingerprint ───────────────────────────────────── */

const counts = {
  biomed: Object.fromEntries(FORMS.biomed.counters.map((c, i) => [c.entry, i * 3])),
  collab: { [FORMS.collab.counters[0].entry]: 42 },
};

const payloads = Object.entries(FORMS).map(([name, form]) => {
  const payload = L.buildPayload(form, {
    day: 'Thursday', time: form.times[4], counts: counts[name],
  });
  return {
    form: name,
    day: 'Thursday',
    timeIndex: 4,
    counts: counts[name],
    payload,
    total: L.totalOf(form, counts[name]),
    expectedKeys: L.expectedKeys(form),
    dump: L.payloadDump(form, payload, '11111111-2222-4333-8444-555555555555'),
    fingerprint: L.schemaFingerprint(form),
  };
});

// Validation: every way a round can be wrong, and the exact message for each.
const validations = [];
{
  const form = FORMS.biomed;
  const good = L.buildPayload(form, { day: 'Thursday', time: '2:00 PM', counts: counts.biomed });

  const cases = [
    ['a good payload', good],
    ['a missing counter', Object.fromEntries(Object.entries(good).filter(([k]) => k !== form.counters[3].entry))],
    ['an unexpected field', { ...good, 'entry.999999': '1' }],
    ['a day that is not an option', { ...good, [form.dayEntry]: 'Caturday' }],
    ['a time that is not an option', { ...good, [form.timeEntry]: '2 PM' }],
    ['a non-integer count', { ...good, [form.counters[0].entry]: '3.5' }],
    ['a negative count', { ...good, [form.counters[0].entry]: '-1' }],
    ['a count over the clamp', { ...good, [form.counters[0].entry]: '1000' }],
    ['an empty count', { ...good, [form.counters[0].entry]: '' }],
  ];
  for (const [label, payload] of cases) {
    const r = L.validatePayload(form, payload);
    validations.push({ label, payload, ok: r.ok, errors: r.errors });
  }
}

/* ── the rest ───────────────────────────────────────────────────────────── */

const clamps = [-5, -1, 0, 1, 998, 999, 1000, 12345].map((n) => ({ n, out: L.clampCount(n) }));

const walk = {
  biomedOnly: L.walkSequence([FORMS.biomed]).map((s) => ({ form: s.form.id, entry: s.counter.entry })),
  combined: L.walkSequence([FORMS.biomed, FORMS.collab]).map((s) => ({ form: s.form.id, entry: s.counter.entry })),
};

const ages = [0, 500, 59_000, 60_000, 90_000, 3_600_000, 5_400_000, 47 * 3600_000, 100 * 3600_000]
  .map((ms) => ({ ms, out: L.formatAge(ms) }));

const transitions = [];
for (const state of L.QUEUE_STATES) {
  for (const event of ['send', 'ok', 'retry', 'fail']) {
    let next = null;
    try { next = L.queueTransition(state, event); } catch { next = null; }
    transitions.push({ state, event, next });
  }
}

// Deterministic "random" so the jitter is reproducible.
const backoffs = [0, 1, 2, 3, 4, 5, 10].flatMap((attempt) =>
  [0, 0.5, 1].map((r) => ({ attempt, r, ms: L.backoffMs(attempt, () => r) })));

const csv = L.toCsv([
  { at: '2026-08-06T21:00:00.000Z', form: 'biomed', day: 'Thursday', time: '2:00 PM', total: 57, result: 'Confirmed', code: 'recorded', submissionId: 'abc' },
  { at: '2026-08-06T21:00:01.000Z', form: 'collab', day: 'Thursday', time: '2PM', total: 8, result: 'Failed — Google returned 200, "no marker"', code: 'no-marker', submissionId: 'def' },
]);

fs.writeFileSync(out, JSON.stringify({
  days: DAYS, slots, named, payloads, validations, clamps, walk, ages, transitions, backoffs, csv,
}, null, 1));

console.log(`slot cases:      ${slots.length}`);
console.log(`named instants:  ${named.length}`);
console.log(`payload cases:   ${payloads.length}`);
console.log(`validations:     ${validations.length}`);
console.log(`transitions:     ${transitions.length}`);
console.log(`wrapped slots:   ${slots.filter((s) => s.wrapped).length}`);
console.log(`written to ${out}`);
