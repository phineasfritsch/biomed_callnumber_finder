# Escalations: the questions we may not answer for you

Every item here was raised by the cross-brief audit (`ops/briefs/AUDIT.md`) as a decision the
owner has to take. Two kinds appear: places where the **frozen direction contradicts itself**, which
no brief may reconcile because a brief may cite the direction and not reinterpret it; and places
where the answer is a **product decision** rather than a reading of the text.

**Nothing here blocks work.** Each item carries a recommendation and a **default** that is in force
until the owner says otherwise. The defaults are chosen to be the cheapest to reverse, not the most
likely to be right — where reversing one is expensive, that is said. When an item is settled,
record the ruling here and in `ops/DIRECTION.md`, and update whichever brief was written against
the default.

Two audit escalations are **not** listed below, because Stage 02b resolved them rather than
deferring them:

- *"bay" and "aisle" as product vocabulary* — settled in SHARED-6. The frozen direction uses both
  as its own words for real things, so a surface could not ban them. A building `floor` and a
  stacks `level` stay distinct nouns, which MAP-9's ban had flattened.
- *No build step versus ABOUT-5 and METH-1* — settled by reading the rulings' own *Caught by*
  clauses, which are suite assertions. Both said "fails the build"; neither needed a build. They
  now fail `ops/test`, which exists.

---

## E-1 · Does binding rule 2 govern the drawing, or the mark on it?

**The single highest-leverage unresolved question in the set.** Rule 2 says "the drawing never
appears without a mark". HOME-5, 404-1, METH-6, DB-2 and HOURS-3 read it as absolute: no mark, no
picture, on any surface, in any state. MAP-4 reads it as a rule about the mark only — on a refusal
it clears the mark and keeps the level plan drawn and unmarked. Both cite the same refusal 3, "the
canvas is cleared". The /map brief admits its reading is not supported by the frozen text.

**What turns on it.** The entire browse function of `/map` — "what is on level 8, where the K run
ends", which the direction lists as something `/map` adds — requires a plan the reader can look at
before asking anything. Under the absolute reading `/map` cannot draw until it has been queried,
and the reference index the direction asks for does not exist.

**Recommendation.** Rule 2 governs *assertion*, not pixels. Its stated reason is that "a plan with
nothing filled asserts a place nobody looked up" — an unqueried browse plan asserts nothing about
any particular book, and a refusal that keeps the plan while voiding the mark is honest as long as
the refusal is the thing in the answer position. Draw the distinction in DIRECTION between the
drawing and the mark, then have one brief own the resulting rule for all seven surfaces rather than
six briefs each re-deriving it.

**Default in force.** MAP-4's reading, on `/map` only. Every other surface keeps the absolute
reading. **This default is expensive to reverse** — it is the one item here where building on the
wrong answer wastes real work, because `/map`'s browse mode either exists or does not.

## E-2 · Where does the session stack go? (frozen text contradicts itself)

DIRECTION line 165 grafts it as "a compact, keyboard-arrowable strip ABOVE the answer"; line 52
places it after the crop; line 15 forbids anything between the top of the viewport and the answer
line. Three lines, three positions. HOME-1 forecloses one reading without saying it is doing so.

**Recommendation.** Line 15 is the acceptance test the bracket adopted verbatim and is cited by
more of the product than either other line; lines 52 and 165 should yield to it. Below the crop.

**Default in force.** Below the crop, per line 52 and HOME-1 as amended.

## E-3 · Where is the boundary between /about and /methodology?

Both are told to explain what index counts from. ABOUT-2 and METH-1 each claimed the single
definitive sentence. Unresolved separately: whether the roughly four fifths of today's `/about`
that the direction never mentions — the box, spelling repair, filter syntax, articles, databases,
hours, campus map, pickup walks — stays, moves, or goes.

**Recommendation.** `/methodology` owns how a thing was *made and verified*; `/about` owns what the
tool *is and refuses to do*. A term's definitive paragraph is a made-thing, so it lives on
`/methodology`. The unmentioned four fifths of `/about` stays: the direction's silence about a
section is not an instruction to delete it, and the audit is explicit that a rewrite deleting
prose nobody defended is the standing risk on this page.

**Default in force.** `/methodology` owns the term paragraph; `/about` quotes it (ABOUT-2, amended).
Cheap to reverse — the mechanism is one constant per term and the direction of the quotation is a
one-line change.

## E-4 · Walking deltas: vocabulary, or the step counts the direction refuses? (frozen text contradicts itself)

Line 177 grafts "the walking delta as vocabulary between consecutive stops — same aisle, four bays
further". Line 191 refuses step counts and names the count-ten-rows failure. Today's `walkList`
prints "3 shelves to aisle 7". The `/map` brief correctly declined to resolve this.

**Recommendation.** The distinction that makes both lines true: a delta between two *looked-up*
coordinates is arithmetic over recorded geometry and is allowed ("same aisle, four bays further");
a count the reader is asked to *perform in the building* is a route claim and is refused ("count
ten rows"). Today's string is on the wrong side of that line, because "3 shelves to aisle 7" tells
the reader to count.

**Default in force.** Deltas between consecutive stops permitted, phrased as a relation between two
coordinates and never as an instruction to count.

## E-5 · Are the direction's /hours strings required text or illustrative grammar?

"LibCal answered — open until 10 pm" / "LibCal did not answer; the posted hours are on the door".
Taken verbatim they delete the pinned signature `Could not reach LibCal`. HOURS-2 decided they are
illustrative and rewrote the frozen sentence to protect the pin. That may be right, but it is a
brief deciding which half of the frozen text yields — which the direction reserves to the owner.

**Recommendation.** Ratify HOURS-2. The direction's own surface sections are written as prose
sketches throughout, and every other brief has read them that way; reading this one pair as
mandated text would make the direction a copy deck by accident.

**Default in force.** HOURS-2's ruling stands. If verbatim wins instead, the pin signature is
updated deliberately and the reason recorded, per G4 and SHARED-10.

## E-6 · Is "the posted hours are on the door" true at all thirty locations?

A new factual assertion about physical buildings, on a page that lists roughly thirty of them.
**This is not a design question and no amount of reviewing will answer it.** Somebody has to know,
or the claim has to be narrowed to the buildings somebody does know about.

**Recommendation.** Narrow it to Biomed, which is the building this product surveyed, or drop the
clause. Asserting a fact about twenty-nine buildings nobody checked is the same failure as an
unmarked plan, on the one surface where a reader would never think to doubt it.

**Default in force.** Clause omitted until confirmed. This is the only item here whose default is
"say less", and deliberately so.

## E-7 · Nav membership, and nav position

Membership: ABOUT-11 explicitly refused to settle whether `/about` and `/methodology` join the nav,
correctly, as a site-wide question — and nothing else settles it. 404-8 pins "Shelfmark is four of
them" and `Tools/cohesion.test.js` asserts that count against the rendered nav, so the deferred
decision already has a test that fails the moment it is taken.

Position: HOME-1 puts the nav below the crop; ABOUT-11 puts it below the h1; `/databases`,
`/hours` and `/404` keep it in the header, which is where all seven surfaces have it today. "One
nav" is settled; "where" is not — and as it stands home would become the only surface whose nav is
not in the header, which is a cohesion break introduced by a ruling meant to protect the fold.

**Recommendation.** Keep membership at four and keep the nav in the header everywhere. HOME-1's
concern is satisfied without moving it: the header nav sits above the *search field*, not between
the viewport top and the *answer line*, and the answer line's offset is measured from the field.
A nav that moves between surfaces is a nav the reader has to find twice.

**Default in force.** Four entries, header position, all seven surfaces — which is what ships today,
so the pin and the cohesion assertion both stand unchanged.

## E-8 · Which surface takes twelve call numbers and a photographed pull list?

Rule 3 and DIRECTION line 52 assume the one field takes twelve numbers or a photo. Home has
neither today: the OCR capability, its pinned privacy sentences and its line-narration grammar all
live on `/map`. No brief rules where intake lives, and `/map`'s brief declines to settle whether
its own box is polymorphic at all. **Both briefs can currently be obeyed with the capability
existing on nowhere** — which is how a feature disappears in a port without any decision to drop it.

**Recommendation.** Home. Rule 3 says one answer shape serves one book and twelve, and a route is
an answer; putting intake anywhere else makes the pull list a second mode, which rule 3 forbids in
the same sentence. The pinned privacy sentences move with it and their signatures update in the
same commit.

**Default in force.** None — this one is genuinely open, and building either way before it is
settled is the expensive mistake. Port the shared drawing and the answer object first; they are
needed under either answer.

## E-9 · Is the pickup-walk planner a peer of the lookup on /map, or a collapsed disclosure?

The direction's `/map` paragraph never mentions it, and line 248 treats the pull list becoming
dominant as a trigger to re-run the direction. So this is a live strategic question, not a layout
detail — and it is entangled with E-8.

**Recommendation.** Settle E-8 first; the answer to this follows. If intake moves to home, `/map`'s
planner becomes the walk *view* of a route home built, and the question dissolves.

**Default in force.** Collapsed disclosure, as today.

---

## What is waiting on which

| Escalation | Blocks | Cost of building on the default |
|---|---|---|
| E-1 rule 2 | `/map`'s browse mode; five briefs' refusal states | **High** — the mode exists or does not |
| E-8 intake | Home's field, `/map`'s box, the OCR pins | **High** — no default offered |
| E-9 planner | `/map` layout | Low, and follows E-8 |
| E-7 nav | 404-8's pinned count, `cohesion.test.js` | Low — default is what ships today |
| E-3 boundary | ABOUT-2, METH-1 | Low — one constant, one line |
| E-2 session stack | HOME-1, HOME-12 | Low |
| E-4 walking deltas | `walkList` strings | Low |
| E-5 /hours strings | one pin signature | Low |
| E-6 door clause | one clause | Low — default is to omit |
