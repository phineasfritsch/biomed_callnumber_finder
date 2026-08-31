# Brief: Shared (the things no single surface owns)

Written from the frozen direction in `ops/DIRECTION.md`, after the cross-brief audit
(`ops/briefs/AUDIT.md`) found that seven parallel authors had regulated what may be drawn on
each surface without anyone owning the drawing, and had cited one grammar of failure while
instantiating four.

This brief exists because of a pattern, not an oversight. Parallel authorship always seams at
the shared thing: each author can see only their own page, so the property that is defined by
two pages agreeing is the one property nobody can check. Every ruling here is a property of the
product rather than of a surface. **A surface brief may cite a SHARED ruling. It may not
restate one in its own words, and it may not narrow one.** Where a surface brief and a SHARED
ruling disagree, this brief wins and the surface brief is wrong — that is the whole point of
having it.

**The job.** Own the four shared objects — the drawing, the grammar of failure, the list
grammar, and the shelf's spoken sentence — plus the vocabulary and the enforcement machinery
that the port needs and no page brief could legitimately claim.

## Rulings

### SHARED-1 · One drawing means one module

Home's crop and `/map`'s level plan are emitted by a single module that takes the geometry and
a frame, and by nothing else. Neither surface may construct SVG for a level, a row, a face or a
mark by any other path. Line weights, row-number strings, side labels, fill and hollow
treatments, the "not recorded" dash pattern and every word rendered inside the drawing come from
the module and are not passed in.

Two arguments, and only two, may differ between the zooms:

1. **the frame** — which part of the level is in view, and at what scale;
2. **the interaction layer** — whether shelves are focus targets. At the near zoom the crop is
   one `role="img"` with one accessible name and no per-shelf labels (HOME-9); at the far zoom
   `#plan` is a `role="group"` whose shelves are `role=button`, `tabindex=0` and individually
   named (MAP-7). The module takes this as a flag; neither surface hand-builds it.

*Corrected after re-audit.* This ruling first said the frame was "the *only* permitted
difference", with a test asserting the two serialised subtrees were identical except for
coordinates. **That was false as written and its own test could never have passed**: HOME-9
requires one label and no per-shelf labels, MAP-7 requires a label on every shelf, and those
subtrees differ in roles, tabindex and labels rather than in coordinates. Writing an invariant
that the briefs it governs already violate is a worse failure than the gap it was closing,
because a false invariant is discovered by the implementer rather than by the author. The
interaction layer is a real and legitimate second axis: a crop the expert never touches and a
plan the reader walks with arrow keys genuinely differ in what is focusable. Naming it as an
enumerated argument keeps the ruling true and still forbids the thing it exists to forbid,
which is two hand-built drawings.

*Because.* DIRECTION: "There is one floor drawing in the product… The two differ in frame and
in nothing else — same line weights, same row numbers, same side labels, same words." The audit
found seven briefs regulating what may be drawn and none owning the renderer, which produces two
drawings that agree on data and disagree on everything visual — the one thing the direction is
named after not doing. Closes gap 1.

*Caught by.* Render the same level at both frames and compare the **geometry layer** only —
element order, shape types, class names, row-number text, side-label text, stroke widths and fill
classes — asserting equality except for coordinates. Roles, `tabindex` and accessible names are
excluded from the comparison and asserted separately against HOME-9 and MAP-7. Grep both surfaces
for SVG element construction outside the module and fail on any hit.

### SHARED-2 · Continuity and centring are made the same property, not chosen between

Home's crop centres the marked face horizontally within the crop, and `/map` frames the same
face at the same viewport position it held in the crop. Both hold at once: because the mark is
centred at the near zoom, "under the same point on screen" and "scrolled to the centre" describe
one behaviour rather than two. Neighbouring rows, adjacent bays and the aisle are drawn around
the centred target, which is what "a place among places" means and is not in tension with
centring it.

Measured, and measured only on the axis anything actually delivers: **the marked face's
horizontal position in the viewport is preserved across the crossing, to within 24 px.** Vertical
continuity is *not* claimed. Binding rule 1 puts home's crop below the answer line, the status
line and the receipt, so the mark is nowhere near the vertical centre of the viewport at the near
zoom, and no ruling in any brief moves it there. A reader's eye travels down the page on the
crossing; it does not travel sideways, which is why the horizontal axis is the one that carries
the continuity.

*Corrected after re-audit.* This ruling first demanded 24 px "on each axis" while the requirement
it added to HOME-3 centres the crop **horizontally** only. That is an acceptance test no ruling
could satisfy, which is the same defect SHARED-1 had: an invariant written past what the briefs
beneath it deliver. A test that cannot pass does not protect the property, it just fails until
somebody weakens it in a hurry, and the version written in a hurry is the one that ships.

*Because.* A third frozen line settles it independently, and neither the audit nor the first
draft of this ruling had found it: DIRECTION line 44 fixes the crop's accessible name as "Level 10
floor plan, **centred on row 10**". The frozen text therefore already requires the near zoom to
centre the mark. Centring was never the far zoom's invention.

The audit reported this as MAP-1 quietly substituting an easier property for the bet.
That is not what happened, and the correction matters more than the finding: **the frozen text
contradicts itself.** DIRECTION line 58 says "the mark held under the same point on screen";
line 141 says "programmatic focus moves to the target shelf, scrolled to the centre". MAP-1 was
faithfully applying line 141 and the audit judged it against line 58. The two lines are
reconcilable at no cost by requiring the near zoom to centre as well — so neither frozen line
yields, and the escalation the contradiction would otherwise have forced does not arise.

Continuity remains the reason this direction won its bracket, and centring is now the mechanism
that delivers it rather than a cheaper stand-in for it. **This ruling adds a requirement to
HOME-3; it does not overturn MAP-1, whose own centring clause it now agrees with on the axis it measures.**

*Caught by.* A browser journey: read the marked face's `getBoundingClientRect()` on home,
follow the link, read it again on `/map` after first paint, assert the horizontal delta ≤ 24 px.
Plus a standalone assertion that the marked face's centre is within the middle third of the
crop, and — because centring inside a 180 px crop is centring in the viewport only if the crop is
full-bleed — an assertion that the crop spans the viewport's full width at phone size. All of it
runs at two viewport sizes, because the failure this fixes is a phone failure.

### SHARED-3 · One grammar of failure, four invariant parts and two conditional ones

Every failure on every surface renders as a positive object containing, in this order:

1. **the named failure**, in the reader's words and naming the thing that failed — never a code,
   never "an error occurred", never browser jargon such as "Failed to fetch";
2. **the named cause**, in one clause;
3. **the named onward move** — a surface, a link or an action that is available right now;
4. **occupied space.** The region has non-zero area in every failure state. A blank is not a
   refusal; at speed it reads as a page that did not load.

Two further parts render **only where a lookup over recorded ranges actually happened**, which
today means home and `/map` and nothing else:

5. the staff-code slot, present and voided with dashes rather than removed;
6. the evidence line, counting what was checked.

A surface that performed no range lookup must not render 5 or 6. Dashes standing for a staff
code nobody sought are the same lie as an unmarked plan.

*Because.* G5 is cited by HOME-5, MAP-5, HOURS-2, DB-6 and 404-2, each instantiating it
differently, so "one grammar" had come to mean "four grammars each justified by its own
silence". The four invariants are what all four instances already share; the two conditionals
are the real and legitimate difference between them, which is why the earlier attempts to
unify by copying home's shape onto `/404` were correctly refused by 404-3. Closes gap 2, and
gives METH-12 and DB-6 something their "same grammar as home" clauses can actually cite.

*Caught by.* One shared fixture list of every failure state on every surface. For each: assert
parts 1–3 are present as separate nodes, assert the region's rendered box area is greater than
zero, and assert the presence of parts 5 and 6 matches a per-surface table rather than a
per-surface opinion.

### SHARED-4 · One list grammar, owned by home's twelve-stop list

Any ordered list a reader can move through — stops on a pull-list route, catalog records, rows
under the arrow walk — announces position on focus in one string:

    <noun> <n> of <shown> shown, <total> found

with the noun being `stop`, `record`, `row` or `item` — `item` for a list whose members are
neither shelves nor catalog records, which today means the databases A-Z, and which is the noun
DB-3 had already written. Where nothing was truncated, `<shown>` and
`<total>` are the same number and the string still prints both, because a reader learning the
grammar on a truncated list must not have to learn a second shape for a complete one.

*Because.* DIRECTION requires one grammar for rows, records and stops and names the failure it
exists to fix. DB-3 wrote the string, MAP-7 wrote a per-row announcement with no
position-of-total, and HOME-11 — the twelve-stop list the rule was grafted for — required focus
targets and no position announcement at all. The `/databases` brief flagged that it had borrowed
the noun without authority; it now has authority to cite. Rule 3 makes the twelve-stop list the
canonical instance, so home owns the string and the other two cite it. Closes gap 3.

*Caught by.* Assert the announced string on focus for the first, a middle and the last item of
each of the three list kinds against one regex, and assert the noun differs while nothing else
does.

### SHARED-5 · One shelf, one spoken sentence

A shelf face has exactly one accessible sentence, produced by one generator, and both zooms use
it. Word order and content are fixed: level, row, side, landmark clause, flanking indexes.
`/map`'s arrow walk appends that row's call-number range as a trailing clause; it does not
reorder the sentence, rename its parts, or drop the landmark.

*Because.* HOME-9 fixed one sentence per crop and forbade per-shelf labels; MAP-7 gave every
shelf `shelfLabel()`'s string — index, row, level, then each face and its range. Two zooms of
one drawing therefore named the same shelf in two different word orders with different content,
which breaks G5 and the direction's own same-string acceptance test at the exact moment the
reader crosses between them. Appending is the only difference a zoom may make. Closes the
HOME-9 / MAP-7 contradiction.

*Caught by.* Generate the sentence for the same face at both zooms; assert `/map`'s value equals
home's value plus a trailing range clause, by prefix comparison rather than by two fixtures that
can drift apart independently.

### SHARED-6 · The vocabulary, settled once

- **`level`** is a stacks level. It is the only word for one.
- **`floor`** is a building floor, and is used only where the fact is about the building —
  Reference on floor 4, Special Collections on floor 9. This is a real distinction the data
  makes and MAP-9's ban flattened it.
- **`bay`** and **`aisle`** are product vocabulary. The frozen direction uses both as its own
  words for real things — "adjacent bays and the aisle drawn around the target", "bays are
  counted from the aisle mouth", "same aisle, four bays further" — and the drawing depicts them.
  A surface may not ban a word the direction speaks.
- **`index`** is the number printed on the shelf end. It is not a synonym for `bay`; a bay is
  the physical unit, an index is what is written on it.

*Because.* MAP-9 banned "floor", "bay" and "aisle" as synonyms for level and index, but its own
brief keeps "shelved in Reference on floor 4", `/about` keeps "Reference on floor 4, Special
Collections on floor 9", and HOME-8's justification quotes the aisle-mouth sentence — so home
would print a word `/map` forbids. **MAP-9 narrows to its one real substitution: a stacks level
is never called a floor.** Everything else it banned stays.

*Caught by.* `Tools/cohesion.test.js` gains a word check: `floor` may appear on a rendered
surface only in a sentence that also names a building service, and never within a shelf answer.

### SHARED-7 · The partial-knowledge caption has one source and two quotations

The sentence "the level, row and side above are looked up; the ranges below are not" is a single
constant. Home renders it. `/about` and `/methodology` quote it, are marked as quoting it, and
draw it from the same constant rather than retyping it.

*Because.* Three briefs claimed it as a new pin in identical words with no source of truth
named. Three hand-typed copies of a pinned sentence is precisely how one vocabulary becomes
three, and the pin would then pass while the product drifted. Closes gap 6.

### SHARED-8 · The transition exists, and stops under reduced-motion

The home-to-`/map` move is a single visual transition of frame, and it is instant — no
interpolation, no fade, no scroll animation — when `prefers-reduced-motion: reduce` is set.
Duration and easing everywhere else are out of remit and stay out. The *existence* of the swap,
and its behaviour under the media query, are ruled here.

*Because.* Required by DIRECTION and by refusal 5; MAP-2 forbade animating the mark and nothing
claimed the swap itself. Closes gap 8.

*Caught by.* Emulate `prefers-reduced-motion: reduce` and assert no element in the drawing has a
non-zero `transition-duration` or a running animation during the cross.

### SHARED-9 · The asset budget is site-wide and belongs here

No new **fetched** asset — script, font, image or stylesheet — may be added to any surface.
Bytes added to the existing shared stylesheet are not a fetched asset and are permitted; a
surface brief may not forbid them on another surface's behalf.

*Because.* METH-9 forbade adding anything to the shared stylesheet and simultaneously bound all
seven surfaces from inside one surface's brief, which is the overreach ABOUT-11 correctly
refused to commit. It also left METH-10's `:target` treatment — CSS that does not exist today —
with nowhere to live. **METH-9 is scoped to "no new fetched asset on this page"**, and the
site-wide rule lives here.

*Caught by.* `Tools/assets.test.js` and the existing loose-colour and single-stylesheet
assertions in `Tools/cohesion.test.js` already carry this; the ruling names their owner.

### SHARED-10 · One owner for the guards, sequenced before the ports

`Tools/pins.test.js` and `Tools/cohesion.test.js` are owned through the port by one person, and
every signature change lands in the same commit as the string change it tracks — never in a
follow-up, because a guard edited separately from the thing it guards teaches people that the
guard is the thing to edit.

Three capabilities the briefs assume and the tools do not have. None of 404-3, 404-5 or the
negative rulings they carry may be cited as enforced until the capability exists:

- **negative pins** — asserting a string is *absent* from a surface;
- **a response-status check** — nothing here inspects a status code;
- **the collision `No mapped shelf contains`**, which already exists in both `index.html` and
  `map.html`, so a pin on it is satisfied by either file and proves neither.

*Because.* G4 is enforced mechanically, and roughly twenty new pins, one required signature
update and one probable collision arrive with the ports. Closes gap 7.

## What this brief deliberately does not settle

Ten questions are the owner's, not ours, and are filed with a recommendation and a reversible
default in `ops/ESCALATIONS.md`. Two of them block rulings above:

- Whether an unmarked level plan is permitted on `/map` under a refusal or when nothing has been
  asked (binding rule 2 read as governing the drawing, or the mark on it). SHARED-3 is written
  to be true under either reading; MAP-4 and HOME-5 cannot both be right and neither may be
  ported until this is answered.
- Where the nav sits. Membership and markup are already one across seven surfaces and stay that
  way; HOME-1 moves home's nav below the crop and nothing else moves, which would make home the
  only surface whose nav is not in the header. That is a cohesion break introduced by a ruling
  meant to protect the fold.

## Amendments this brief makes to surface briefs

| Brief | Ruling | Change |
|---|---|---|
| `/map` | MAP-1 | Unchanged. SHARED-2 adds the matching requirement to HOME-3 instead. |
| home | HOME-3 | Gains: the crop centres the marked face (SHARED-2). |
| `/map` | MAP-9 | Narrowed to the level/floor substitution; `bay`, `aisle` restored as product vocabulary (SHARED-6). |
| `/map` | MAP-7 | Per-shelf string now generated from SHARED-5; the walk appends a range clause. |
| home | HOME-9 | Cites SHARED-5 rather than fixing its own sentence. |
| home | HOME-11 | Gains the position announcement from SHARED-4. |
| `/databases` | DB-3 | Cites SHARED-4 for the string; keeps its noun `item`, which SHARED-4 now admits. |
| `/methodology` | METH-9 | Scoped to this page; the site-wide asset rule moves to SHARED-9. |
| all | G5 citations | Resolve to SHARED-3 rather than to five separate readings. |
