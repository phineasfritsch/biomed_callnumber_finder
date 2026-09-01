# When the board says it is finished

## The deadline

**Fall Quarter 2026 begins Monday, 21 September. Instruction begins Thursday, 24 September.**
Verified against the UCLA Registrar's annual academic calendar, which the container can read
directly, rather than from a search summary.

Twenty-one days from 31 August. The date is not negotiable and does not move because the work is
interesting: the product exists so that a desk worker with a queue can find a shelf, and the queue
arrives in week one. A tool that is perfect in October was not there when it was needed.

**So the cut rule, decided now rather than at 2am on the 20th.** If the port is not complete, ship
what is complete. A site that is visually inconsistent for a fortnight costs less than missing the
window the product exists for. What may never be cut is correctness: a half-ported site must not
contain a surface that asserts a location it did not look up, and every pin stays green. Ugly is
survivable. Wrong is not.

Order of cutting, if it comes to that: error states and the 404 first, then /methodology and
/about, then /databases and /hours, then /map, and /home last. Home is the task; everything else
is support.

## Who decides

Not the person building it, and not one reviewer. **A ship review** is run against the DEPLOYED
site: the six constrained readers from `ops/PANEL.md`, each driving the real thing, then a pass
whose default is to refute every finding they raise. The verdict is a count, not an opinion.

The one thing the board may never do is rule on taste. Palette, typeface and brand are out of remit
under G7 and go to a person. That means **the board can never declare this finished on its own**:
a human look is a required input, not a formality. See "the human gate" below.

## Unanimity

The owner's instruction: **they all need to agree that it is ready to ship.** So the verdict is not
a count of findings, it is six separate answers to one question, and one dissent is a failed round.

Each of the six constrained readers, having driven the deployed site, answers **SHIP** or
**NOT YET** for themselves, and a NOT YET must name the specific thing that would change it. Not a
score, not a rating, not an average. A reader who would not hand this to the person they stand for
is a reader who says NOT YET, and one of those ends the round.

This is deliberately harder than counting findings, and it is harder in the right direction. A
round can have zero blocking findings and still fail, because the screen-reader user can be
technically unblocked and still say she would not recommend it. That sentence is worth more than
any count.

A NOT YET is not a defeat. It is the work queue for the next round, in the reader's own words.

## The bar

Unanimity is the gate. These eight are what the readers are asked to judge against, and what a
round records whether it passes or not:

1. **No upheld finding at `blocks-the-task`.** Zero. A task nobody can finish is not a product.
2. **No upheld finding at `costs-time-or-trust`.** Zero. This is the severity that made a reference
   librarian say she would not let it answer an edition question.
3. **Papercuts are allowed**, and their count is recorded so it can be seen to be falling. A round
   that only produces papercuts is a passing round.
4. **The cohesion verdict is "one product"**, in those words, from a reviewer whose only job was to
   look for the seams.
5. **All seven rulings in `ops/DIRECTION.md` are met**, each named individually rather than waved at
   collectively. G3 in particular: a newcomer finishes the task unaided and an expert pays nothing
   for it.
6. **`ops/test` green at or above baseline, `Tools/ui.test.js` green, `pins` green, `cohesion`
   green.** A count that fell is a failure even when everything is green.
7. **`ops/parity` exits 0 or 2.** Exit 1 means the deployment carries work in no commit; a product
   whose live version cannot be reproduced from its repository is not finished, it is merely up.
8. **`ops/health` exits 0.** Every upstream answering, nothing BAD, and nothing BLOCKED, because a
   check that could not look has no opinion and an unopinionated check cannot certify anything.

## The human gate

Three things no review round can close, and all three must be signed off by a person:

- **The renders.** `ops/shots/` at both widths. A panel ranks whether a layout serves a task; it
  cannot tell you something is ugly, off-brand or embarrassing.
- **The eleven out-of-remit decisions** in `ops/DIRECTION.md`, or an explicit waiver of each. Two of
  them are load-bearing rather than cosmetic: which physical features on each level count as
  verified landmarks, and the paper-crop walkthrough with real newcomers that settles this
  direction's central risk.
- **The live-ahead merge.** Until it clears, the deployed site cannot be rebuilt from this
  repository, so criterion 7 cannot pass.

## What a round reports

Every ship review writes its verdict here, appended, whether it passed or not. A failed round is
the more useful record: it says what the bar caught.

    round · date · commit · days to 21 September
    desk worker      SHIP | NOT YET — the one thing that would change it
    reference librarian
    distrusting patron
    newcomer
    screen-reader user
    cohesion reviewer
    ----
    blocks-the-task: N   costs-time-or-trust: N   papercuts: N
    rulings met: G1..G7, or which failed
    gates: test/ui/pins/cohesion/parity/health
    verdict: SHIP (six of six) | NOT YET (N dissenting)

## Rounds

**Round 0 — baseline, 31 August, 21 days out.** Run deliberately before any porting, not to
discover whether it ships (it does not) but to convert "24 upheld findings" into six named lists:
what each reader personally needs before they would say SHIP. That is the work queue for the
rewrite, in the words of the people it is for. Recorded below when it returns.

---

### Round 0 — 31 August, 21 days out, commit c466de8

    reference librarian   SHIP
    distrusting patron    SHIP
    first-year on a phone SHIP
    screen-reader user    SHIP
    desk worker           NOT YET
    cohesion reviewer     NOT YET
    ----
    verdict: NOT YET (4 of 6)

NOT YET, two dissents of six. Four readers — the reference librarian, the privacy-skeptical patron, the first-year on a phone, and the screen-reader user — would hand Shelfmark over today, and each said in their own words that nothing must be fixed before week one. The two NOT YETs are the same defect seen from two seats: an input that is not a call number, or not entirely a call number, gets answered with a confident, specific shelf face instead of a refusal. One guard, applied at parse time and consumed by the home box, the map box and the route builder, clears both dissents; neither dissenter asked for anything else before the quarter starts.

**Must land before 21 September**, from the readers own answers:

- Item 1 — the input-validation guard (silent token-drop in the cutter; prose answered with a shelf face on /map). Both dissenters named this, in different words, as the single thing that flips their vote.
- Item 2 — unparseable lines land in 'Not located' in the pickup walk instead of becoming a stop. Named explicitly by the cross-surface reader as must-fix; it is the same guard at a second call site and will not land by itself.
- Nothing else. Every SHIP vote answered the ship-anyway question with 'nothing must be fixed before week one', and both NOT YETs said they would ship with no other change. Items 3–10 are the week-two queue; holding the quarter for any of them would be overriding the readers' own stated bar.

**The queue this round produced**, ordered by what flips the most votes soonest:

- **1.** One input-validation guard: no input may be answered with a shelf face unless the whole string parsed as a call number. Either normalise and say what was read ("Read as W1 AM4990"), or refuse ("No mapped shelf contains X"). Never silently drop a token, never answer prose.  *(unblocks: Desk worker AND cross-surface reader — MERGED, see 'merged')*
- **2.** Make the pickup-walk route builder consume the same verdict: an unparseable line becomes a 'Not located' entry, not a stop.  *(unblocks: Cross-surface reader (second blocking finding))*
- **3.** One plain sentence glossing 'index' at the point of the answer — e.g. 'index 10 = the 10th shelving unit along the row.'  *(unblocks: First-year on a phone)*
- **4.** Rank or group the 2025 twenty-second edition with the 2018 record badged '17 EDITIONS · NEWEST SHOWN' so the newest Harrison's is not read off the older row.  *(unblocks: Reference librarian)*
- **5.** Reword '27 records in Biomed Library' to '27 records in this search · 25 shown'.  *(unblocks: Reference librarian)*
- **6.** Have /hours speak the actual hours, not only open/closed state.  *(unblocks: Screen-reader and keyboard user)*
- **7.** Interim 'Searching UCLA's catalog…' announcement in the live region on Enter.  *(unblocks: Screen-reader and keyboard user)*
- **8.** Half-sentence on /about pointing at /methodology's fuller accounting (Google Fonts on every page load, Open Library covers).  *(unblocks: Privacy-skeptical patron)*
- **9.** Surface /about (the explainer) in the top nav, not only the footer.  *(unblocks: First-year on a phone)*
- **10.** Consistency sweep: the three different counts of UCLA libraries (21 on the home pills, 'all 27 UCLA locations', 'nine libraries'), the 404's 'Shelfmark is four of them' when there are more surfaces, and 'Could not reach LibCal: Failed to fetch.' leaking browser jargon where other surfaces name an HTTP status.  *(unblocks: Cross-surface reader (non-blocking notes))*

**The caution that mattered most**, and it was right:

> Neither dissent is weak, and the round should not have passed. Both were driven live, both produced a specific wrong shelf face for input a real desk sees, and both sit exactly on the standard the tool sets for itself in its own code — 'a wrong aisle is worse than none'. The desk worker hit theirs on the fourth thing they typed, without hunting. Marking either as a preference would be dishonest.
> What is worth noting is the discipline in both dissents: each separated the blocker from the wish list and shipped everything else. The cross-surface reader could have blocked on the three inconsistent library counts, the 404's arithmetic and the LibCal error jargon — all real, all filed as notes. Had the NOT YET rested on those, it would have been a preference dressed as a blocker and the round should have passed. It did not.
> One caution for the next round: item 1 and item 2 are one defect with two call sites. A fix that lands only in the home box will read as 'the blocker is fixed' and will not move the cross-surface vote. Both dissenters should re-drive their own reported strings — 'W1 AM 4990', 'asthma', 'banana bread', and the four-line paste — before the round is called.

---

### Round 1 - 31 August, 21 days out, commit 9cd5e6e

    desk worker            NOT YET
    reference librarian    NOT YET
    distrusting patron     NOT YET
    first-year on a phone  NOT YET
    screen-reader user     NOT YET
    cohesion reviewer      NOT YET
    ----
    verdict: NOT YET (0 of 6)

Worse than round 0 on the count, and better than round 0 on the evidence. Every one of the six
found the same defect independently, with six different paste lists, and every one of them waived
everything else they found. Round 0 had passed four readers who never opened the pickup walk.

**The defect.** The guard added after round 0 went into `findFaces`, and a comment in
`shelf-core.js` said that everything resolving a shelf goes through `findFaces`, naming the route
builder among them. That sentence was written before it was true. `map.html` carried a second,
independent copy called `routeLocate`, so the pull-list walk never saw the guard. Pasting a list
the way a real shift produces one returned "asthma" and "banana bread" as stops on Level 11 with
the words printed on the shelf face, counted by the summary as "5 books across 3 floors", while
"W1 AM 4990" routed to index 4 and the box six inches above it answered index 9.

The round-0 tally had warned about exactly this shape: *"a fix that lands only in the home box
will read as 'the blocker is fixed' and will not move the cross-surface reader's vote."* The fix
did land in more than the home box. It landed in every call site that went through the shared
parser, and the one that did not was the one nobody had counted.

**Fixed in `c1cef82`.** `routeLocate` delegates to `findFaces`. Items 1 and 2 landed together, as
the tally asked, because item 2 is a few lines on item 1's own code path and item 1 alone would
hand a reader a silently shortened walk. Verified against all 651 range endpoints: none route
differently, and the only string the guard rejects is the bare "A" that opens Special Collections,
which is a range endpoint rather than a query. Five new assertions, all five red against the
previous commit.

**What the round is worth as a process result.** Six of six is not a worse outcome than four of
six; it is a better-instrumented one. The retest note handed every reader the strings the previous
round had failed on and told them not to take the fix on trust. Four readers who had voted SHIP in
round 0 opened a surface they had not opened before, and found the defect the two dissenters had
predicted would survive a partial fix. The instruction that produced that was one sentence: do not
assume the rest of the site is unchanged, because a fix can regress a surface you care about.

**Filed as queue items rather than bars**, on the tally's own reading, since both are contradicted
by the readers' own ship-anyway answers: the map's refusal wording for a non-call-number ("No
mapped shelf contains ASTHMA" reads as though asthma were a call number the survey missed), and
the missing route-position announcement for a screen-reader user. Also noted: the `/map` detail
panel does not clear under a refusal, so a stale shelf face stays on screen labelled with the
previous call number.

---

### Round 2 - 1 September, 20 days out, commit c1cef82

    desk worker            SHIP
    reference librarian    SHIP
    distrusting patron     SHIP
    first-year on a phone  SHIP
    screen-reader user     SHIP
    cohesion reviewer      SHIP
    ----
    verdict: SHIP (six of six)

**Unanimity, on the third asking.** Every reader drove the pickup walk with a deliberately dirty
paste of their own composing, and every one confirmed the round-1 defect is gone: junk lines are
quarantined without a shelf face, the summary counts only lines that resolved, the cutter repair is
announced rather than done silently, and the same string yields the same shelf in the walk as in
the box above it.

**What makes this verdict worth trusting more than round 0's four-of-six.** Round 0 passed four
readers who had never opened the surface that was broken. This round each reader was told to drive
a surface they had not driven in any previous round, and they did: /databases, the article path,
the phone-width title journey, the keyboard walk through the planner. The verdict is over more of
the product than any round before it.

**Nobody was argued down.** There is no dissent to weigh, and the three items carried over from
round 1 were re-judged rather than inherited: five of the six readers named a *different* "smallest
thing to fix first", and not one of them named something that asserts a location the tool did not
look up, which is the only failure this project treats as disqualifying.

**The queue this round produced**, which the tally asks to land before 21 September even though the
verdict is SHIP:

- **1.** Clear the /map detail panel and drop the red shelf outline on a refusal. Four readers named
  it as their one fix. It is the only place in the product where two contradictory things sit on
  screen at once: a refusal at the top, a lit shelf face below it. Every one of the four said the
  same thing about why it is not a blocker - the leftover panel still names the *previous* call
  number, so it is stale rather than lying, and three of them said in their own words that if it
  were relabelled with the refused string they would flip to NOT YET.
- **2.** Announce the route result in the existing live region, or move focus to it. One reader, but
  it is his whole note and it is reachability rather than preference: he presses BUILD ROUTE and
  hears nothing.
- **3.** Let the /map refusal borrow the walk's own wording for a string that is not a call number.
  "No mapped shelf contains ASTHMA. It may be on a level not yet entered" is a true refusal with a
  false account of why, and the route builder already has the right sentence.
- **4.** Validate the echoed query on the zero-result suggestion line before rendering it.

**The gate is not closed by this.** `ops/SHIP.md` requires the human gate as well, and it is not
something the board can close on its own: the live site is still ahead of this repository in
`index.html` and `site.css`, and only whoever ran wrangler can resolve that.

---

### Round 3 - 1 September, 20 days out, commit d6ed584

    desk worker            SHIP
    reference librarian    SHIP
    distrusting patron     SHIP
    first-year on a phone  SHIP
    screen-reader user     SHIP
    cohesion reviewer      SHIP
    ----
    verdict: SHIP (six of six)

**Two unanimous rounds, and the second one is the one that counts.** Round 2 passed the tool as it
stood; round 3 was run because four things changed after that verdict, and a round that only
confirms an earlier round is worth nothing. Every reader was pointed at the four changes and told
to judge them adversarially, as somebody else's work.

All four held. Between them the six probed roughly forty call-number inputs - lowercase, missing
spaces, split cutters, bare Dewey, LC classes, trailing whitespace - and found exactly one class of
failure, which is recorded below and is now fixed.

**What round 3 found, and it was the best finding of any round.** Three readers, independently,
typed a call number without spaces. The parser treated spaces as structure rather than
punctuation, and the results were inconsistent in a way nobody could have predicted from reading
the code:

    wb115h322     "is not a call number"      while /about promises spaces are optional
    W1AM4990      "No mapped shelf contains"   a miss dressed as a gap in the survey
    W 1 AM4990    Level 10, index 4            a WRONG SHELF, seven levels from the book

The reason for the inconsistency: the class-number test ended in a word boundary, so it depended on
whether punctuation happened to follow the digits. `WA900.1M300` parsed because a dot is a
boundary. `WB115H322` did not, because `H` is not. Two inputs of identical shape, one accepted and
one called nonsense.

The first of those is the one that mattered most to the board, and rightly: it is the only place in
the product where the tool asserted something untrue rather than admitting ignorance, and it
contradicted the site's own documentation while doing it. The third is worse in effect and nobody
had found it in three rounds of driving.

**Fixed by normalising spacing once, before any lookup, and saying what was read.** A repair is
adopted only when it earns its place: when the repaired form resolves and the raw one does not, or
when the repair changes which comparator runs, which is the `W 1 AM4990` case where the raw form
resolves confidently to the wrong floor. Verified as a no-op on all 651 range endpoints.

**And the fix was itself wrong on the first attempt**, which is worth recording. Normalising every
two-or-fewer-letter stem turned `H1N1` into `H 1 N1`, which really does sort inside a mapped range
on level 11 - a virus name answered with a shelf face, the exact failure this product exists to
refuse. A one-letter class stem run together with digits is indistinguishable from an acronym, so
the repair now declines to guess at those. `H 62 B113s` and `Q 41 R81R8`, typed the normal way, are
untouched.

**Also landed from this round's queue:** the `/map` status line no longer outlives the question it
answered; the catalog's zero-result outcome and its spelling suggestion are announced rather than
only drawn, which closed a silent dead end for a screen-reader user at the desk; and the location
count contradiction is gone. On that last one, both numbers were wrong to hardcode: LibCal returns
32 today, `/about` claimed 27, and the count can change without anyone noticing. The prose no
longer states a number, and the page keeps counting live.

---

### Round 4 - 1 September, 20 days out - VOID

    verdict: VOID (not counted, in either direction)

**This round is not a result, and the reason is my error.** It was launched against `92fb640` and
I then rewrote `shelf-core.js` twice while its six readers were driving it. Every previous round in
this file was run against a frozen tree for exactly this reason: a verdict about a moving target
describes nothing, and recording it as a pass or a fail would put something in this file that looks
like evidence and is not. The votes it returned (five SHIP, one NOT YET) are discarded.

**One finding survives being void, because it was checked afterwards against the committed tree and
reproduces.** The reference librarian drove a phrase rather than a call number:

    B12 deficiency      -> Level 11 · top row · index 1 · Left side
    CD4 count           -> Level 11 · top row · index 3 · Left side
    IL6 signaling       -> Level 11 · top row · index 3 · Right side
    K2 vitamin therapy  -> Level 11 · top row · index 3 · Right side
    vitamin B12         -> the catalog, correctly

A phrase a patron says out loud at the desk, answered with a confident shelf face, with the
remaining words silently discarded and the catalog never asked. The same topic with the words the
other way round behaved correctly, which is what made it findable.

The cause is one character's worth of oversight, and it is old: the shape test was anchored at the
start and not at the end, so any string that merely BEGAN like a call number took the shelf path.
The fix is measured rather than guessed - across all 651 range endpoints there is not one purely
alphabetic token after the class, so a leftover English word means the string is a phrase. Fixed,
with four regression assertions, and verified not to cost any of the 906 endpoint lookups.

**What this says about the process, which matters more than the finding.** The void round still
produced the most valuable result of the four, and it did so because a reader ignored the brief.
The brief asked readers to attack the parser with mangled call numbers and with non-call-numbers;
it did not think to ask about a call number with a word after it. Every round that has found
something real found it slightly outside what it was told to look at.

The rule stands and I broke it: no shipped file changes while a round is in flight. The next round
runs against a commit and the tree stays frozen until it returns.

---

### Round 5 - 1 September, 20 days out, commit 76c424c

    desk worker            SHIP
    reference librarian    NOT YET
    distrusting patron     NOT YET
    first-year on a phone  NOT YET
    screen-reader user     NOT YET
    cohesion reviewer      NOT YET
    ----
    verdict: NOT YET (five dissenting)

**Five of six, all on the same defect, all found through the keyboard rather than the code.** The
third instance of the family the brief asked them to hunt, and the brief was right to ask:

    B12 1000mcg  -> Level 11 · top row · index 1 · Left
    CD4 350      -> Level 11 · top row · index 3 · Left
    D3 2000iu    -> Level 11 · top row · index 3 · Left
    T4 125       -> Level 10 · top row · index 4 · Left
    TP53 R175H   -> Level 10 · top row · index 4 · Left

A dose, a lab value, a variant. Answered with a confident physical location on a floor of
psychology and linguistics books.

**The sharpest thing said about it came from the sceptical patron**, and it is why this reads worse
than the two instances before it: bare `CD4` had been fixed and correctly reached the catalog,
while `CD4 350` - the more specific and more clinically real thing to type - got an aisle. The fix
for the previous instance made the failure harder to stumble into and no less wrong.

**My own sweep had missed it, and the way it missed is the lesson.** `ops/PARSER-SWEEP.md` ran 139
adversarial strings the day before and came back clean. It contained `1000mcg`. It contained `B12`.
It never combined them, because I generated the corpus from the shapes I had already thought of.
The board found it in four minutes of typing. A corpus tests the author's imagination; a person at
a keyboard tests the product.

**The counterweight is real and worth recording**, because it decides whether the next round is a
narrowing or a rebuild: all six readers, dissenters included, confirmed the round-4 fix did not
overshoot. Roughly sixty odd-but-real call numbers still reach their shelf - lowercase, spaceless,
three-token, `v.`/`c.`/year suffixes, Hist Div, W4C, W2, `WA 900.1 M300`.

**Fixed, in two conditions rather than one.** A call number typed with spaces separates its class
from its number, so a first token that runs letters into digits and is followed by more tokens must
have (1) letters that are a class the survey recorded, and (2) a next token opening with a letter,
because every genuine Cutter does. `Q10 100mg` passes the first and fails the second.

The first attempt used only condition (1) and refused 363 of the survey's own endpoints -
`WB39 M294`, `WA900.1 M297` - which is the same lie in the other direction. Caught before it
shipped by running the check that round 4's finding had already made routine.

**Deliberately not fixed:** `AS 36 N4` still resolves, and should. It is a real LC number in a
class this survey never used as a range endpoint, and it genuinely sits on the shelf that runs
`AG 5` to `BF 57`. Refusing it to tidy the rule would be the failure this round is about, pointed
the other way.

---

### Round 6 - 1 September, 20 days out, commit e23b6e7

    verdict: NOT YET

Briefed to assume a fourth shape existed and that nobody had written it down. It did, and they
found it in both directions at once, which is what the accumulated rules had made inevitable.

**The fourth shape: the building's own room numbers.**

    CHS 12-077  -> Level 11 · top row · index 3 · Left
    CHS 17-187  -> the same face
    BOX 14      -> the same face
    LOT 7       -> Level 11 · top row · index 3 · Right

The Biomedical Library is inside the CHS building, so a room number is among the commonest things
a desk worker is handed. Three letters and a number, interpolated alphabetically into a real
surveyed range and stated as fact.

**And the overshoot, in the same round.** Ordinary LC numbers a patron pastes out of the catalog
were being refused: `QP141.G73`, `RA971 .M34`, and - worst - `WB115.H322 2018` and `QL737.C22 2011`,
where a trailing year disqualified a number that worked without it. `QL737.C22` is the example
printed on the home page and on the map page, so the product was teaching the exact form that
broke.

**Worse than either: the override reported a parse failure as a survey fact.** Clicking "Treat it
as a call number instead" on a refused string answered *"No mapped shelf contains WB115.H322
2018"* - for a number the map holds, on the row it had just drawn. As the librarian put it: a
refusal makes somebody retype, a false survey fact makes them stop looking. That distinction now
holds on both surfaces.

**Why this round is the one that changed the design rather than adding a rule.** Four rules had
accumulated, one per defect, each right about the case that produced it and wrong about the next.
By this round they contradicted each other: a room number resolved while a real LC number did not.
They are replaced by a grammar - CLASS, NUMBER, Cutters, then years and volume marks - with exactly
two places that consult the survey rather than a pattern, and both are written down and justified
where they sit.

The grammar immediately caught three things the rules never had: `W1 A1Q2` and its siblings, whose
Cutters alternate letters and digits more than once; `BF 789 D4 6456s`, whose second Cutter opens
with digits; and `WC 160 G7.78T`, whose Cutter carries a decimal. All three are in the survey, and
all three had been refused.

**A silent assertion loss, caught by the count rather than by a failure.** `Tools/ui.test.js` fell
from 150 assertions to 149 while still reporting green. `settled()` only asserts a region is on
screen when that region has text, so an answer area that goes empty takes its assertion with it.
The grammar had routed a concatenated string to the catalog and left `#result` blank - and a blank
at speed reads as a page that failed to load, which is the one thing the direction says a refusal
must never look like. Now asserted unconditionally against both regions, so it cannot vanish again.
This is exactly what the falling-count rule exists for and the first time it has paid out.

---

### Round 7 - 1 September, 20 days out, commit 825a96f

    desk worker            SHIP
    reference librarian    SHIP
    distrusting patron     SHIP
    first-year on a phone  SHIP
    screen-reader user     SHIP
    cohesion reviewer      NOT YET
    ----
    verdict: NOT YET (one dissenting)

**Five to one, and the dissent was right.** The grammar held on the side that failed round 6:
room numbers, Dewey, gene loci, IP addresses, court citations, version strings, measurements and
coordinates were all refused on every surface. What it got wrong was the other direction, and it
got it wrong in a way the product itself contradicted:

    WB 115 H248p 1998        -> Level 10 · index 10 · Right
    WB 115 H248p 1998 Supp.  -> "that was not read as a call number"

Shelfmark's own catalog panel prints that second string with a shelf face beside it. Two of its
surfaces disagreed about one book. Five of six readers named it; four called it a survivable dead
end and one would not hand it to a patron, and his second finding - that the pickup walk dropped
those lines and reported a count as if they had never been typed - is what makes the dissent a
blocker rather than a preference.

**Fixed, and the shape of the fix is a closed list.** A supplement or an index shelves with the
book it belongs to, so a trailing `Supp.`, `Suppl.`, `Index`, a bracketed year or a `+` is stripped
and named. The tempting version strips any trailing word that stops the parse, and that version
hands back every defect of rounds 4 to 6: "B12 deficiency" becomes "B12" and a phrase is a shelf
again.

**And the list is narrower than the first draft, for a reason found while writing it.** That draft
also stripped `Folio`, `Oversize`, `Microfilm`, `Thesis` and `Reserve`. Every one of those names a
DIFFERENT PLACE - an oversize volume, a reel and a reserve copy are not on the shelf the stacks
number points at - so stripping them would have answered with a face nobody looked up. It also
stripped `atlas`, which is a word in book titles, and turned "WB115 atlas" into a shelf. The
failure being fixed, reintroduced while fixing it, caught by the corpus rather than by a reader.

**Three further things this round produced, none of them in its brief.**

- **The false accept it did name:** `H.R. 3590` reached Level 11, because the letters were read off
  the front and the dots ignored, leaving "H", which is a real class. A class is letters and
  nothing else now.
- **A fifth shape I found while the round was in flight**, by feeding the grammar notation from
  other systems: `Q3 2025` reads as class Q, number 3, year 2025. So does every other fiscal
  quarter. A year now qualifies a Cutter rather than standing in for one - 904 of the survey's 906
  endpoint lookups carry a Cutter, and the two that do not are range boundaries.
- **The routing gap, for the third time.** A repair landed at the lookup and the lookup was never
  reached, because the routing predicate judged the string as typed. Three separate defects have
  now had this same second half.

**And one the tests found rather than a reader.** Handling markers after the raw lookup looked
right and was quietly wrong: the comparator tolerates a trailing "Supp." and resolves the string
as typed, so the marker branch never ran, the answer was correct, and the tool never said it had
ignored a word. Silently dropping part of what somebody typed is where this whole review started.
Markers are handled before the lookup now, and always named.

**The harness died twice** as the suite passed twenty journeys - the browser process running out of
room in this container, not a leak. It is relaunched every eight journeys now. Worth recording
because a harness that dies is indistinguishable from a product that fails: both stop the suite
without saying which assertions would have passed, and the second death was hiding four real
failures underneath it.
