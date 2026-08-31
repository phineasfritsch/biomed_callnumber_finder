// The sentences this tool would be worse without.
//
//   node Tools/pins.test.js
//   node Tools/pins.test.js --where    # print where each pinned claim currently lives
//
// Every mature interface carries properties that nothing tests: a caveat under a number, a
// refusal to guess, an error that names the actual upstream, an empty state that explains itself.
// They accumulate one incident at a time. To anyone editing for appearance they read as ornament,
// and a rewrite deletes them while the whole suite stays green, because nothing ever asserted
// them. That is not a hypothetical: a wave elsewhere passed 1,744 tests while deleting seven such
// sentences.
//
// This file is the list. It was written from the code AS IT STANDS, not from a diff, which is the
// difference between protecting a change and grading it: a guard built from a diff can only find
// what has already gone.
//
// THREE RULES, each of which this file has already been bitten by:
//
// 1. PIN BY SIGNATURE, NOT BY LITERAL. Assert the smallest fragment that carries the meaning, so
//    a legitimate rewrite passes and a deletion fails. Pin the whole sentence and every honest
//    edit fails, you get tired of it, and you start editing the guard instead of the code. A
//    guard people learn to edit is worse than no guard, because it looks like one. Signatures are
//    capped at 90 characters below, mechanically, so that rule cannot quietly lapse.
//
// 2. SEARCH THE WHOLE APP, NOT THE FILE. A refactor legitimately moves copy into a shared partial
//    or a helper's argument. A check that only looks where the sentence used to live calls every
//    relocation a deletion and becomes noise within a day. So `home` below is where each claim
//    lives today and is INFORMATIONAL: a claim found somewhere else is reported as moved and
//    passes. Only a claim found nowhere fails.
//
// 3. STRIP COMMENTS FROM WHAT IS SEARCHED. Otherwise a deleted sentence, quoted in the comment
//    explaining its deletion, satisfies the very test protecting it. Seven deletions survived
//    exactly that way elsewhere. The stripper here is not a regex, and the reason is written above
//    stripComments.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WHERE = process.argv.includes('--where');

/* ---- what gets searched ---- */

function stripJs(src) {
  let out = '', i = 0, mode = 'code';
  const n = src.length;
  while (i < n) {
    const c = src[i], c2 = c + src[i + 1];
    if (mode === 'code') {
      if (c2 === '//') { mode = 'line'; i += 2; continue; }
      if (c2 === '/*') { mode = 'block'; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { mode = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === "'" || mode === '"' || mode === '`') {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === mode) mode = 'code';
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c2 === '*/') { mode = 'code'; i += 2; out += ' '; continue; } i++; continue; }
  }
  return out;
}

/* Two things this is not, both of which were tried first and were wrong.
   It is not /\/\*[\s\S]*?\*\//g. Applied to src/worker.js that deletes 20 KB of 35 KB, because an
   Accept header reads 'application/json, text/plain, *\/*' and the slash-star inside that string
   opens a comment which runs to the next real close. Every live string after it read as deleted.
   And it does not apply JS comment rules to markup. In HTML a double slash is not a comment, it
   is the middle of a URL, and doing so ate every paragraph containing a link. So in HTML only
   <!-- --> is a comment, and the JS rules apply strictly inside <script>. */
function stripComments(src, isHtml) {
  if (!isHtml) return stripJs(src);
  return src.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, o, b, c) => o + stripJs(b) + c);
}

const FILES = ['index.html', 'about.html', 'methodology.html', 'hours.html', 'map.html',
  'databases.html', '404.html', 'shelf-core.js', 'shelf-data.js', 'src/worker.js'];
const corpus = FILES.map(f => [f, stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'), f.endsWith('.html'))]);

/* ---- the pins ---- */

const PINS = [
  /* The product's whole argument, in the code that acts on it. If this sentence goes, the thing
     that replaces it is a tool that guesses, and a confident wrong aisle sends someone to a shelf
     of unrelated books and teaches them the map is broken. */
  { id: 'wrong-aisle-worse-than-none', kind: 'honesty', home: 'index.html',
    signature: 'a wrong aisle is worse than none',
    why: 'the stated reason the tool refuses to guess a shelf. Delete it and the refusals look like bugs.' },
  { id: 'unparsed-cn-shows-no-shelf', kind: 'refusal', home: 'index.html',
    signature: 'No shelf is shown',
    why: 'a call number that did not fully parse never gets an aisle derived from it.' },
  { id: 'holding-without-cn-refused', kind: 'refusal', home: 'index.html',
    signature: 'no call number, so no shelf can be resolved',
    why: 'a holding with no call number is said to have none, rather than being quietly skipped.' },
  { id: 'unmapped-range-refused', kind: 'refusal', home: 'index.html',
    signature: 'falls outside every recorded shelf range',
    why: 'the survey is not the whole building, and the page says so instead of picking the nearest shelf.' },
  { id: 'unrouted-location-refused', kind: 'refusal', home: 'index.html',
    signature: 'not in the routing table yet',
    why: 'a Biomed location with no route sends the reader to the desk rather than into the stacks.' },

  /* Where a copy actually is, when it is not on a shelf you can walk to. Each of these is a
     different answer and collapsing them into one "unavailable" would be a worse answer four
     times over. */
  { id: 'reserves-say-ask-the-desk', kind: 'refusal', home: 'index.html',
    signature: 'Ask at the Circulation Desk',
    why: 'Reserves are behind the desk. Sending someone to a shelf for one wastes a trip.' },
  { id: 'special-collections-by-arrangement', kind: 'refusal', home: 'index.html',
    signature: 'access is by arrangement',
    why: 'Special Collections cannot be browsed, and saying so prevents a wasted visit.' },
  { id: 'srlf-is-offsite', kind: 'refusal', home: 'index.html',
    signature: 'not in this building; request it in the catalog',
    why: 'SRLF is offsite. Without this the reader walks the stacks for a book in another county.' },
  { id: 'media-not-in-stacks', kind: 'refusal', home: 'index.html',
    signature: 'not in the stacks, so no shelf is shown',
    why: 'discs live at a service desk; the refusal names why rather than showing a blank.' },
  { id: 'ill-placeholder-has-no-shelf', kind: 'refusal', home: 'index.html',
    signature: 'no shelf anywhere to walk to',
    why: 'a resource-sharing placeholder is not a copy, and is not shown as one.' },

  /* Who is speaking, and on whose authority. */
  { id: 'not-affiliated-with-ucla', kind: 'honesty', home: 'about.html',
    signature: 'Not affiliated with, or endorsed by, the UCLA Library',
    why: 'this is one person\'s hand survey, not the library speaking. On every page, deliberately.' },
  { id: 'map-surveyed-by-hand', kind: 'honesty', home: 'index.html',
    signature: 'surveyed by hand',
    why: 'names the provenance of the shelf data, so a reader can weigh it.' },

  /* What leaves the browser. This persona bounces the instant a page is vague about it. */
  { id: 'covers-name-the-third-party', kind: 'privacy', home: 'index.html',
    signature: 'openlibrary.org',
    why: 'the cover-art checkbox names the third party it sends an ISBN to, rather than saying "show covers".' },
  { id: 'ocr-runs-in-the-browser', kind: 'privacy', home: 'about.html',
    signature: 'in your browser',
    why: 'text recognition is local. Readers photographing pull slips are entitled to know that.' },
  { id: 'photos-are-never-uploaded', kind: 'privacy', home: 'about.html',
    signature: 'never uploaded',
    why: 'the flat statement that the photos do not leave the device.' },

  /* The repair announces itself. A tool that silently corrects a typo and answers from the
     correction is a tool that answered a question nobody asked; the correction has to be visible
     or the reader cannot tell a repair from a wrong shelf. */
  { id: 'cutter-space-repair-is-stated', kind: 'honesty', home: 'index.html',
    signature: 'the cutter is one word',
    why: 'a stray space inside a W1 cutter is repaired rather than silently landing on the wrong face, and the page says so.' },

  /* The one box guesses where a query belongs. A silent guess would be worse than not guessing. */
  { id: 'routing-guess-is-stated', kind: 'honesty', home: 'index.html',
    signature: 'Read as a call number',
    why: 'the box says which way it sent the query instead of silently choosing.' },
  { id: 'routing-guess-is-reversible', kind: 'honesty', home: 'index.html',
    signature: 'Treat it as a call number instead',
    why: 'the guess is reversible in one click. Without this the reader has no way to correct it.' },
  { id: 'catalog-scope-is-named', kind: 'scope', home: 'index.html',
    signature: 'Searched the catalog',
    why: 'the status line names the scope an answer came from. A narrowed answer is otherwise indistinguishable from a gap in the collection.' },

  /* An error that names the actual upstream is a different thing from "something went wrong":
     one of them tells a desk worker whether to wait or to phone somebody. */
  { id: 'libcal-failure-names-libcal', kind: 'error-text', home: 'hours.html',
    signature: 'Could not reach LibCal',
    why: 'names which service failed, so the reader knows the hours are stale rather than wrong.' },
  { id: 'catalog-failure-names-catalog', kind: 'error-text', home: 'index.html',
    signature: 'Could not reach the catalog',
    why: 'distinguishes an upstream outage from a search that found nothing.' },
  { id: 'articles-failure-names-index', kind: 'error-text', home: 'index.html',
    signature: 'Could not reach the article index',
    why: 'the article index is a different upstream from the catalog and fails separately.' },
  { id: 'databases-failure-points-elsewhere', kind: 'error-text', home: 'databases.html',
    /* "Could not reach", so the page's prefix and the worker's sentence agree instead of saying
       two different things in one breath. The claim is the same one: the list failing says so and
       points the reader at the library's own A to Z. */
    signature: 'Could not reach the database list',
    why: 'and the same message points at the library\'s own A-Z, so the reader is not stranded.' },

  /* Nothing found is a real answer and has to look like one. */
  { id: 'zero-results-say-so', kind: 'empty-state', home: 'index.html',
    signature: 'Nothing matches',
    why: 'an empty result set says so rather than rendering as a blank page.' },
  { id: 'repair-is-flagged-as-a-guess', kind: 'honesty', home: 'index.html',
    signature: 'Still nothing for',
    why: 'when the spelling repair also fails, the page says so instead of presenting a guess as a hit.' },

  /* The worker is not an open proxy, and it says what it refused. */
  { id: 'worker-refuses-empty-query', kind: 'error-text', home: 'src/worker.js',
    signature: 'q is required',
    why: 'a query-less request is refused at the edge rather than passed upstream.' },
  { id: 'worker-caps-paging', kind: 'scope', home: 'src/worker.js',
    signature: 'offset cannot be past',
    why: 'deep paging is bounded, so the worker cannot be used to spend an upstream\'s time.' },
  /* Reworded deliberately, not deleted. The worker's outright-failure string was a full sentence
     while every sentence beside it is a noun phrase, so the page wrapping it in "Could not reach
     the article index: " produced "Could not reach the article index: could not reach the article
     index." on exactly the failure the message exists for. The property pinned here is unchanged:
     the worker names WHICH upstream did not answer rather than returning a bare status. */
  { id: 'worker-names-upstream-failure', kind: 'error-text', home: 'src/worker.js',
    signature: 'the article index did not respond',
    why: 'the worker\'s own 502 names the upstream rather than returning a bare status.' },
  { id: 'databases-worker-failure', kind: 'error-text', home: 'src/worker.js',
    signature: 'the database list did not respond',
    why: 'the A-Z list has its own upstream and its own 502, named separately from the article index.' },

  /* Two properties that exist only for readers who never see the layout. Nothing about the page
     looks different when they go, which is exactly why they need pinning. */
  { id: 'skip-link-exists', kind: 'accessibility', home: 'index.html',
    signature: 'class="skip"',
    why: 'a keyboard reader can get past the nav. Tools/cohesion.test.js asserts all seven pages have one.' },
  { id: 'result-is-a-live-region', kind: 'accessibility', home: 'index.html',
    signature: 'aria-live="polite"',
    why: 'an answer that arrives asynchronously is announced. Without it the result silently did not happen.' },
];

/* ---- check ---- */

let pass = 0;
const failures = [];
const moved = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return true; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
  return false;
}

console.log('the guard itself');
ok('every pin has a unique id', new Set(PINS.map(p => p.id)).size === PINS.length);
ok('no two pins assert the same fragment', new Set(PINS.map(p => p.signature)).size === PINS.length);
/* The cap is the rule made mechanical. Without it "pin by signature, not by literal" is advice,
   and the first person in a hurry pins a paragraph. */
const tooLong = PINS.filter(p => p.signature.length > 90);
ok('every signature is a fragment, not a sentence', tooLong.length === 0,
  tooLong.map(p => `${p.id}: ${p.signature.length} chars`).join('\n      '));
const tooShort = PINS.filter(p => p.signature.length < 10);
ok('no signature is short enough to match by accident', tooShort.length === 0,
  tooShort.map(p => p.id).join(', '));
ok('every pin says what breaks without it', PINS.every(p => p.why && p.why.length > 25));

console.log('\nthe claims');
for (const p of PINS) {
  const found = corpus.filter(([, text]) => text.includes(p.signature)).map(([f]) => f);
  if (!ok(`${p.id}`, found.length > 0,
    `NOT FOUND ANYWHERE: ${JSON.stringify(p.signature)}\n      ${p.why}\n      ` +
    `If this was deliberately reworded, update the signature to the smallest fragment of the NEW\n      ` +
    `wording that carries the same meaning. If it was deleted, put it back.`)) continue;
  if (!found.includes(p.home)) moved.push(`${p.id}: left ${p.home}, now in ${found.join(', ')}`);
  if (WHERE) console.log(`  ${p.id.padEnd(36)} ${found.join(', ')}`);
}

if (moved.length) {
  /* Moving is legal and common. It is reported so a reader of this output can tell a relocation
     from a deletion, which is the whole reason the search is app-wide. */
  console.log(`\n${moved.length} claim(s) moved but survive:`);
  moved.forEach(m => console.log('  ' + m));
  console.log('  Update `home` in this file when you are satisfied the move was deliberate.');
}

console.log(`\n${pass} passed, ${failures.length} failed`);
failures.forEach(f => console.log('  FAIL ' + f));
process.exit(failures.length ? 1 : 0);
