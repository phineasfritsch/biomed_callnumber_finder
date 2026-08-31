# Cross-brief audit

Seven briefs were written in parallel, one per surface, each from the same frozen direction.
One reader then held all seven at once, which is the only way a disagreement between two of
them is visible: each author saw only their own page.

## Verdict

Close to one product, but not yet one. The honesty instincts are consistent across all seven — every brief refuses to assert what it did not look up, and none of them tries to make the drawing the answer. The seams are in exactly the three places seven parallel authors always seam: the shared drawing (nobody owns it, and MAP-1 has already swapped the continuity property that is the whole bet for the easier 'centred'), the shared grammar of failure (five briefs cite G5 and instantiate four different shapes), and the shared vocabulary (MAP-9 bans words the frozen direction itself uses, ABOUT-2 and METH-1 each claim sole ownership of the definition of 'index', and the same shelf gets two different accessible sentences at the two zooms). Two briefs also name enforcement machinery the product does not have — a build step — and one, MAP-4, quietly reads binding rule 2 as governing marks rather than drawings, which is either the right reading for a browse surface or a hole through rule 2, and only the owner can say which. Fix the six ownership gaps and settle the ten escalations, and these are one product; port them as they stand and it ships as seven pages that agree about ethics and disagree about nouns.

## Contradictions (11)

### MAP-4 vs HOME-5, 404-1, METH-6, DB-2, HOURS-3

Binding rule 2 is read two incompatible ways. HOME-5 ("no SVG at all"), 404-1, METH-6, DB-2 and HOURS-3 all read "the drawing never appears without a mark" as absolute — no mark, no picture, on any surface, in any state. MAP-4 reads it as a rule about the MARK only: on a refusal it clears the mark and explicitly keeps the level plan drawn and unmarked. Both cite the same refusal 3 ("the canvas is cleared"). Under the other five briefs' reading, /map's unmarked plan under a refusal is exactly the thing rule 2 names — a plan with nothing filled. Under MAP-4's reading, HOME-5's total clearance is over-strict. The /map brief admits its reading is not supported by the frozen text.

*Fix.* Owner ruling, then one sentence in DIRECTION distinguishing 'the drawing' from 'the mark on it' at zoom-out. Whichever way it goes, one brief must own the resulting rule for all seven surfaces rather than six briefs each re-deriving it.

### MAP-9 vs MAP-6, MAP-10, the /map must-survive list, ABOUT (must-survive), and DIRECTION lines 34/36/40/177

MAP-9 rules that "floor", "bay" and "aisle" are not used as synonyms for level/index on /map. But (a) MAP-6 explicitly requires keeping "shelved in Reference on floor 4"; (b) the same brief's must-survive list keeps "Reference is shelved by call number on floor 4", "elevator between every floor", and the per-floor walk cards; (c) /about's must-survive list keeps "Reference on floor 4, Special Collections on floor 9"; and (d) the frozen direction itself uses both banned words as live vocabulary — "adjacent bays and the aisle drawn around the target" (34/36), "bays are counted from the aisle mouth" (40), "same aisle, four bays further" (177). HOME-8's own justification quotes the aisle-mouth sentence, so home will print a word /map forbids.

*Fix.* Narrow MAP-9 to the one substitution it actually needs (level, not floor, for a stacks level) and settle 'bay' and 'aisle' as product vocabulary once, site-wide, since the direction already uses them. Note the Reference/Special Collections floors are building floors, not stacks levels — a genuine distinction the ruling currently flattens.

### ABOUT-2 vs METH-1 (+ ABOUT-12, ABOUT-9, DIRECTION line 42)

Two briefs each claim ownership of the string a pressable term opens. ABOUT-2: every pressable term has exactly one anchored section on /about and the sentence it opens is that section's first sentence, character for character. METH-1: every term printed in a legend, refusal or disclosure has exactly one anchored paragraph on /methodology, and a linked term with no anchor is a failure. DIRECTION line 42 sends key terms to /methodology. ABOUT-12 assumes pressable terms link into /about ids. So 'index' acquires a home expansion, an /about first sentence and a /methodology paragraph, with two briefs each asserting theirs is the single one. ABOUT-9's link-out rule mitigates but does not resolve, because ABOUT-2 still requires the character-for-character sentence to live on /about.

*Fix.* Owner draws the /about ÷ /methodology boundary. Then one brief owns the term string, the other cites it. Whoever owns it should also name the single source the three renderings are generated from, or 'character for character' is unenforceable.

### HOME-6 vs METH-4 (+ DIRECTION line 147)

HOME-6 requires one emitter so a catalog holding and a direct call-number lookup yield a byte-identical sentence, staff code, landmark clause and crop. But the grafted derived/looked-up separation (DIRECTION 147, ruled "the best trust mechanic in the bracket") requires a title/catalog answer to state TWO claims — "The catalog gave QP 376 for this title" and "QP 376 maps to Level 10 · Index 10 · Right" — so the two paths cannot render identically. METH-4 assumes home prints that two-claim sentence and makes itself the link target for it; no HOME ruling creates it.

*Fix.* HOME-6 keeps one emitter for the SHELF claim and gains a second, separately-owned line for the catalog claim on the derived path. Add a HOME ruling that owns the two-claim sentence, or METH-4 is anchoring a link to a string nothing renders.

### HOME-1 vs HOME-12

HOME-1: "the answer line is the first element in DOM order below the search field", absolute. HOME-12: the routing statement with its one-click reversals "is part of the echoed query and is the only thing permitted above the answer line". These reconcile only if the routing line is defined as part of the field, which HOME-12 asserts and HOME-1 does not admit. As written, an implementer obeying HOME-1 literally deletes the thing HOME-12 makes mandatory.

*Fix.* Rewrite HOME-1 as "nothing between the top of the viewport and the answer line except the echoed query and its routing statement", matching DIRECTION line 52, and let HOME-12 define what that block may contain.

### HOME-9 vs MAP-7

Same shelf, two accessible names. HOME-9 fixes one sentence per crop — level, row, side, landmark, flanking indexes — and forbids per-shelf labels. MAP-7 makes every shelf on the plan a focus target carrying shelfLabel()'s string — index, row, level, then each face and its range — and keeps one aria-label for the drawing as well. Two zooms of one drawing therefore name the same shelf in two different word orders with different content (MAP's carries ranges and no landmark; HOME's carries the landmark and no ranges). G5's one vocabulary and the direction's same-string acceptance test (line 44) both break at the moment the reader crosses.

*Fix.* One brief owns the shelf's accessible sentence; both zooms generate from it, with /map's arrow walk appending the row's range rather than reordering the sentence.

### METH-9 vs METH-10 (and ABOUT-12)

METH-9 forbids adding anything to the shared stylesheet for /methodology's sake and keeps the page on the existing site.css. METH-10 requires each anchored paragraph to carry a :target treatment that does not rely on hue alone. That treatment is CSS that does not exist today and has nowhere to live. METH-9 also legislates for all seven surfaces ("no script, font or asset may be added to any page"), which is a site-wide budget decision taken inside one surface's brief — the same overreach ABOUT-11 deliberately refused to commit.

*Fix.* Scope METH-9 to 'no new fetched asset on this page', budget the handful of bytes METH-10 needs, and move the site-wide asset rule to whoever owns the shared stylesheet.

### DB-2 vs the /databases must-survive nav, G5, refusal 10

DB-2 bans "no floor drawing, crop, map link or geometry of any kind" on /databases. The same brief's must-survive list requires the one header nav "Search · Map · Hours · Databases", and refusal 10 requires one nav on every surface. Read literally DB-2 deletes the nav's Map link.

*Fix.* Narrow DB-2 to 'no drawing, crop or shelf geometry'; the shared nav is not this brief's to touch.

### HOURS-1 vs the /hours must-survive list

HOURS-1 forbids any visible-only outcome — one string, simultaneously visible text and live-region content. The must-survive list preserves summary.textContent = 'hours unavailable' on first-load failure, which is a second visible outcome string, in different words from HOURS-2's required failure sentence, outside the live region. It also preserves the count line riding in BOTH the lede and the status region.

*Fix.* Either exempt the collapsed <summary> label explicitly as a duplicate of the live string rather than a second outcome, or derive it from the one string. As written the brief requires and forbids it.

### ABOUT (must-survive) vs ABOUT (new claims)

The same sentence appears on both lists: "Any shelf shown in a catalog result is a link. Click it and the map opens on that floor with the shelf already lit" is listed as must-survive, and the zoom sentence is listed as REPLACING it. It also says "that floor", which MAP-9 bans.

*Fix.* Pick one. If the zoom sentence replaces it, say so on the must-survive list and update the pin signature deliberately, per G4.

### HOME-2 vs HOME-8 and layer 3

HOME-2 requires the answer line keep "today's exact composition" and justifies itself on the string being "byte-identical to today's" — while the same ruling appends the landmark clause after "side" and HOME-8 wraps three of its words in <button>s. The string cannot be byte-identical and also four words longer; the direction itself books the landmark clause as a cost the expert pays (line 216).

*Fix.* State the real invariant: the four values keep today's order, wording and position, and the clause is appended after them. Drop 'byte-identical', which is now false and therefore untestable.

## Gaps: things the direction requires that no brief claimed (8)

- **The one drawing itself. Seven briefs regulate what may be drawn where; none owns the renderer contract that makes home's crop and /map's plan the same drawing — same scale, same line weights, same row numbers, same side labels, same words (DIRECTION 11, 58, 153). HOME-3 owns home's emission path, MAP-12 owns the walk maps, MAP-1 owns arrival framing. The shared geometry-to-SVG module, and the frame-continuity property that is the entire bet, are unowned. The port will produce two drawings that agree on data and disagree on everything visual.**
  *Owner.* A cross-surface drawing brief, written before either page brief is ported; the /map author is closest to the existing planShelves()/planFeatures().

- **The one grammar of failure. G5 is cited by HOME-5, MAP-5, HOURS-2, DB-6 and 404-2, and each instantiates it differently: home/map = named refusal + dash-voided staff-code slot + evidence line; /databases = named refusal, no slots (DB-5 declines to invent them); /404 = prose, slots explicitly forbidden (404-3); /hours = named upstream + door clause, no slots, no evidence line. Nobody defines the invariant the four are meant to share, so 'one grammar' currently means 'four grammars each justified by its own silence'.**
  *Owner.* One brief owning the refusal shape: what is invariant (named failure, named cause, named onward surface, never blank) and what is surface-conditional (the voided slots, the evidence line, which exist only where a lookup happened).

- **The list grammar string. DIRECTION 44/135/159 requires one grammar for rows, records and stops, and names the record-2 failure it exists to fix. DB-3 writes it ('item 3 of 60 shown, 1,360 found'), MAP-7 writes a per-row announcement with no position-of-total, and HOME-11 — the twelve-stop list the rule was grafted for — requires focus targets but no position announcement at all. The canonical string and its noun are unowned, and the DB brief flags that it borrowed the noun without authority.**
  *Owner.* Home, since rule 3 makes the twelve-stop list the canonical instance; /databases and /map then cite it.

- **Intake of twelve call numbers and the photographed pull list. Rule 3 and DIRECTION 52 assume the one field takes twelve numbers or a photo; home has neither today, and the OCR capability, its pinned privacy sentences and its new line-narration grammar (declarative-4) all live on /map. No brief rules where intake lives, and MAP's own brief declines to settle whether /map's box is polymorphic at all. Both briefs can be obeyed with the capability existing on neither surface.**
  *Owner.* Owner: it is a scope decision between two surfaces, not a reading of the text.

- **Nav membership and nav position. ABOUT-11 explicitly refuses to settle whether /about and /methodology join the nav — correctly, as a site-wide question — and nothing else settles it. Meanwhile 404-8 pins 'Shelfmark is four of them' and cohesion.test.js asserts that count against the rendered nav, so the deferred decision has a test that will fail the moment it is taken. Separately, HOME-1 puts the nav below the crop, ABOUT-11 puts it below the h1, and DB/HOURS/404 keep it in the header: 'one nav' is settled, 'where' is not.**
  *Owner.* Owner, once, for all seven; then the 404 sentence and the cohesion assertion are updated in the same change.

- **The partial-knowledge caption. Claimed as a new pin by three briefs (home, /about, /methodology) in identical words, with no source of truth named and no ruling on whether the /about and /methodology copies are quotations of home's rendered string or independently typed prose. Three hand-typed copies of a pinned sentence is how one vocabulary becomes three.**
  *Owner.* Home renders it; /about and /methodology quote it and say so.

- **Pin and test tooling. The briefs add roughly twenty new pins, require one signature update ('unmapped' → 'not recorded', MAP), flag one probable signature collision ('No mapped shelf contains', which already exists in both index.html and map.html), request an assertion kind pins.test.js does not have (negative pins, 404-3), and request a response-status check no tool performs (404-5). No brief owns Tools/pins.test.js or cohesion.test.js through the port.**
  *Owner.* A single guard-maintenance owner, sequenced before the ports land, since G4 is enforced mechanically and a stale signature teaches people to edit the guard.

- **The home-to-/map transition, including the reduced-motion instant swap. Required by DIRECTION 11 and refusal 5; MAP-2 only forbids animating the mark. Duration and easing are correctly out of remit — the existence and behaviour of the swap are not, and nobody claims them.**
  *Owner.* Whoever owns the shared drawing.

## Drift from the frozen direction

- **MAP-1** — Reinterprets the bet. The direction says the marked shelf "stays under the same point on screen" across the zoom (lines 11, 58) — a continuity claim about where the mark is when the frame changes. MAP-1 converts it into "stage scrolled to centre, the plan's horizontal scroll set so the marked face sits under the middle of the viewport". Centre is not the same point unless home's crop also centres the mark, which HOME-3/HOME-9 never require and instrumental-4's graft (neighbours, aisle, adjacent bays) argues against. This quietly substitutes an easier property for the one the whole direction rests on.
- **MAP-2** — Sound on the flash deletion, but overreaches into a state machine the direction never specifies: 'stays until the reader asks a different question' leaves the tap-another-shelf and arrow-walk cases undefined, which the brief itself flags as a silence and then rules over anyway by forbidding any setTimeout from removing a mark.
- **ABOUT-1** — Relaxes binding rule 2 by conditionalising it. The direction says there is one drawing, generated from the geometry the lookup already used, and it never appears without a mark. A worked example on an explainer is not a lookup. ABOUT-1 grants conditional permission ('unless the drawing is produced by the same code path…') where the other five non-answer surfaces refuse outright. The brief flags the yes/no as a silence — it should not also have written the permission.
- **ABOUT-5** — Requires every printed coordinate to be regenerated from recorded geometry and an unresolvable example to 'fail the build' — on a product whose hard constraints state there is no build step. The ruling names enforcement machinery that does not exist and is not owned by anyone.
- **METH-1** — Same defect: 'a linked term with no anchor and an anchor no surface links to are both build failures', with no build step in the product and no brief owning the checker. Also, the completeness check is defined over a term list the brief itself says nobody has ratified, so the rule cannot currently be run even by hand.
- **HOURS-2** — Rules that the direction's example strings are illustrative grammar rather than required text, and rewrites the frozen sentence to protect a pin. That may well be the right call, but it is a brief deciding which half of the frozen text yields — the escalation the direction asks for (line 7), not a ruling a brief may take.
- **404-8** — Invents a precedence rule the direction does not state — 'where the density note and G4 collide, G4 wins'. G4 is a ruling and the density note is frozen text; nothing ranks them. Self-flagged, but still written as binding.
- **METH-9** — Binds all seven surfaces ('no script, font or asset may be added to any page') from inside one surface's brief. Compare ABOUT-11, which correctly refuses to settle a site-wide question on one page.
- **HOME-12** — Reads today's routing line's generosity ('offers every reading rather than the two it was choosing between') as itself the one-click reversal the subtract-3 graft requires. The graft says the field states which way it routed WITH one-click reversal; whether offering all readings satisfies that is an interpretation, not an application.

## Rulings nothing could catch

- HOME-2: 'the expert's cost for the arrival of a picture must be zero, which is only true if the string he scans is byte-identical to today's' — the string is not byte-identical (landmark clause, buttons), so the stated test can never pass and nothing else in the ruling is checkable except the font-size equality and the element-type ban, which are.
- HOME-12: 'it never renders as a mode picker, a tab strip or a pill row' — no test distinguishes a routing line with reversals from a pill row; this is a design-review judgement pointing at nothing in code.
- HOME-13: 'no font swap may reflow them' — real and important, but it needs a measurement on a device matrix the direction lists as not yet done and no brief owns. As written nobody can point at a failing artefact.
- MAP-12: 'that reasoning must survive the port' — a ruling that a rationale survives, not that any code property does. The testable half (same planShelves()/planFeatures(), no route line) should be stated alone.
- ABOUT-2: 'character for character' with no single generating source named — enforceable only by a human diffing two hand-written pages, which is exactly the drift it exists to prevent.
- METH-3: 'never opens with a back-reference to the paragraph above it' — the first half (names its own term in its first sentence) is checkable; the second half is a prose judgement no test catches.
- METH-12 and DB-6: 'written in the same grammar as the refusals on home' / 'never renders as generic error styling' — both depend on the shared failure grammar that nothing defines (see gaps). Until it is defined, neither can be violated in a way anyone can demonstrate.
- 404-3 and 404-1: negative properties ('no evidence line', 'no drawing-shaped hole') which the brief itself concedes pins.test.js cannot express. Correct rulings, currently unenforceable.
- ABOUT-5 / METH-1: 'fails the build' in a product with no build step — the enforcement clause names a mechanism that does not exist, so the ruling is unfalsifiable as written.
- ABOUT-8's 'ordinary prose' and ABOUT-1's 'if that path cannot be invoked here' — the latter makes the drawing's presence contingent on an engineering fact no brief establishes, so /about can carry a drawing or not and neither outcome violates the ruling.

## For the owner to settle

- DIRECTION contradicts itself on the session stack: line 165 grafts it as 'a compact, keyboard-arrowable strip ABOVE the answer', line 52 places it after the crop, and line 15 forbids anything above the answer line. HOME-1 forecloses one reading without saying it is doing so. Frozen text cannot be reconciled by a brief.
- DIRECTION contradicts itself on walking deltas: line 177 grafts 'the walking delta as vocabulary between consecutive stops — same aisle, four bays further', line 191 refuses step counts and the count-ten-rows failure by name. Today's walkList prints '3 shelves to aisle 7'. The /map brief correctly declines to resolve this; someone must.
- Whether an unqueried /map level plan, and an unmarked plan under a refusal, are permitted by binding rule 2. Five briefs assume no; MAP-4 assumes yes and the whole browse-index function of /map depends on yes. This is the single highest-leverage unresolved question in the set.
- The /about ÷ /methodology boundary. Both are told to explain what index counts from; ABOUT-2 and METH-1 each claim the single definitive sentence. Also unresolved: whether the ~four fifths of today's /about that the direction never mentions (the box, spelling repair, filter syntax, articles, databases, hours, campus map, pickup walks) stays, moves, or goes.
- Whether the direction's /hours strings ('LibCal answered — open until 10 pm' / 'LibCal did not answer; the posted hours are on the door') are required text or illustrative grammar. Taken verbatim they delete pinned signature 'Could not reach LibCal'. HOURS-2 decided; the owner should ratify or reverse, and if verbatim wins, update the pin deliberately and record why.
- The door clause is a new factual assertion about physical buildings ('the posted hours are on the door') on a page listing ~30 locations. Somebody must confirm it is true at all of them or narrow it. This is not a design question.
- Nav membership of /about and /methodology — deferred by ABOUT-11, depended on by 404-8's pinned count and by cohesion.test.js. Decide once, for all seven.
- The 'no build step' hard constraint versus ABOUT-5 and METH-1, which both require generated examples and a link-completeness check enforced at build time. Either a generator is in scope (and someone owns it) or both rulings need a different enforcement story.
- Whether the pickup-walk planner is a peer of the lookup on /map or stays a collapsed disclosure. The direction's /map paragraph never mentions it, and line 248 treats the pull list becoming dominant as a trigger to re-run the direction — so this is a live strategic question, not a layout detail.
- Whether 'bay' and 'aisle' are product vocabulary. The frozen direction uses both as its own words for real things; MAP-9 bans them on the surface that draws them. Related: whether a building 'floor' (Reference on 4, Special Collections on 9) and a stacks 'level' are the same noun — MAP-9's rule currently erases a distinction the data actually makes.

