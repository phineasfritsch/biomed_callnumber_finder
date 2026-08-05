// Tests for the walking route — the geometry that turns "index 6 · top · right" into a place
// to stand and a direction to face.
//
//   node Tools/walk.test.js
//
// Like Tools/catalog.test.js this pulls the shipped code out of index.html rather than
// re-typing it, so a pass says something about the file that actually deploys. The same
// functions are transcribed into ios/BiomedShelfScanner/Models/WalkPath.swift; the assertions
// here are the contract both ports have to meet, and several of them exist because the obvious
// implementation gets them backwards.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function between(start, end, what) {
  const a = HTML.indexOf(start);
  const b = HTML.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`could not find ${what} in index.html — did the markers move?`);
  return HTML.slice(a + start.length, b);
}
const core = between('/* == walk-core:start ==', '/* == walk-core:end == */', 'walk core')
  .replace(/^[\s\S]*?\*\//, '');   // drop the marker's own block comment tail

const sandbox = {};
new Function('exports', `
  ${core}
  Object.assign(exports, { PLAN, colX, LANE_Y, standX, laneOf, handFor, turnFor,
    aisleLabel, aisleShort, walkSteps, planDoors, doorCol, doorDrop, doorCost });
`)(sandbox);

const { PLAN, colX, LANE_Y, standX, laneOf, handFor, turnFor,
        aisleLabel, aisleShort, walkSteps, planDoors, doorCol, doorDrop, doorCost } = sandbox;

/* ---- tiny assertion harness (same shape as catalog.test.js) ---- */
let pass = 0, fail = 0;
function section(t) { console.log('\n' + t); }
function ok(msg, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.log(`  FAIL  ${msg}${extra ? '  [' + extra + ']' : ''}`);
}
function eq(msg, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  console.log(`  FAIL  ${msg}\n        got  ${g}\n        want ${w}`);
}

const stop = (id, side, x, row, cns) => ({ id, side, x, row, cns: cns || ['WM 100 A1'], d: { start: 'A', end: 'Z' } });

/* ================= 1. Standing position ================= */
// You cannot read a face from inside the shelf. The stop is in the aisle beside the column,
// and which aisle depends on which way the face points.
section('standing position');

eq('a left face is read from the aisle to its west', standX(stop('top-6', 'left', 6, 'top')), 5.5);
eq('a right face from the aisle to its east', standX(stop('top-6', 'right', 6, 'top')), 6.5);
eq('half shelves are right-side-only and read the same way', standX(stop('bot-14', 'single', 14, 'bottom')), 14.5);

// The consequence that matters: one aisle serves two faces, and one column is two places.
eq('shelf 6 right and shelf 7 left are the same aisle',
   standX(stop('top-6', 'right', 6, 'top')), standX(stop('top-7', 'left', 7, 'top')));
ok('the two faces of one shelf are not the same place',
   standX(stop('top-6', 'left', 6, 'top')) !== standX(stop('top-6', 'right', 6, 'top')));

eq('top row stops are in the top lane', laneOf(stop('top-3', 'left', 3, 'top')), 'top');
eq('bottom row stops are in the bottom lane', laneOf(stop('bot-3', 'left', 3, 'bottom')), 'bottom');
eq('an unknown row falls back to the bottom, matching the x:8 fallback in groupStops',
   laneOf(stop('??', 'left', 8, '')), 'bottom');

/* ================= 2. Which hand ================= */
// Aisles run north-south. Facing INTO a top-row aisle you look north, so east is on your right;
// into a bottom-row aisle you look south and east is on your left. The shelf is on the side its
// face points away from — so the same `side` flips hands between the rows. This is the single
// most reversible thing in the file and the one a reader will trust blindly.
section('which hand the shelf is on');

eq('top row, left face — the shelf is east of you, which is your right', handFor('top', 'left'), 'right');
eq('top row, right face — the shelf is west of you, your left', handFor('top', 'right'), 'left');
eq('bottom row, left face — east is now your left', handFor('bottom', 'left'), 'left');
eq('bottom row, right face — west is now your right', handFor('bottom', 'right'), 'right');
eq('a half shelf faces east like any right face', handFor('bottom', 'single'), 'right');
ok('the hand flips between rows for the same face',
   handFor('top', 'left') !== handFor('bottom', 'left'));

/* ================= 3. Which way you turn ================= */
// Walking east the top row is on your left; walking west it is on your right.
section('turning into the aisle');

eq('heading east, the top row is a left turn', turnFor(1, 'top'), 'left');
eq('heading east, the bottom row is a right turn', turnFor(1, 'bottom'), 'right');
eq('heading west, the top row is a right turn', turnFor(-1, 'top'), 'right');
eq('heading west, the bottom row is a left turn', turnFor(-1, 'bottom'), 'left');
eq('no movement means no turn to describe', turnFor(0, 'top'), 'ahead');
ok('magnitude does not matter, only sign', turnFor(9, 'top') === turnFor(1, 'top'));

/* ================= 4. Naming the aisle ================= */
section('aisle labels');

eq('a normal aisle is named by the shelves either side', aisleLabel(6.5), 'the aisle between 6 and 7');
eq('the left face of shelf 0 is against the west wall', aisleLabel(-0.5), 'the west wall, before shelf 0');
eq('the right face of shelf 16 is the east end', aisleLabel(16.5), 'the east end, past shelf 16');

// The short form carries one stop's whole instruction on one line, so it drops the words.
eq('the short form names both shelves', aisleShort(6.5), 'aisle 6·7');
eq('and still says which end of the building', aisleShort(-0.5), 'west wall');
eq('at either end', aisleShort(16.5), 'east end');
ok('every aisle in the building has a short name',
   Array.from({length: 18}, (_, i) => aisleShort(i - 0.5)).every(t => t.length > 0 && t.length <= 12));

/* ================= 5. The path in words ================= */
section('turn-by-turn');

const steps = walkSteps(
  [stop('top-2', 'left', 2, 'top'), stop('bot-11', 'right', 11, 'bottom')], 6.5, 13.5);
eq('distances count shelves passed, which is what you can count', steps.map(s => s.shelves).join(','), '5,10');
eq('heading is signed', steps.map(s => s.head).join(','), '-1,1');
eq('first stop: walking west into the top row is a right turn', steps[0].turn, 'right');
eq('and the shelf is on your right', steps[0].hand, 'right');
eq('second stop: walking east into the bottom row is a right turn', steps[1].turn, 'right');
eq('with the shelf on your right too', steps[1].hand, 'right');
eq('the walk back to the stairwell is counted', steps.exitShelves, 2);
eq('numbering is 1-based and matches the map badges', steps.map(s => s.n).join(','), '1,2');

const same = walkSteps([stop('top-6', 'right', 6, 'top')], 6.5, 6.5);
eq('a stop in the aisle you arrived in has no distance', same[0].shelves, 0);
eq('and no turn to give', same[0].turn, 'ahead');
eq('nor any walk back out', same.exitShelves, 0);

// Bays are always whole: both endpoints are half-integers, so their difference is an integer.
const spread = walkSteps(
  [stop('top-0', 'left', 0, 'top'), stop('top-16', 'right', 16, 'top'), stop('bot-3', 'left', 3, 'bottom')],
  6.5, 6.5);
ok('every distance is a whole number', spread.every(s => Number.isInteger(s.shelves)),
   spread.map(s => s.shelves).join(','));

/* ================= 6. Plan coordinates ================= */
// The map draws in the floor plan's own viewBox, so a stop lands on the picture the app already
// shows. If these drift the walk is drawn over the wrong shelves.
section('plan coordinates');

eq('a column maps to the centre of its slot', colX(0), PLAN.startX + PLAN.slotW / 2);
eq('an aisle maps to the gap between two slots', colX(6.5), colX(6) + PLAN.slotW / 2);
eq('which is also the midpoint of its neighbours', colX(6.5), (colX(6) + colX(7)) / 2);

ok('the corridor lane sits between the two rows',
   LANE_Y.corridor > PLAN.topY + PLAN.topH && LANE_Y.corridor < PLAN.botY,
   `${LANE_Y.corridor}`);
ok('the top lane sits inside the top row',
   LANE_Y.top > PLAN.topY && LANE_Y.top < PLAN.topY + PLAN.topH);
ok('the bottom lane sits inside the bottom row',
   LANE_Y.bottom > PLAN.botY && LANE_Y.bottom < PLAN.botY + PLAN.botH);

/* ================= 7. Doors ================= */
// A stairwell is not a point. You walk down the west one from its west edge and arrive on the
// floor below at its EAST edge, so the same descent also carries you across the block — a router
// that treats both as one x-position picks the wrong stairwell on exactly the floors where the
// difference matters.
section('doors');

const D = planDoors();

ok('you walk down the west stairwell on its west side', D.wsDown.x < D.wsUp.x,
   `${D.wsDown.x} vs ${D.wsUp.x}`);
eq('and arrive at the same depth into the floor', D.wsDown.y, D.wsUp.y);
eq('the east stairwell keeps its column either way', D.esDown.x, D.esUp.x);
ok('but you go down at its north edge and come out at its south', D.esDown.y < D.esUp.y);
eq('the north edge is the corridor side', D.esDown.via, 'corridor');
eq('the south edge is the open floor side', D.esUp.via, 'lobby');
eq('the elevator opens south', D.elevator.via, 'lobby');

// The floor is walkable all the way round — both rows are islands and every aisle has two open
// ends. So the cost of a door is how far along you walk plus how far in it is set, with no
// forced detour through a gap. An earlier model sealed the bottom row except for two slots and
// made the south-facing doors far more expensive than they are.
ok('the east stairwell steps straight onto the corridor', doorDrop(D.esDown) < 1,
   `${doorDrop(D.esDown)}`);
ok('the elevator is a full row deeper in', doorDrop(D.elevator) > 3, `${doorDrop(D.elevator)}`);
eq('a door costs nothing extra to reach the column it is already at',
   doorCost(D.esDown, doorCol(D.esDown)), doorDrop(D.esDown));
ok('and costs more the further along you have to walk',
   doorCost(D.elevator, 16) > doorCost(D.elevator, 8));
ok('cost is symmetric about the door',
   Math.abs(doorCost(D.elevator, doorCol(D.elevator)+3)
          - doorCost(D.elevator, doorCol(D.elevator)-3)) < 1e-9);

// Door columns are read off the drawing, so they have to land where the blocks are.
ok('the elevator sits mid-building', doorCol(D.elevator) > 5 && doorCol(D.elevator) < 8,
   `${doorCol(D.elevator)}`);
ok('the east stairwell is out towards 13', doorCol(D.esDown) > 12 && doorCol(D.esDown) < 14,
   `${doorCol(D.esDown)}`);
ok('every door is inside the building', Object.values(D).every(d =>
   doorCol(d) >= 0 && doorCol(d) <= 16 && d.y >= PLAN.topY && d.y <= PLAN.botY + PLAN.botH));

/* ================= 7. The whole shipped script parses ================= */
// Cheap insurance. The route planner builds its SVG out of nested template literals, which fail
// at parse time and take the entire page with them — including the shelf lookup, which has
// nothing to do with routing.
section('index.html parses');

let scripts = 0, parsed = 0, firstError = null;
const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(HTML))) {
  scripts++;
  try { new Function(m[1]); parsed++; }
  catch (e) { if (!firstError) firstError = e.message; }
}
ok('there is inline script to check', scripts > 0, `${scripts} blocks`);
eq('every inline script block parses', parsed, scripts);
ok('no syntax error', firstError === null, firstError || '');

/* ---- report ---- */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
