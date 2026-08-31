# Brief: Home (the app)

Written from the frozen direction in `ops/DIRECTION.md`. Rulings are numbered so a code
comment can cite one six weeks from now by somebody arguing with it.

**The job.** Take one field's worth of input — a call number, twelve call numbers, a photographed list, or a title — say out loud how it read the input, and return either a shelf you can walk to (sentence, staff code, landmark clause, marked crop, ranges) or a named refusal, with the answer painting first and alone.

**The reader.** Two readers pass through the same stages on the same surface. The desk worker wants the coordinate and the staff code and is gone in under two seconds; failing means the line moved, shrank, or was pushed down by anything that arrived with the picture. The newcomer believes the sentence and still cannot find the aisle; failing means she holds a correct coordinate, sees a plan with her shelf unmarked or off-frame, and walks the wrong row. Both fail identically at a blank: at speed an empty answer region reads as a page that did not load, not as "we do not know".

## Rulings

### HOME-1

After a lookup, nothing renders between the top of the viewport and the answer line except the echoed query and its routing statement, whose contents HOME-12 defines; the h1, the lede, the examples row, the site nav, the catalog panel and the article panel all render after the crop, and the answer's vertical offset is identical for every answer type including refusals.

*Amended (Stage 02b).* This ruling previously read "the answer line is the first element in DOM order below the search field", absolute, while HOME-12 made the routing statement with its one-click reversals mandatory and "the only thing permitted above the answer line". An implementer obeying the old wording literally would have deleted the thing HOME-12 requires. The new wording matches DIRECTION line 52 and lets HOME-12 own what that block may contain.

*Because.* Rule 1 and subtract-4's acceptance test adopted verbatim in DIRECTION ("nothing — no header, count, mode label, legend, level chooser or upload affordance — is ever placed between the top of the viewport and the answer line"), plus G1. Without it the picture, the mode label or the panel headings buy pixels from the one thing measured in seconds.

*Caught by.* Render each of the answer fixtures and assert the answer node's index among main's children is lower than nav/panel/examples nodes, and that its getBoundingClientRect().top is equal across fixtures to within 1 px.

### HOME-2

The answer line keeps today's exact composition and order — "Level 10 · top row · index 10 · Right side" — with the landmark clause appended after "side" and the staff code rendered at a computed font-size equal to the sentence's, never inside a caption, aside, small or figcaption element.

*Because.* Layer 1 ("today's wording, today's position, unmoved") and layer 2 (graft from spatial-1, "never demoted to caption"). The invariant is that **the four values keep today's order, wording and screen position**; the landmark clause is appended after them and the pressable terms of HOME-8 wrap three of the existing words. The expert's cost is the four words of landmark the direction books explicitly as his cost, not zero.

*Amended (Stage 02b).* This ruling justified itself on the rendered string being "byte-identical to today's" while the same sentence appends a clause and HOME-8 wraps three words in buttons. The string cannot be byte-identical and also four words longer, so the stated test could never pass and the ruling was unfalsifiable as written. "Byte-identical" is dropped; the order-wording-position invariant is what is actually meant and is testable.

*Caught by.* String-compare the rendered line for a known hit against the pinned fixture prefix; assert getComputedStyle(staffCode).fontSize === getComputedStyle(sentence).fontSize and staffCode.closest('figcaption,small,aside') === null.

### HOME-3

The crop is inline SVG emitted in the same render pass as the sentence, from the hits array already in memory; it contains no src, no href to an external resource, no loading="lazy", and triggers no network request between the answer painting and the crop painting.

*Because.* Rule 1 ("paints with it from geometry already in memory, never a second request, never a lazy load, never an image fetch") and G1. Today's previewMap already satisfies this by calling planShelves; the ruling exists so a port does not turn it into an <img> or a fetch when it grows.

*Amended (Stage 02b).* Gains one requirement from SHARED-2: the crop centres the marked face horizontally. This is what makes DIRECTION line 58 ("the same point on screen") and line 141 ("scrolled to the centre") describe one behaviour rather than two contradictory ones, and it is the condition under which the home-to-/map transition preserves continuity at all.

*Caught by.* Instrument fetch/XMLHttpRequest around the render and assert zero calls; assert the crop subtree has no [src] or [href^="http"]; assert the marked face's centre falls within the middle third of the crop's width.

### HOME-4

The landmark clause prints only from a verified fixed feature in the geometry for that level; where the geometry has none the clause is absent and the coordinate prints alone, and no landmark string is ever hardcoded in the renderer.

*Because.* Layer 3's degradation rule, verbatim from spatial-1, and G2. An invented anchor produces a fluent wrong aisle, which is the failure the whole product refuses.

*Caught by.* A fixture level with no verified feature must render the sentence with no em-dash clause; grep the renderer for literal feature names ("elevator", "landing", "stairs") outside the geometry file and fail on any hit.

### HOME-5

A refusal renders as a filled object: the named refusal in the answer's grammar, the staff-code slot present and voided with dashes rather than removed, the evidence line counting ranges checked, and no SVG at all — and any crop from a previous query is removed from the DOM before the refusal paints.

*Because.* Rule 2 and refusal 3 in DIRECTION ("it refuses to leave a stale drawing on screen under a refusal — the canvas is cleared"); this is also what sceptic's elimination of instrumental-4 was about. Blank space fails the same reader a stale mark fails.

*Caught by.* For each of the seven refusal fixtures assert `.prevmap` count === 0, assert a dashed staff-code node exists, and assert the evidence line matches /Checked \d+ mapped ranges/.

### HOME-6

One emitter produces the **shelf claim** — sentence, staff code, landmark clause and crop — for both answer paths, the direct call-number path (today shelfPreview) and each catalog holding (today shelfBlock), so the same hit yields identical output wherever it appears on the page. The **catalog claim** on the derived path is a separate line, owned by HOME-15, rendered above the shelf claim and never merged into it.

*Amended (Stage 02b).* As written this required the two paths to render identically, which the grafted derived/looked-up separation forbids: a title answer must state two claims, "The catalog gave QP 376 for this title" and "QP 376 maps to Level 10 · Index 10 · Right", and a direct lookup has only the second. METH-4 already assumed home printed the two-claim sentence and made itself its link target, while no HOME ruling created it. Splitting the emitter by claim keeps both.

*Because.* G5 (one vocabulary for the same thing) and rule 3. Today these are two independent renderers that already disagree in markup and in whether a range is shown; a port that keeps both will drift the moment the crop is added to one of them.

*Caught by.* Feed the same hit object to both call sites and assert identical output HTML.

### HOME-7

Two or more matching faces render as two or more complete answer objects stacked, each with its own crop and its own focus target, with the existing serial-run caveat between them; never one drawing with two marks and never a chosen best guess.

*Because.* Refusal 8 and the librarian's ruling that stacked ambiguity is mandatory because one drawing with two fills is an averaged answer and a G2 break. Today's code already refuses to carry `q` to the map when more than one face matched — same instinct, and it must survive.

*Caught by.* Multi-hit fixture: assert crop count === hit count, assert each crop has exactly one marked face, and assert the serial-run sentence appears between them.

### HOME-8

"Index", "row" and "side" inside the answer line are <button>s with aria-expanded, in tab order, with a 44 px hit target and a non-hover affordance, occupying zero additional height when closed; they are present on every stop of a multi-stop answer, not only the first.

*Because.* Layer 6, including subtract-1's admitted risk treated as a build requirement, plus G6 and refusal 11 (no hover-only, no glyph-only, no accelerator as sole route). A label is not a definition; "Index 10" does not tell anyone bays are counted from the aisle mouth.

*Caught by.* Assert the three buttons exist per stop with aria-expanded="false", offsetHeight of the closed panel === 0, and each control's hit box ≥ 44 px; assert the answer block's height is unchanged with all three closed versus absent.

### HOME-9

Each crop carries exactly one accessible name — one sentence naming level, row, side, the landmark and the flanking indexes — and no per-shelf labels; the non-visual reader gets the same string the sighted reader assembles from the drawing, not a different or shorter one.

*Because.* spatial-4's acceptance test adopted whole ("the same string for sighted and screen-reader"), G6, and the fact that today's page already has this property (role="img" with one aria-label on .prevmap) and would lose it silently to a redraw that labels shelves individually.

*Amended (Stage 02b).* The sentence itself is no longer fixed here. It is generated by the one shelf-sentence generator of SHARED-5, which both zooms use, because MAP-7 was independently giving the same shelf a different word order and different content at the far zoom — so the two zooms of one drawing named the same shelf two ways at exactly the moment the reader crossed between them. This ruling keeps what is genuinely home's: one accessible name per crop, no per-shelf labels.

*Caught by.* Assert the SVG has role="img" and one aria-label, and that no descendant of the crop carries aria-label, title or role="img"; assert the aria-label equals the SHARED-5 generator's output for that face.

### HOME-10

The mapped range that produced the answer prints as plain text under the answer line with its last-verified date — not a control, not an expandable, no focus stop — and a row whose stamp is past the review interval prints no range and says so instead.

*Because.* The receipt graft (spatial-4/declarative-1) and refusal 4 ("a range past its review interval does not print"). Today the range already prints as `start → end` inside the hit; making it a disclosure would cost the expert a focus stop for something his eye has already left.

*Caught by.* Assert the receipt node matches no interactive selector (button, a, summary, [tabindex]); assert a stale-stamp fixture renders the stale sentence and no range digits.

### HOME-11

Twelve stops render as twelve of the same answer object in one list, each its own focus target, with the crop belonging to the focused stop; an entry that cannot be mapped keeps its position in the list and carries its refusal by name, and is never dropped or moved to the end. Focusing a stop announces its position in the SHARED-4 list grammar — "stop 3 of 12 shown, 12 found".

*Amended (Stage 02b).* This ruling required focus targets and no position announcement, while DIRECTION grafted one list grammar for rows, records and stops and named this very list as the instance it was grafted for. `/databases` had written the string without authority and `/map` had written a third shape. Home owns the string now; the other two cite it (SHARED-4).

*Because.* Rule 3 and refusal 7 (no second layout for the pull list). A dropped entry is a silent claim that the reader's twelfth slip does not exist.

*Caught by.* A twelve-item fixture with three unmappable entries must render twelve list items in input order, three of them refusals, with exactly one crop attached to the focused stop.

### HOME-12

The statement of how the box read the query, with all other readings offered as one-click reversals, is part of the echoed query and is the only thing permitted above the answer line; it never renders as a mode picker, a tab strip or a pill row.

*Because.* DIRECTION's Home section ("Above the answer: only the echoed query") plus the polymorphic-field graft ("states which way it routed with one-click reversal") and the ban on a mode label above the fold. Today's routed line already offers every reading rather than the two it was choosing between — that generosity is the reversal and must survive.

*Caught by.* Assert the only element between the field and the answer is #routed; assert its controls are buttons with text, not aria-pressed pills.

### HOME-13

The answer line and the staff code must reach their final metrics at first paint using the system fallback stack; no web font may be in the critical path for those two elements, and no font swap may reflow them.

*Because.* G1 and the hard constraint that web fonts once cost 803 ms of a 3.5 s first paint. The page today loads two Google fonts via the print-media onload trick, so paint is not blocked — but the answer must also not move when they arrive. Which face is used is G7 and is listed as out of remit.

*Caught by.* Assert the answer element's font-family declaration resolves to a system stack, and compare its bounding box before and after the webfont stylesheet's media flip.

### HOME-14

Only geometry that was looked up is drawn: a row with an unrecorded bay count draws nothing, unmapped space is hollow with a dashed edge labelled "not recorded" (never "empty"), and no bay position is interpolated between two known shelves.

*Because.* Refusal 4 and G2. The crop is generated from the same DATA the sentence came from; the moment it fills a gap to look complete it asserts a place nobody surveyed, which is the failure mode the whole file is built around.

*Caught by.* A fixture level with an unrecorded row must produce a crop with no rect for that row and a dashed "not recorded" region; assert the renderer reads only from DATA keys, with no arithmetic over neighbouring shelf ids.

### HOME-15

*Added at Stage 02b, to close the HOME-6 / METH-4 contradiction.*

On the derived path — a title searched, a holding returned — the answer states two claims as two
separately-sourced lines, in this order: what the catalog said ("The catalog gave QP 376 for this
title"), then what this site did with it ("QP 376 maps to Level 10 · Index 10 · Right side"). The
second line is HOME-6's shelf claim, unchanged and identical to the direct path's. Neither line
may be collapsed into the other, and the catalog line names UCLA's catalog as its source rather
than stating the call number in this site's own voice.

*Because.* The derived/looked-up separation, grafted at DIRECTION line 147 and ruled the best
trust mechanic in the bracket. A title answer is two lookups and they can fail independently: the
catalog can hand back the wrong record for a title, and the mapping can be right about a call
number that was never the reader's book. Merging them produces one confident sentence whose two
halves have different warrants, which is the same class of failure as an unmarked plan. METH-4
already anchors an explanation to this sentence.

*Caught by.* A derived-path fixture must render two distinct nodes; assert the catalog line names
the catalog and precedes the shelf line, and assert the shelf line is byte-identical to the same
hit rendered through the direct path.

## Must survive the port

Read off the working page. These are what a rewrite deletes without noticing.

- **"This call number could not be parsed with confidence. No shelf is shown, because a wrong aisle is worse than none." (WHY.unparseable, index.html ~1928)** — Pinned twice (wrong-aisle-worse-than-none, unparsed-cn-shows-no-shelf). It is the stated reason every other refusal exists; without it the refusals look like bugs.
- **"Range not mapped. This call number falls outside every recorded shelf range. Check the floor by class letter, or ask at the desk."** — Pinned (unmapped-range-refused). The survey is not the whole building. This is the sentence the new evidence line ("Checked N mapped ranges") attaches to, not replaces.
- **"This Biomed location is not in the routing table yet. Ask at the desk rather than walking the stacks."** — Pinned (unrouted-location-refused). A Biomed location code with no route must send the reader to a person, not into the stacks.
- **"This holding carries no call number, so no shelf can be resolved." and "Media copy. Discs are held at a service desk, not in the stacks, so no shelf is shown."** — Pinned (holding-without-cn-refused, media-not-in-stacks). Four different not-on-a-shelf answers exist deliberately; collapsing them into one "unavailable" is a worse answer four times over.
- **The four off-shelf routings: Reserves "Ask at the Circulation Desk", Special Collections "access is by arrangement", SRLF "not in this building; request it in the catalog", RES_SHARE "Not a UCLA copy — … there is no shelf anywhere to walk to."** — All four pinned. Each prevents a specific wasted trip; the RES_SHARE one exists because rendering it as a held copy invents a building.
- **"N shelves match. A serial run shares one call number, so check the volume and year on the spine."** — The only self-correction a reader has when one call number legitimately lands on several faces. HOME-7 stacks the crops around this sentence; it must not be replaced by a picture.
- **The appended-slip warning: "Read as <added>. <lastAnswered> was still in the box from the last search and had no part in this answer."** — Unpinned and easy to delete. It exists because a scanner types at the caret and the previous number silently decided the answer — forty slips a shift with a range line nobody re-reads as the only tell. Its partner behaviours (select-on-focus, lastAnswered bookkeeping) go with it.
- **The W1 spacing pair: the repair note "Read as <term>. A W1 number needs a space after the prefix." and the refusal when more than one split lands ("…has none. Nothing on the mapped shelves matches it as typed.")** — The refusal is the load-bearing half: a split that merely lands inside a range is not evidence, and the first version of this code answered confidently from an invented prefix.
- **"No mapped shelf contains <CN>. It may be on a level not yet entered, or outside the mapped ranges."** — The direct-path miss. Rule 2's refusal object is built on this sentence, and G4 permits rewording it, never removing it.
- **The routing line and its reversals: "Read as a call number and looked up on the shelf map.", "Searched the catalog.", "Treat it as a call number instead", plus the catalog and article reversals offered together rather than only the pair the box was choosing between.** — Pinned three times (routing-guess-is-stated, routing-guess-is-reversible, catalog-scope-is-named). The reader is the one who knows what they meant.
- **"Could not reach the catalog: …", "Could not reach the article index", "Could not reach the link resolver" as three separately named upstreams.** — Pinned. Naming which upstream failed is what tells a desk worker whether to wait or to phone somebody; one generic error erases that.
- **"Nothing matches “x”…" and "Still nothing for “x”…" including the spelling-repair narration.** — Pinned (zero-results-say-so, repair-is-flagged-as-a-guess). Zero results is an answer and has to look like one; a repair is flagged as a guess rather than presented as a hit.
- **The cover checkbox, unticked by default, labelled "(sends the ISBN to openlibrary.org)".** — Pinned (covers-name-the-third-party). It is the page's only third-party request and the only place the reader can see it. The default-off state matters as much as the words.
- **Footer: "The shelf map is surveyed by hand and the data comes from UCLA's public endpoints. Not affiliated with, or endorsed by, the UCLA Library."** — Pinned twice (map-surveyed-by-hand, not-affiliated-with-ucla). Nav is demoted below the crop by refusal 10; the footer text is demoted with it and deleted with neither.
- **The skip link "Skip to the search box" and #result's role="status" aria-live="polite".** — Pinned (skip-link-exists, result-is-a-live-region). Nothing about the page looks different when they go. Every new layer must land inside or announce through this region, and the crop's arrival must not turn one answer into forty announcements.
- **Level 9 is excluded from stacks shelf hits; Special Collections is reachable only through the explicit "Hist Div" prefix.** — A stacks call number must never resolve into a collection with different access rules. Any port of shelfHits that iterates DATA without the `9|` guard reintroduces this silently.
- **The map link carries &q= only when exactly one face matched.** — The map answers `q` by re-looking-up and taking the lowest level, so on a serial run spanning floors it would land the reader on a face they did not choose. This is the same bug the product exists to prevent, one click later.
- **The shelf hit is an <a href="/map?...">, not a button.** — Middle-click and open-in-new-tab work for free, and the map is a place you go. The home→/map zoom must not turn it into a script-only control.
- **No autofocus on the search field.** — On a phone it opened the keyboard over the page on every load before anyone decided to type. A rewrite "improving" focus management restores that.
- **The "I'm working at" selector's promise — "searches here first, and shows this library's copies" — and the note for a non-Biomed home library: "There is no per-shelf map for X yet, so the call number is as precise as this gets."** — Twenty of the twenty-one libraries have no geometry. That sentence is the honest floor of the whole product for most of its users, and the direction never mentions it.
- **onlyMine() suspending the "only my library" filter when a search has widened away from it.** — Otherwise every card reads "no Biomed copy, untick only my library" and the answer is buried under an instruction to undo a default the reader never chose.
- **availChip's refusal to invent counts: "Multiple volumes, check at the desk" for check_holdings, and no number when $f/$g are absent.** — G2 at the level of a chip. A fabricated "3 of 5" is the same class of lie as a fabricated aisle.
- **Smart paste: a pasted Primo record has its call number extracted, and "Hist Div" is re-prefixed into the box so the reader can see what was read.** — This is the closest thing the page has today to the direction's polymorphic field, and it works by showing its reading rather than acting on it silently.

## New claims, to be pinned before the page is written

- The partial-knowledge caption, in spatial-3's exact form: "the level, row and side above are looked up; the ranges below are not."
- The evidence line on a refusal: "Checked 41 mapped ranges on levels 8–10" (count and level span generated, not hardcoded).
- The no-mark-no-drawing refusal: "No mapped shelf contains ZZ 999 Q999 — nothing to draw, because there is no mark."
- The voided staff-code slot rendered with dashes rather than removed.
- The stale-range line: a row past its review interval prints no range and says that it is unverified rather than showing unchecked numbers.
- "not recorded" as the label for unmapped space in the crop — never "empty".
- The crop's single accessible name, e.g. "Level 10 floor plan, centred on row 10; the marked shelf is the right-hand face, third row from the elevators, between index 9 and index 11."
- The landmark clause itself as a rendered string ("— third row from the elevators"), and its documented absence where no verified fixed feature exists.
- The per-row last-verified stamp printed beside each spine range.

## Out of remit (G7): a person decides

- Palette and contrast tokens in light and dark, including what colour the mark is (only constraint the panel may impose: distinguishable without hue alone).
- Typeface, and whether the staff code gets a monospaced or tabular face — the page currently loads Fraunces and Spline Sans Mono from Google Fonts; whether they stay is taste, subject only to HOME-13's no-blocking-paint constraint.
- How the mark is rendered — solid fill, hatch, outline, or a combination — and how it differs from the hollow/dashed unrecorded convention. A stack-lighting coarse-pointer test somebody has to run.
- The visible affordance for the pressable terms in HOME-8; the panel ruled a dotted underline alone insufficient on a coarse pointer and ruled nothing further.
- Which physical features on each level count as "verified fixed" landmarks and what each is called in the reader's words. HOME-4 is inert until library staff walk the building level by level.
- The verification interval for spine ranges and landmarks, who re-surveys after a shift, and what happens operationally when a zone goes stale. HOME-10 suppresses stale data; the cadence and the owner are staffing decisions.
- The paper-crop walkthrough with real newcomers that settles whether one clipped labelled landmark is enough anchoring — who runs it, with how many people, on which levels, and what counts as failure. It precedes the build.
- The device matrix and the measured fold: which phones, one-handed portrait, and the measurement deciding whether answer line, status line, caveat and crop coexist. Cut order is already fixed (crop first, landmark clause second, words never); the measurement is not done.
- Transition duration and easing for the home→/map zoom, inside the reduced-motion instant-swap constraint.
- Brand, logo, the tagline "the book, then the aisle", favicon, page titles, and whether /databases and /explainer keep their names.
- Wording review, by whoever wrote the originals, of every sentence this brief introduces: the partial-knowledge caption, the no-mark-no-drawing refusal, the evidence line, the stale-range line, the crop's accessible-name sentence.

## Silences in the direction, raised not filled

- Where the "I'm working at" library selector goes. DIRECTION bans a level chooser above the answer line and says "above the answer: only the echoed query", but the selector is a scope control that changes what every answer on the page means, and the direction never mentions it. Demoting it silently changes answers; leaving it breaks HOME-1's letter.
- Whether the site header, brand block, h1 ("Find a book, an article, or a shelf") and lede survive above the field on home at all. Nav is explicitly demoted below the crop; the header is not addressed.
- The photographed pull list. Home has no photo input today — the OCR sentences ("in your browser", "never uploaded") live in about.html and describe a capability this page does not expose. The direction assumes the field takes a photo and says an upload affordance may not sit above the answer, but never says where it does sit or what it looks like before a first query.
- Twelve call numbers. Nothing on home parses more than one; smart paste deliberately extracts exactly one call number from a pasted record. The direction rules the answer SHAPE for twelve stops and is silent on intake: how twelve are entered, whether they are ordered by the reader or by the geometry (walking order must be looked up, never inferred, and the geometry may not supply it).
- The "session stack of prior lookups" is named once in the Home section and nowhere else. No ruling on its depth, whether it survives reload, or how it coexists with the no-cookies/no-storage constraint.
- The catalog and article panels are roughly nine tenths of this file and appear nowhere in the direction. Unresolved: whether the seven layers apply inside each catalog holding row, and whether a catalog result set outranks the crop in scroll order when the query was a title rather than a call number.
- The twenty non-Biomed libraries. The direction speaks only about Biomed geometry; it does not say what layers 2–5 become when the honest answer is "the call number is as precise as this gets", which is the majority case in the selector.
- Hist Div / Level 9 Special Collections answers: level 9 is excluded from stacks geometry, so it is unclear whether such an answer gets a crop at all, or a refusal-shaped object with a location that is nonetheless real.
- Article and DOI answers have no shelf and no geometry. Which of the seven layers apply to a link-resolver answer, and what its staff-code slot contains, is not addressed.
- No byte or node budget for the inline crop against the 198 KB / 3.5 s first-paint envelope, even though rule 1 forbids deferring it.

