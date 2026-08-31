# The frozen direction

Output of the bracket: 16 directions from four deliberately incompatible stances, eliminated
in knockout rounds with one constrained reader arguing per match. 15 matches, 15 grafts.

This is the document every page brief is written from. It is frozen: a brief may cite it, a
port may not reinterpret it. Where it is silent, that is a gap to raise rather than fill.

## One Drawing, Two Zooms (as amended by the bracket)

The expensive failure at Biomed is not that people misread the answer — it is that they believe it word for word and still cannot find the place. Shelfmark therefore keeps its sentence exactly where it is and adds exactly one picture. There is one floor drawing in the product. It is generated inline from the same geometry the lookup already used, it never appears without a mark on it, and it exists at two zooms: a fixed-height crop (~180 px) beneath the home answer, and the whole level at /map. The two differ in frame and in nothing else — same line weights, same row numbers, same side labels, same words. Crossing from home to /map is a change of zoom, not a change of kind, and the marked shelf stays under the same point on screen through the transition (instant swap under reduced-motion). That single construction is the fix for the newcomer who tapped through to a diagram where her shelf was half off-screen and unmarked.

Three things the bracket sharpened, and they are binding, not decorative:

1. The drawing is never the answer. The answer is the one text line in today's position and today's wording, plus the coarse staff code at equal weight. It paints first and alone; the SVG paints with it from geometry already in memory, never as a second request, never as a lazy load, never as an image fetch. If a small portrait screen cannot hold both, the picture is cut and the words are not. Nothing — no header, count, mode label, legend, level chooser or upload affordance — is ever placed between the top of the viewport and the answer line (subtract-4's rule, adopted verbatim as the acceptance test).

2. The drawing never appears without a mark. A plan with nothing filled asserts a place the system did not look up. But empty space is not an acceptable refusal either, because at speed a blank reads as a page that failed to load. So a refusal renders as a positive object: the named refusal in the answer's own grammar ("No mapped shelf contains ZZ 999 Q999 — nothing to draw, because there is no mark"), the staff-code slot voided with dashes rather than removed, the evidence line ("Checked 41 mapped ranges on levels 8–10"), and no drawing at all.

3. One answer shape serves one book and twelve. A photographed pull list is not a second mode, a second page or a second layout: it is an ordered list of the same answer line, and one call number is a route of length one. The crop belongs to the focused stop.

Everything else in this document is either a graft the bracket ruled must survive, or a constraint that keeps one of those three true by construction rather than by discipline.

## G3, answered

The owner wrote this ruling: ideal design can be used by anyone. It eliminated more directions
than any other.

G3 is met by putting each layer of help where its own reader is already looking, and nowhere else. Concretely, an answer is built from seven layers, in this order down the page:

1. THE SENTENCE (fold, always). "Level 10, top row, index 10, Right side" — today's wording, today's position, unmoved. The expert reads it and leaves. Cost to the expert: zero, because nothing changed.

2. THE STAFF CODE, at equal type size, never demoted to caption (graft from spatial-1). "L10 · R10 · Right · top" is what staff say aloud and read off a slip; the arrival of a picture must not shrink it.

3. THE LANDMARK CLAUSE, appended to the sentence: "— third row from the elevators." This is a lookup-backed fact (the geometry knows where the elevators are), not a route claim. It is the one clause that converts a coordinate into a bearing for someone who has never been in the stacks, and it costs the expert about four words. Degradation rule, verbatim from spatial-1: if a level has no verified fixed feature in the geometry, the clause is absent and the coordinate prints alone. Never invent a landmark. Where two verified features flank the crop, label both edges — two anchors, never a count and never a route.

4. THE CROP (just below the fold line, painting in the same frame). This is where explanation stops being written and starts being drawn: the target shelf filled solid, every neighbouring row carrying its printed row number, the side labelled, the nearest fixed feature clipped at the crop edge and named, and adjacent bays and the aisle drawn around the target so it is a place among places rather than a lone rectangle (graft from instrumental-4). The newcomer reads nothing; she looks. The vocabulary inside the plan is the vocabulary printed on the shelf ends she will walk up to, so the picture teaches the building rather than a second notation. The expert never lowers his eyes to it. This is the literal reading of "available without occupying the fold": it occupies picture, not prose, and it is next in the scroll path rather than behind a link someone must know to follow.

5. SPINE RANGES, where recorded (graft from spatial-3, made progressive rather than conditional). The target row's call-number range prints under the crop; neighbouring rows carry theirs inside the crop where they fit. This is the only mechanism in the whole bracket that lets a reader self-correct at the shelf against the actual spines. Where a range is unrecorded the label is simply absent from an otherwise complete drawing — the answer never blanks out — and the partial-knowledge caption states the boundary in spatial-3's exact form: "the level, row and side above are looked up; the ranges below are not." Every printed range carries the per-row last-verified stamp (graft from spatial-4/declarative-1); a row past the review interval draws no range and says so, rather than showing numbers nobody has checked since the last shift.

6. PRESSABLE TERMS (closed by default, zero pixels closed). "Index", "row" and "side" in the answer line are real buttons with aria-expanded, in tab order, 44 px, with a visible affordance — not a hover, not a dotted underline alone on a coarse pointer (graft from subtract-1, plus its own admitted risk treated as a build requirement). Pressed, one sentence opens beneath the term and is announced. This is the layer that answers the objection subtract-1's judge made against every drawing-only direction: a label is not a definition. Printing "Index 10" on a box tells the reader the box is called that; it does not tell her bays are counted from the aisle mouth. The drawing gives the place, the expansion gives the account, and the expert pays nothing for either. On a multi-stop route the expansion is available on every stop, not only the first.

7. NAV AND METHODOLOGY, below the answer and below the crop — demoted off the fold, never deleted (the condition on which subtract-1 was advanced and then the reason it was rejected). Every legend word and every key term in a refusal links to its own anchored paragraph in /methodology (graft from declarative-2), so explanation is reachable by looking rather than by naming, which is what lets an unsure person audit the tool before trusting it.

For a non-visual reader the same seven layers arrive as the same content, not as a picture plus an apology. The acceptance test is spatial-4's, adopted whole: the same string for sighted and screen-reader. The crop has one accessible name, one sentence, carrying the landmark clause the sighted reader gets from the crop edge and the neighbour clause from subtract-2: "Level 10 floor plan, centred on row 10; the marked shelf is the right-hand face, third row from the elevators, between index 9 and index 11." One aria-label per drawing, never forty spoken "R L"s — the win the current site already has, preserved. /map adds the arrow-key row walk: each move announces one sentence with that row's number and call-number range, which is the same list grammar used for records, stops and rows everywhere in the product.

Why this is not averaging and not segregation: nothing was added to the fold for the newcomer's sake except four words of landmark, and nothing was subtracted from the newcomer's sake to protect the expert. The split is by stage of task — coordinate, then place, then vocabulary — and both readers pass through the same stages in the same order on the same surface. An expert who does not know level 8's third aisle scrolls to the crop too; a newcomer who already knows the building never does.

## Surface by surface

### Home (the app)

One field that takes a call number, twelve call numbers, a photographed list or a title. Above the answer: only the echoed query. Then the answer line with the staff code at equal weight and the landmark clause; then the status line naming the answer type, wrapping to whatever height the truth needs; then the receipt (mapped range, last verified); then the ~180 px marked crop with row numbers, side label, clipped landmark and spine ranges where recorded; then the session stack of prior lookups; then nav and footer. A refusal fills the value slots with dashes, names the call number, states why there is no drawing, and offers a link onward. Twelve stops render twelve of this same line, each its own focus target, the crop belonging to the focused stop.

*Density.* Highest in the product, but strictly layered: the first 40 px is today's answer and nothing else.

### /map

The identical SVG at zoom-out — whole level, same weights, same row numbers, same fill on the same shelf. Arriving from home is a zoom with the mark held under the same point on screen (instant swap under reduced-motion), focus moved programmatically to the marked shelf with a persistent non-animated outline and a banner repeating the exact lines home showed. Adds only what home cannot fit: the other levels as a stack of the same drawing, an arrow-key walk that moves the mark and announces each row with its number and call-number range, and browse/search as a reference index (what is on level 8, where the K run ends). Deep links open framed. Hollow, dashed, "not recorded" for unmapped space, with per-zone verification dates.

*Density.* Same content as the crop, more of it. Nothing here is absent from home except the other levels and the walk.

### /hours

The pending state always resolves out loud, in one string that is both the visible text and the aria-live region, announced once on change: "LibCal answered — open until 10 pm" or "LibCal did not answer; the posted hours are on the door." No silent retry — a second attempt is a second line.

*Density.* One sentence, one outcome, same failure grammar as every other surface.

### /databases A–Z

A list in the product's list grammar — walkable, each item focusable, position announced — carrying the scope statement in the same voice as the shelf refusals: "Listed, not searched."

*Density.* Low. A list and one scope sentence.

### /explainer

The permanently reachable version of what the pressable terms open in place: the shelf vocabulary, what index counts from, and one worked example from slip to shelf. Reachable by looking, not by naming the right word.

*Density.* Prose. The only surface where reading is the task.

### /methodology

Anchored paragraphs, one per term, linked directly from every legend word, every key term in a refusal and every disclosure. States the derived/looked-up separation, the verification interval, what hollow means, and what the product refuses to claim.

*Density.* Prose, addressed by anchor rather than read top to bottom.

### 404

A refusal in the same grammar as an unmapped call number — names what was asked for, states that nothing was found, offers the one surface that would help — and draws nothing.

*Density.* Two sentences and a link.

## What was grafted, and from where

A knockout that discards everything about the loser has wasted half the work. Each of these
was ruled by the judge who eliminated the direction it came from.

**From subtract-2 (The Marked Face)**

The marked face as what the drawing must mean: the bay boxed, the side hatched, and the four terms printed on the drawing itself rather than only in the line above it. Plus the neighbour sentence in the accessible name — "between index 9 and index 11, right side as you face the shelf" — which is the orienting fact the picture gives sighted users. Plus "a picture of nothing is a lie": on a refusal the drawing is not offered at all.

*Why it survived.* [desk] eliminated it on G1 — a drawing cannot be the primary answer on a 3.5 s cold paint, and its own caption-first mitigation conceded the sentence was the answer — but ruled its spec of what "marked" has to mean, and its refusal rule for unmarked plans, must survive into the winner.

**From subtract-1 (Answer Only)**

Per-term expansion: the shelf words in the answer line are real buttons with aria-expanded, in tab order, 44 px, with a visible affordance; closed they occupy zero fold, open they put the definition under the finger that asked. Extended to every stop in a route, not just the first. Plus the map-as-state rule (expand in place under the pinned answer, already scrolled and already marked, never a navigation away), the refusal to draw unless asked, and the discipline that nothing sits between the top of the viewport and the answer.

*Why it survived.* Two judges ([desk], [newcomer] via subtract-4) called this the only construction in the bracket where closed costs zero pixels and open lands exactly where the confusion is — the direct answer to "a label is not a definition." Its nav deletion was ruled a G5 break and is explicitly NOT grafted; nav is demoted below the fold instead.

**From subtract-3 (One Field, No Pages)**

Asynchronous surfaces must resolve out loud: "Asking LibCal" is replaced by the answer or by "LibCal did not answer; the posted hours are on the door." Refusals name and link the surface that would help rather than parking guidance in a menu. The one field stays polymorphic (a call number, twelve of them, a photo, a title) and states which way it routed with one-click reversal. Deep links (/map#level-10, /hours) resolve to the answer state, never to a homepage the reader must re-query.

*Why it survived.* [newcomer] eliminated it for spending its entire orientation on a pre-typing empty state destroyed by the first keystroke, but ruled the always-resolving announcement non-negotiable — it is the only stated fix for the /hours failure — and the guided refusal the single best idea in the direction.

**From subtract-4 (Route Of One)**

One answer shape for one and many: a pull list is a route whose length is one, twelve results render twelve of the same line, and there is never a separate faster mode for the single lookup. Unmapped entries keep their slot and their refusal by name ("4. No mapped shelf contains ZZ 999 Q999"), never dropped and never silently reordered. Every stop is its own focus target with a real accessible name. Truncation discloses itself in today's exact grammar. If walking order is ever inferred rather than looked up, it degrades to plain call-number order and says so.

*Why it survived.* [desk] beat it with spatial-2 but ruled that without these four the winner ships as half a product: spatial-2 is silent on the photographed pull list, which is an existing capability, and its accessibility story says nothing about reaching record 2.

**From spatial-1 (From the Door)**

The named, falsifiable landmark clause in the text line (not only inside the drawing), with the degradation rule: no verified fixed feature in the geometry, no clause. Two labelled anchors instead of a second route where two features exist. Refusals written in the same grammar as the success case, saying why the drawing is absent. Ambiguity stacked, never merged: two matches produce two crops each marked, with the existing serial-run caveat between them. The staff code at equal type size. The row number printed so the reader can check it against the shelf label, with the accessible name carrying the same number. Explicit refusal of device orientation, compass and asking the reader where they are standing.

*Why it survived.* [librarian] eliminated it on G2 — "count 10 rows from the elevator lobby" asserts a position nobody looked up, and mis-anchoring produces a fluent wrong aisle — but ruled it had the better prose instincts, and that graft 4 (stacked ambiguity) is mandatory because one drawing with two fills would be an averaged answer and a G2 break.

**From spatial-3 (The Shelf You Face)**

Spine ranges as the newcomer's real education, made progressive rather than conditional: print the target row's call-number range under the crop and neighbours' ranges inside it where they fit; where a range is unrecorded the label is simply absent from an otherwise complete drawing. The partial-knowledge caption verbatim in form: "the level, row and side above are looked up; the ranges below are not." /map as chooser as well as zoom-out: rows focusable, each announcing its range as the mark lands. No interpolated ranges between two known shelves; no photographs of real shelves.

*Why it survived.* [newcomer] eliminated it because its orientation existed only where survey data existed and its answer surface went blank for unsurveyed rows, but ruled the ranges are the one thing that lets a reader self-correct at the shelf, and that without the partial-knowledge caption spatial-2's mark-or-nothing rule would let a missing range read as a range of nothing — a location claim it did not look up.

**From spatial-4 (Say It Like a Colleague)**

The same-string acceptance test: the drawing is a text structure first that happens to be drawn, so the screen-reader user receives the same ranges, the same order and the same landmark clause the sighted reader receives — never an image with a label bolted on. Lists everywhere are walkable sequences with position announced ("row 3 of 12"), in one grammar for rows, records and stops. Per-row last-verified stamping with automatic suppression of anything past the review interval. The absence rule: when data is missing the sentence shortens to the coordinate clause rather than expanding into apology.

*Why it survived.* [sceptic] eliminated it because a stale landmark is confidently wrong with no technical means of detection, but ruled its list grammar the only answer on the table to the "27 records, no way to reach record 2" failure and its dated-verification instinct the thing that turns decaying data from an accident into a governed, visible state.

**From declarative-1 (Answer With Receipt)**

The receipt: plain text under the place line naming the mapped range that produced the answer and the date it was last verified — not a control, not an expandable, so it costs no focus stop and the expert's eye is already gone. On a refusal it becomes evidence: "Checked 41 mapped ranges on levels 8–10." Plus the map-arrival mechanic in full: programmatic focus moves to the target shelf, scrolled to the centre, with a persistent non-animated outline and a banner repeating the exact lines home showed. Hollow shelves say "no range recorded" rather than being silently blank. No hover-only disclosure; every definition keyboard-reachable at 44 px.

*Why it survived.* [screenreader] eliminated it for making every noun in the answer line a control — the floor plan's forty spoken "R L"s reappearing on the fold — but ruled the receipt the strongest G2 material in the bracket and the focus-actually-moving arrival materially better than "opens focused with the verb line pinned"; landing at the top of /map to hunt for a pinned line is the spatial failure again, by ear.

**From declarative-2 (Five Shapes of Knowing)**

DERIVED is never collapsed into LOOKED UP: a title query states two claims separately — "The catalog gave QP 376 for this title" and "QP 376 maps to Level 10 · Index 10 · Right" — and the drawing draws only the second, so a shaky catalog result is never lent confidence by the picture. One fixed grammar of failure across all seven surfaces, including /hours announcing both outcomes ("LibCal answered" / "LibCal did not answer") and /databases saying "Listed, not searched." Failure has a shape, not a colour: no numeric confidence, no star ratings, no generic error styling. Legend words and refusal key terms link to their own anchored paragraph in /methodology. The ambiguity caveat is text-first and outranks the picture: if the fold is tight, the caveat stays and the crop drops.

*Why it survived.* [librarian] eliminated it because a fixed grammar of five sentence skeletons breaks the first time reality fits none of them — force the fit and it is a dishonest claim on the fold — but ruled the derived/looked-up separation the best trust mechanic in the bracket and its cross-surface failure grammar the thing that otherwise leaves /hours and /databases unimproved.

**From declarative-3 (The Drawn Unknown)**

Frame continuity stated as a rule: the crop is literally a crop of the same drawing at the same scale and orientation as /map, so tapping through changes the frame and nothing else and the shelf stays where the eye left it. Unmapped space is drawn hollow with a dashed edge and never as ordinary shelving; the legend says "not recorded", never "empty". The drawing binds to the same recorded range table that produces the sentence — never a hand-drawn asset, never an inferred bay count — and a row whose bay count is not recorded does not draw. Per-zone verification dates. One aria-label per drawing. No zoom widget, no pan, no animation.

*Why it survived.* It reached the semi-finals and lost twice on placement, not on substance: [newcomer] ruled the strip must not sit in the fold, and [librarian] ruled its bay-count assertion containable only if generated from the auditable range table. Frame continuity is the same structural claim spatial-2 won on, stated more precisely, and the hollow/dashed convention is what stops the drawing from asserting coverage it does not have.

**From declarative-4 (The Ledger)**

One string that is both the visible text and the aria-live region, announced once on change. Per-record keyboard navigation announcing "record 2 of 81 shown, 903 found." No ledger on the fast path — no spinner, skeleton or waiting line ever renders for a lookup that does not wait. No silent retries: a second attempt is a second line. Line-level OCR narration ("Read 9 of 12 lines. Lines 4, 7 and 11 could not be read — type them in and they will join the route"), and the OCR uncertainty line survives even when every line was read. Stops that came from read lines are marked distinctly from stops the librarian typed, using the same hollow-versus-solid convention, stated in the legend in those words.

*Why it survived.* [cohesion] eliminated it for a coverage gap — no ledger renders on the call-number path, so the commonest task is oriented not at all — but ruled it the single biggest anti-seam mechanism in the bracket and that it must not ship without the per-record announcement, which is the direct fix for the record-2 failure.

**From instrumental-1 (The Command Line)**

The session stack: prior lookups persisted in-memory as a compact, keyboard-arrowable strip above the answer, so a page of eight pulls does not lose number three while the librarian chases number four, and selecting any entry re-drives the same answer. One-key accelerators (M for the marked bay, W for why this shelf, C to copy) layered as 44 px rows, never the only route to anything. The overlay behaviour for M: plan pre-scrolled and pre-zoomed with the named bay in the middle third, its label repeated in text at the top edge, Esc returning focus to the input where it was. Numbered candidate records reachable by digit key and by tab. A permanently reachable "?" surface carrying the shelf vocabulary and a worked example. Whole words over codes in status text.

*Why it survived.* [desk] eliminated it because its whole orientation answer is a resting state destroyed by the first keystroke — a shared stack terminal where a colleague typed first presents a newcomer with a bare caret — but ruled the session stack the one thing the winner would otherwise cost the desk, and the "?" sheet the place its vanishing explanation must live instead.

**From instrumental-2 (Fixed Readout)**

The echoed query printed above the answer, so a mis-key shows up as a wrong echo instead of sending someone to a wrong aisle. A permanent status line naming the answer type on every result ("Mapped shelf, single match" / the serial-run sentence / the named refusal), allowed to wrap to whatever height the truth needs. A refusal renders as a filled answer with dashes in the value slots rather than as blank space, so it can never be mistaken for a page that failed to load. Stable word order and stable position for the four values inside the one text line. /map remains a browsable, searchable reference index — "what is on level 8", "where does the K run end", a cart of returns to shelve. Caveats and methodology as inline disclosure hanging off the status line.

*Why it survived.* It won three matches and lost the final on G1 and G3 — a four-field instrument panel rebuilds the fold the expert already reads fastest and moves the spatial help below it — but [desk] and [sceptic] both ruled its failure grammar better than the winner's: empty space is ambiguous at speed, and the echo is the cheapest trust device in the bracket because the first question is not "is the answer right" but "did it hear me".

**From instrumental-3 (The Queue Is the Unit)**

The pull list as a first-class input (pasted numbers or a photographed list), routed level, then aisle, then index so the walk is monotonic, arriving as a numbered route the drawing aims through rather than a second app. An unmapped entry is never silently dropped: it appears in place reading "No mapped shelf contains ZZ 999 Q999. Take this one to the desk." The walking delta as vocabulary between consecutive stops — "same aisle, four bays further" / "back to the landing, up to level 10" — free to the expert and exactly what a screen-reader user needs between answers. Plain-language anchor wording ("Start at the level 10 landing"). Next/previous bound to keys and to 44 px targets, plus a large Found / Not on shelf pair that records nothing anywhere and simply advances.

*Why it survived.* [newcomer] eliminated it for refusing a faster single-lookup layout on the commonest task in the building and for carrying mid-walk state in the URL, which dies on a sleeping phone — but ruled its queue the half of the work that must not be thrown away, and its anchor wording "the sentence that would have saved me".

**From instrumental-4 (Plan as Instrument)**

The crop shows neighbours, the aisle and adjacent bays — never a lone rectangle, which is as disorienting as the half-off-screen diagram. The spoken locative as the picture's non-visual twin, announced with the answer. Every drawn bay is a bay that was looked up; the plan is never decorative or approximate. Keyboard record-by-record aiming: arrow or tab to record 2 and the answer and the drawing both update, announced. Deep links open framed. And the rule for pressure: if anything must be sacrificed on a small portrait screen it is the picture, never the answer line or the status line.

*Why it survived.* [sceptic] eliminated it because its refusal leaves the previous query's outlined bay on screen beneath a sentence saying no shelf was found — a drawing asserts harder than a sentence withdraws — but ruled its diagnosis of the newcomer's failure the more important half of the direction, and the spoken locative a G6 obligation rather than a nicety.

## What this direction refuses

WHAT IT REFUSES TO DO

1. It refuses routes. No step counts, no turn-by-turn, no \"walk into the stacks and count ten rows\", no claim about which way the reader is facing, and therefore no \"on your left\". The landmark clause is a landmark-relative ordinal that the geometry can produce and the reader can falsify against the drawing (\"third row from the elevators\"), and nothing more. This is the ruling that killed spatial-1 and it is not quietly reintroduced through the walking cue that three judges grafted: the cue survives only in the reduced form above, plus the anchor phrasing \"Start at the level 10 landing\" where the landing is a verified fixed feature.

2. It refuses sensors. No device orientation, no compass, no geolocation, no asking the reader where they are standing before answering. The tool answers about the building, never about the body.

3. It refuses to draw when it has no mark. An unmapped call number produces the named refusal, the voided staff code, the count of ranges checked and no drawing. It also refuses to leave a stale drawing on screen under a refusal — the canvas is cleared, because a leftover mark reads as an answer.

4. It refuses to draw what it did not look up. Bay counts, row counts, sides and landmarks come from the same recorded geometry that produces the sentence, never from a hand-drawn floor plan and never from interpolation between two known shelves. A row whose bay count is unrecorded does not draw. A range past its review interval does not print. Unmapped space is hollow with a dashed edge and is labelled \"not recorded\", never \"empty\".

5. It refuses a second drawing style, a second picture type and a second vocabulary. One drawing, two zooms. No elevation view, no photographs of real shelves, no zoom widget, no pan, no animated camera. Under reduced-motion the zoom is an instant swap.

6. It refuses decorative plan detail — furniture, study rooms, service points that are not being used as anchors — because anything the reader cannot use to locate a shelf is noise competing with the mark.

7. It refuses a second layout for the pull list. No separate photo mode, no faster path for single lookups, no different answer grammar for twelve stops than for one.

8. It refuses to merge ambiguity. Two matching shelves are two crops stacked with the existing serial-run caveat between them, never one drawing with two fills and never a chosen best guess.

9. It refuses confidence theatre. No percentages, no stars, no colour-coded certainty. Failure has a shape and a sentence, not a hue.

10. It refuses to remove nav to buy fold. Nav is demoted below the answer and the crop, off the fold, in tab order, one nav on every surface.

11. It refuses hover-only and glyph-only disclosure, and refuses any accelerator as the sole route to anything.

WHAT IS GIVEN UP, KNOWINGLY

- Guidance. A reader who cannot read a floor plan gets a mark, a landmark clause and a spoken locative, and no walking instruction. That is the central trade and the panel took it: a librarian can say \"row 10, right-hand face\" and be right, but cannot vouch for where someone started counting.
- About four words of fold on every expert lookup for the landmark clause, and a ~180 px picture below the line. The clause is the only thing the expert pays that they do not pay today. If measurement shows it displacing the serial-run caveat or the refusal on a real one-handed phone, the crop is cut first and the clause second — the words always win.
- The instrument panel. The soldered four-field readout that would let the eye stop reading after the fortieth lookup is not built; only its status line, its echo and its stable word order survive inside the existing sentence.
- Certainty about the core mechanism. The direction rests on whether one clipped, labelled landmark per crop is enough anchoring, and there is no usage data and never will be. It must be settled by walking newcomers through the stacks with paper crops in hand before a line of it is built. The fallback if it under-anchors is today's sentence, which already works — a weak crop leaves nobody worse off, which is precisely why this trade was acceptable and a wrong walking order was not.
- Coverage honesty costs visible gaps. Stamped ranges expire, unstamped rows draw nothing, and the product will look patchier than a product that simply asserted. That is the intended appearance.

## Out of remit: needs a person

G7 bars the panel from ruling on taste. These are listed rather than decided.

- Palette and contrast tokens, in light and dark, including what colour the mark is. Out of remit under G7; the only constraint the panel may impose is that the mark must remain distinguishable without relying on hue alone.
- Typeface, and whether the staff code ("L10 · R10 · Right · top") gets a monospaced or tabular face. The panel ruled only that it stays at equal type size to the sentence; the face itself is taste. Any choice must be system-stack — no web font may block paint.
- How the mark is rendered — solid fill, hatch, outline, or a combination — and how it differs from the hollow/dashed convention for unrecorded space. This is a legibility question to be settled by testing on a coarse pointer in stack lighting, not by preference, but somebody has to run that test and choose.
- The visible affordance for pressable terms. The panel ruled a dotted underline alone is not enough on a coarse pointer and that pressability is a control-state question rather than taste; what it actually looks like is not the panel's call.
- Which physical features on each level count as "verified fixed" landmarks, and what each is called in the reader's words. This is a walk-the-building decision by library staff, level by level, and the whole landmark clause is empty without it.
- The verification interval for spine ranges and landmarks, who owns re-survey after a shift, and what happens operationally when a zone goes stale. The software suppresses stale data automatically; the cadence and the owner are a staffing decision.
- The paper-crop walkthrough with real newcomers that settles the direction's central risk — whether one clipped labelled landmark is enough anchoring. Who runs it, with how many people, on which levels, and what result would count as failure. This must happen before anything is built.
- The device matrix and the measured fold: which phones, held one-handed in portrait, and the actual measurement that decides whether the answer line, the status line, the caveat and the crop can coexist. The cut order is already fixed (crop first, landmark clause second, words never); the measurement is not done.
- Transition duration and easing for the home-to-/map zoom, within the constraint that reduced-motion is an instant swap.
- Brand, logo, favicon, page titles and whether /databases and /explainer keep their current names.
- Wording review of every refusal, caveat and scope sentence by whoever wrote the originals. G4 permits rewording and the synthesis introduces new ones (the partial-knowledge caption, the no-mark-no-drawing sentence, the OCR line narration); they must be written in the existing voice by the person whose voice it is.

## If this direction fails in the port

The runners-up, with the condition that would bring each back. A revert is per page, never per
wave, and a quarantined attempt is mined before it is discarded.

**spatial-3 (The Shelf You Face) — Plan view is the wrong picture for the last ten feet**

Revisit if: If the paper walkthrough shows the crop under-anchors — newcomers hold a marked plan and still cannot find the aisle — but the same readers self-correct instantly when shown neighbouring spine ranges, then the elevation was the right picture and the plan was the wrong one. This becomes reconsiderable only if the building-wide range survey is actually funded and completed; without it, spatial-3's answer surface goes blank for half of lookups, which is what eliminated it. Watch for it: the grafted spine ranges are the cheap partial test of exactly this hypothesis, and if they turn out to be the part readers use and the crop the part they ignore, the direction should be re-run.

**subtract-4 (Route Of One) — Subtract the special case**

Revisit if: If the pull list turns out to be the dominant task rather than the second one — if the fold discipline keeps getting broken by pressure to put a count, a mode label or an upload affordance above the first stop, and the drawing keeps losing arguments to list scaffolding — then the ordered list is the real primary object and the crop is an accessory to it. Route Of One already carries most of this document's grafts and would need only the crop attached to the focused stop, which the synthesis already specifies. Its precondition is that walking order must be looked up, never inferred; if the geometry cannot supply verified walking order, this fallback is unavailable.

**instrumental-2 (Fixed Readout) — Treat the screen like an instrument panel with a soldered layout: the answer always renders in the same rectangle, at the same size, in the same word order, so the eye learns one landing spot and stops reading after the fortieth lookup**

Revisit if: If measured time-to-shelf at the desk regresses after the port — the landmark clause and the crop cost real seconds across forty lookups, or staff report scanning past prose to find the code — then the eye needs a soldered landing spot more than the newcomer needs a drawn one. Fixed Readout won three matches on exactly that argument and lost the final on the assumption that the crop is free. It is the correct fallback if that assumption turns out to be false, and its status line, echo and dash-refusal are already grafted, so the port back is short. Its own condition stands: the status region must grow to fit ambiguity, truncation and pull lists, or it breaks G4.

**declarative-2 (Five Shapes of Knowing) — There are only five ways this tool can know something, and each gets a fixed sentence skeleton and a fixed layout used identically on every surface — so the reader learns the grammar of the product's honesty once and reads it everywhere without re-reading**

Revisit if: If the honesty language fragments during the port — if /hours, the catalog path, OCR and the map each end up with their own phrasing for failure despite the grafted grammar — then the discipline approach has failed and the fixed sentence skeletons are worth their cost. Its known break must be answered first: there must be a written rule that a new shape requires retiring one, because at eight shapes nobody has learned the grammar and the first case that fits none gets forced into the nearest, which is a G2 breach on the fold.

**declarative-3 (The Drawn Unknown) — The failures that hurt are spatial, so the honesty should be drawn, not written: every answer appears as a filled position inside a small picture of what is mapped and what is not, and unmapped space is drawn hollow rather than left blank**

Revisit if: If the coverage story turns out to matter more than the locating story — if staff and readers keep asking "is this level even mapped, and as of when" and the per-zone verification dates become the reason people trust the tool — then the honest picture of what is and is not mapped deserves to be the organising idea rather than a property of the crop. It is the nearest neighbour to the winner (same drawing, same data binding, different emphasis), so this is a re-emphasis rather than a rebuild. It must not bring back the in-fold strip: that is what eliminated it, twice.

**subtract-1 (Answer Only) — The answer is one line and the page is whatever is left over**

Revisit if: If the SVG cannot be made to paint inside the budget from already-loaded geometry — if the crop turns into a second request, a lazy load or a measurable delay on a 3.5 s cold paint — then the drawing has to go entirely and the direction collapses back to the sentence plus per-term expansion. Answer Only is that product. Its nav deletion stays rejected under G5 in any revival: nav below the fold, never absent.

## The full pool

- **subtract-1** (Answer Only) — The answer is one line and the page is whatever is left over.
- **subtract-2** (The Marked Face) — The words are the disposable half, not the drawing.
- **subtract-3** (One Field, No Pages) — The thing to subtract is not the answer, it is the site.
- **subtract-4** (Route Of One) — Subtract the special case.
- **spatial-1** (From the Door) — A location is meaningless without an origin: the answer is not where the shelf is but how you get there from a place you are already standing.
- **spatial-2** (One Drawing, Two Zooms) — The newcomer's failure was framing, not narration: she had the right words and the wrong viewport.
- **spatial-3** (The Shelf You Face) — Plan view is the wrong picture for the last ten feet.
- **spatial-4** (Say It Like a Colleague) — The building is already full of orientation — signage, furniture, the window wall, the crank on the compact shelving — and the tool's job is to name it, not to redraw it.
- **instrumental-1** (The Command Line) — Shelfmark becomes one persistent command bar with a small typed grammar and a stack of result blocks beneath it; the seven pages become seven commands against the same input, so the expert never navigates, only types.
- **instrumental-2** (Fixed Readout) — Treat the screen like an instrument panel with a soldered layout: the answer always renders in the same rectangle, at the same size, in the same word order, so the eye learns one landing spot and stops reading after the fortieth lookup.
- **instrumental-3** (The Queue Is the Unit) — The commonest task is not one call number, it is a shift's worth of them; so the primary object is an ordered pull list and the primary surface is a stepper that shows exactly one shelf at a time in walking order, with next and previous bound to keys and to thumb-sized targets.
- **instrumental-4** (Plan as Instrument) — The newcomer's documented failure was spatial, so invert the hierarchy: the floor plan is not a page you tap through to, it is the answer surface itself, permanently on screen, and typing is how you aim it.
- **declarative-1** (Answer With Receipt) — Every answer carries, in its own body, the provenance that produced it: one place line, and directly beneath it one grey line naming the mapped range and the date that range was last verified.
- **declarative-2** (Five Shapes of Knowing) — There are only five ways this tool can know something, and each gets a fixed sentence skeleton and a fixed layout used identically on every surface — so the reader learns the grammar of the product's honesty once and reads it everywhere without re-reading.
- **declarative-3** (The Drawn Unknown) — The failures that hurt are spatial, so the honesty should be drawn, not written: every answer appears as a filled position inside a small picture of what is mapped and what is not, and unmapped space is drawn hollow rather than left blank.
- **declarative-4** (The Ledger) — Everything this tool does not do instantly, it does through someone else — the catalog, LibCal, an OCR pass — and the honest design is a running plain-sentence record of what was asked, what came back, and what did not, shown and announced as the same text.
