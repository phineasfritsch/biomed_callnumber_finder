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
