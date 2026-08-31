# Escalations: the questions we may not answer for you

Ten items, E-1 to E-10. Eight came from the cross-brief audit's list of owner questions; E-8, where
intake lives, was one of its ownership gaps and turned out to need the owner too.

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

**Corrected after re-audit: this is two questions, and the frozen text answers one of them.**
The first draft of this escalation merged them and then put MAP-4's whole reading in force, which
handed a port a licence to build against an explicit sentence. Rule 2, at DIRECTION line 17, spells
out the refusal case in its own words: a refusal renders as a positive object with the named
refusal, the voided staff-code slot, the evidence line, "**and no drawing at all**". Refusal 3 adds
"the canvas is cleared". That is not silence, and MAP-4 loses on it.

**The refusal case is settled, not escalated.** Under a refusal, `/map` clears the drawing like
every other surface. MAP-4 is wrong here and must be amended before `/map` is ported.

**What is genuinely open** is the *unqueried* plan: whether `/map` may draw a level nobody has
asked about, as the reference index the direction lists among the things `/map` adds ("what is on
level 8, where the K run ends"). Rule 2's stated reason is that "a plan with nothing filled asserts
a place nobody looked up" — and a browse plan asserts nothing about any particular book, because
no book was named. That reading is available and the frozen text does not foreclose it.

**Recommendation.** Permit the unqueried browse plan; forbid the unmarked plan under a refusal.
Then add one sentence to DIRECTION distinguishing the drawing from the mark on it, and have one
brief own the resulting rule for all seven surfaces.

**Default in force.** None for the browse question. **No default is offered deliberately**, because
the previous default was a green light pointed at a sentence in the frozen text, and `/map`'s browse
mode is expensive enough that building it on a default nobody ratified is the costly mistake.

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

**Recommendation.** Narrow it to Biomed, which is the building this product surveyed. Asserting a
fact about twenty-nine buildings nobody checked is the same failure as an unmarked plan, on the one
surface where a reader would never think to doubt it.

**Default in force.** Narrowed to Biomed, not omitted.

*Corrected after re-audit.* The default first written here was "clause omitted until confirmed",
and it was labelled low cost. It was neither. HOURS-2 *requires* the door clause in the failure
sentence and has a test asserting it, so omitting it silently breaks a ruling nobody had amended.
Worse, the door clause is `/hours`' only **named onward move**, which is part 3 of SHARED-3's four
invariants — so the default would have broken the new shared grammar of failure on the first
surface that used it, by way of an escalation nobody would think to read while implementing
HOURS-2. Narrowing keeps a true clause and a working refusal; omitting bought honesty with a
regression.

## E-7 · Nav membership, and nav position

Membership: ABOUT-11 explicitly refused to settle whether `/about` and `/methodology` join the nav,
correctly, as a site-wide question — and nothing else settles it. 404-8 pins "Shelfmark is four of
them" and `Tools/cohesion.test.js` asserts that count against the rendered nav, so the deferred
decision already has a test that fails the moment it is taken.

Position: HOME-1 puts the nav below the crop; ABOUT-11 puts it below the h1; `/databases`,
`/hours` and `/404` keep it in the header, which is where all seven surfaces have it today. "One
nav" is settled; "where" is not — and as it stands home would become the only surface whose nav is
not in the header, which is a cohesion break introduced by a ruling meant to protect the fold.

**Recommendation.** Keep membership at four and keep the nav in the header everywhere. A nav that
moves between surfaces is a nav the reader has to find twice, and home would otherwise be the only
surface whose nav is not where the other six put it.

**But be honest about what that costs.** The first draft of this item reconciled a header nav with
rule 1 by asserting that "the header nav sits above the *search field*, not between the viewport
top and the *answer line*". That is a reinterpretation of the one rule DIRECTION adopted **verbatim
as its acceptance test**, and that rule names "header" in its own list of forbidden things. A brief
may not reinterpret frozen text and neither may this document. Either the nav moves below the crop
on home, as HOME-1 says, and cohesion pays for it; or rule 1 is amended by the owner to say what it
actually means by "header"; but it is not settled by us reading it generously.

**Default in force.** Four entries, header position — which is what ships today, so the pin and the
cohesion assertion stand unchanged and nothing regresses while the question is open. **Cost to
reverse: medium, not low.** Moving the nav on one surface is cheap; discovering at port time that
rule 1 meant what it said is not.

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

## E-10 · Does the /404 density note outrank the claims on the page, or the other way round?

The direction's `/404` density note asks for "two sentences and a link". The page today carries
three claims — the site's shape, what the search field accepts, and "nothing has been taken away;
it has only moved" — and G4 says a claim may be reworded but not dropped. **Nothing ranks a
frozen density note against a ruling.** 404-8 originally settled it by declaring "where the density
note and G4 collide, G4 wins", which is a precedence rule the direction does not state and a brief
may not invent.

**Recommendation.** The claims win, but by the owner's word rather than a brief's. "Two sentences
and a link" reads as a density target rather than a word count, and the third claim is the one that
tells a reader arriving from a dead link that they have not lost anything — which is the whole job
of the page.

**Default in force.** All three claims kept, density note read as a target. Cheap to reverse:
it is three sentences on one page.

---

## What is waiting on which

| Escalation | Blocks | Cost of building on the default |
|---|---|---|
| E-1 browse plan | `/map`'s browse mode | **High** — no default offered; the refusal half is settled, not open |
| E-8 intake | Home's field, `/map`'s box, the OCR pins | **High** — no default offered |
| E-9 planner | `/map` layout | Low, and follows E-8 |
| E-10 /404 density | 404-8, one page | Low |
| E-7 nav | 404-8's pinned count, `cohesion.test.js`, rule 1's wording | **Medium** — turns on what rule 1 means by "header" |
| E-3 boundary | ABOUT-2, METH-1 | Low — one constant, one line |
| E-2 session stack | HOME-1, HOME-12 | Low |
| E-4 walking deltas | `walkList` strings | Low |
| E-5 /hours strings | one pin signature | Low |
| E-6 door clause | HOURS-2, SHARED-3's part 3 | Low — default is to narrow, not omit |
