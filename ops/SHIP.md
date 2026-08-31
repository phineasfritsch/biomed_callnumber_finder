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
