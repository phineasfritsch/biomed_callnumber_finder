// Runs every test suite in this repository, and prints one count.
//
//   node Tools/all.test.js
//
// There is no test framework here and there are fourteen suites. Thirteen are hand-rolled and end
// in `N passed, M failed`; better_headcount/tests/logic.test.js uses node:test and ends in
// `pass N` / `fail N`. Running the suite meant remembering all fourteen names, so the answer to
// "did it shrink" was whatever the last person happened to run. verify/test.ps1 scrapes the line
// this prints, which is why the line ends in numbers rather than in a word.
//
// Three things it reports as a failure, by name, rather than absorbing. Each of them is a way a
// smaller number turns into a green one:
//
//   * A suite that printed no count. Four of these harnesses cut the shipped code out of
//     index.html and shelf-core.js by literal anchor, so moving code without moving its anchor
//     makes one of them throw before it asserts. That prints nothing, and nothing is not zero.
//   * A suite listed in EXPECTED and not on disk. better_headcount/ is its own git repository
//     sitting in this working tree, so a fresh clone has thirteen suite files and not fourteen,
//     and that has to read as a missing suite rather than as a smaller green total.
//   * A suite that reported no failures and then exited non-zero. Believing the count over the
//     exit code is how a run invents a pass.
//
// So a fresh clone reads failed=2, naming both halves of the same absence: logic.test.js missing,
// and ios/Tools/headcount.parity.test.mjs printing its SKIPPED notice and exiting 2 because the
// schema it diffs against is in that repository too. `skipped=` counts node:test's own skipped
// tests and has nothing to do with that word.
//
// EXPECTED is a manifest of absences, not a list of what runs: the walk decides what runs. That is
// the same split Tools/assets.test.js writes down for the published set, for the same reason.
//
// Tools/ is in .assetsignore, so this file is not published.

'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Relative to the repository root, forward slashes on every platform, in the order the walk sorts
// them so the two lists can be compared by eye.
const EXPECTED = [
  'Tools/assets.test.js',
  'Tools/catalog.test.js',
  'Tools/sru.test.js',
  'Tools/style.test.js',
  'Tools/walk.test.js',
  'Tools/worker.test.js',
  'Tools/xss.test.js',
  'better_headcount/tests/logic.test.js',
  'ios/Tools/confusable.test.js',
  'ios/Tools/fonts.test.js',
  'ios/Tools/geometry.test.js',
  'ios/Tools/headcount.parity.test.mjs',
  'ios/Tools/shelforder.test.js',
  'ios/Tools/swiftcheck.test.js',
];

// A suite takes about twenty seconds here, nearly all of it node's own start-up. None of them
// touches the network (sru.test.js sleeps on purpose, against a stubbed endpoint), so a suite that
// says nothing for five minutes has hung rather than waited, and the cap is long enough that a
// slow machine is not mistaken for one.
const TIMEOUT_MS = 300000;

// spawnSync's default is 1 MB, and a suite that overruns it comes back truncated AND flagged as an
// error, which would read here as "printed no count" rather than as what it is.
const MAX_BUFFER = 64 * 1024 * 1024;

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
const notes = [];
const rows = [];

function fail(name, detail) {
  failed++;
  failures.push(detail ? `${name}\n      ${detail}` : name);
}

/* ---- finding them ---- */

// .claude because the agent worktrees under it are second checkouts of this same repository, and
// walking one would find every suite twice and report the doubled total as good news. node_modules
// because a dependency's tests are not this project's. .git and .wrangler because nothing that
// runs lives in either, and Floors/ alone is over a thousand files to step past already.
const SKIP_DIRS = new Set(['node_modules', '.claude', '.git', '.wrangler']);

// Matched on the suffix, never on a substring. Tools/cql.replay.js fires real queries at UCLA's
// production catalog and is not a suite; it stays out of here because its name does not end in
// .test.js, and a looser match would sweep it in.
const SUITE = /\.test\.(js|mjs)$/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (SUITE.test(e.name)) {
      out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }
  return out;
}

const found = walk(ROOT, []).sort();

/* ---- reading what one of them said ---- */

// node:test colours its summary even when stdout is a pipe, and the escape sequence wrapping the
// line defeats a pattern written against `pass 52`. Built from a character code rather than typed
// into a regex literal, because an ESC byte sitting in a source file is one nobody can see, and
// the next tool to normalise it would leave a pattern that still looks right.
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

// The hand-rolled shape is tried first and the node:test shape only if it is absent. The other
// order lets a stray `pass 3` in a stack trace answer for a suite that never reported anything.
//
// The node:test patterns do not require its marker. The spec reporter writes `ℹ pass 52` and the
// tap reporter writes `# pass 52`, and NODE_TEST_REPORTER or a --test-reporter in NODE_OPTIONS
// decides which arrives; a run that chose the other one must not read here as a suite that printed
// nothing. What is required is the word, a space, digits, and nothing else on the rest of the line.
const ROLLED = /(\d+) passed, (\d+) failed/g;
const NODE_PASS = /(?:^|[^\w])pass[ \t]+(\d+)[^\S\n]*$/gm;
const NODE_FAIL = /(?:^|[^\w])fail[ \t]+(\d+)[^\S\n]*$/gm;
const NODE_SKIP = /(?:^|[^\w])skipped[ \t]+(\d+)[^\S\n]*$/gm;

// The last match, not the first. Five of these suites print their failure detail after their
// summary, and style.test.js prints a per-file budget note before it.
function lastMatch(re, text) {
  let m;
  let out = null;
  re.lastIndex = 0;
  while ((m = re.exec(text))) out = m;
  return out;
}

function readCounts(text) {
  const rolled = lastMatch(ROLLED, text);
  if (rolled) return { passed: +rolled[1], failed: +rolled[2], skipped: 0 };

  const p = lastMatch(NODE_PASS, text);
  const f = lastMatch(NODE_FAIL, text);
  if (p && f) {
    const s = lastMatch(NODE_SKIP, text);
    return { passed: +p[1], failed: +f[1], skipped: s ? +s[1] : 0 };
  }
  return null;
}

/* ---- running them ---- */

for (const rel of found) {
  const abs = path.join(ROOT, rel);

  // This file matches its own pattern and sorts before every other suite, so without this it runs
  // itself, and each copy runs itself again. Compared by resolved path rather than by name,
  // because a worktree holds a second file with exactly this basename.
  if (path.resolve(abs) === path.resolve(__filename)) continue;

  if (!EXPECTED.includes(rel)) {
    notes.push(`${rel} ran, but it is not in EXPECTED in this file, so its absence would go unnoticed`);
  }

  // process.execPath, so a suite is never run by a different node than the one running this, and
  // no shell, so the space in "C:\Program Files\nodejs" is never a quoting question. cwd is the
  // repository root because that is where all fourteen have been run from by hand.
  const r = spawnSync(process.execPath, [abs], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });

  if (r.error) {
    const why = r.error.code === 'ETIMEDOUT'
      ? `said nothing for ${TIMEOUT_MS / 1000}s and was killed`
      : r.error.message;
    rows.push([rel, 'did not run']);
    fail(rel, `${why}\n      a suite that could not run counts as a failure, never as a pass`);
    continue;
  }

  const out = ((r.stdout || '') + (r.stderr || '')).replace(ANSI, '');
  const counts = readCounts(out);

  if (!counts) {
    const tail = out.trim().split('\n').map(l => l.trim()).filter(Boolean).slice(-3).join(' / ');
    rows.push([rel, 'no count']);
    fail(rel, `printed neither "N passed, M failed" nor "pass N" / "fail N"\n      the last of what it did print: ${tail || '(nothing at all)'}`);
    continue;
  }

  passed += counts.passed;
  failed += counts.failed;
  skipped += counts.skipped;
  rows.push([rel, `${counts.passed} passed, ${counts.failed} failed`]);

  if (counts.failed > 0) {
    failures.push(`${rel} reported ${counts.failed} failing; run it on its own for which ones`);
  } else if (r.status !== 0) {
    fail(rel, `reported no failures and then exited ${r.status}; believing the count over the exit code would be inventing a pass`);
  }
}

for (const rel of EXPECTED.filter(f => !found.includes(f))) {
  rows.push([rel, 'MISSING']);
  fail(rel, 'expected here and not on disk, so nothing ran it\n      a suite that is gone is a failure, not a smaller total');
}

/* ---- report ---- */

const width = rows.reduce((w, r) => Math.max(w, r[0].length), 0);
for (const [rel, said] of rows) console.log(`  ${rel.padEnd(width)}  ${said}`);
failures.forEach(f => console.log('  FAIL ' + f));
notes.forEach(n => console.log('  NOTE ' + n));

// Last, and alone on its line. verify/test.ps1 takes the last match of total=, passed= and failed=
// independently of each other, over every line it was handed, so anything printed after this that
// happened to carry one of those tokens would be read as part of the count.
console.log(`\nTESTS total=${passed + failed + skipped} passed=${passed} failed=${failed} skipped=${skipped}`);

// Not process.exit(): on Windows a piped stdout is written asynchronously, and this line is inside
// two pipes at once when verify/test.ps1 runs it.
process.exitCode = failed ? 1 : 0;
