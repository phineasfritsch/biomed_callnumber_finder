# When the board says it is finished

A loop that runs until something is "finished" needs finished to be a thing that can be checked,
by someone other than the person doing the work. Otherwise it either never stops, or it stops when
whoever is building it gets tired, and those look identical from outside.

This file is the stopping condition. It is written before the work it judges, because a bar set
afterwards is a bar set to whatever was achieved.

## Who decides

Not the person building it, and not one reviewer. **A ship review** is run against the DEPLOYED
site: the six constrained readers from `ops/PANEL.md`, each driving the real thing, then a pass
whose default is to refute every finding they raise. The verdict is a count, not an opinion.

The one thing the board may never do is rule on taste. Palette, typeface and brand are out of remit
under G7 and go to a person. That means **the board can never declare this finished on its own**:
a human look is a required input, not a formality. See "the human gate" below.

## The bar

All eight, in one round, against the deployed site:

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

    round · date · commit
    blocks-the-task: N   costs-time-or-trust: N   papercuts: N
    cohesion: one product | not yet
    rulings met: G1..G7, or which failed
    gates: test/ui/pins/cohesion/parity/health
    verdict: FINISHED | NOT YET, and the one sentence saying why

## Rounds

*(none yet — the direction is frozen, the briefs are not written, and the port has not begun.
A ship review run today would fail on criteria 5, 7 and 8 and would tell us nothing we do not
already know. The first round is worth running when the port is complete.)*
