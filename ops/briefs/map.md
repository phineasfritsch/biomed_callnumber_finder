# Brief: /map

Written from the frozen direction in `ops/DIRECTION.md`. Rulings are numbered so a code
comment can cite one six weeks from now by somebody arguing with it.

**The job.** /map is the same floor drawing at whole-level frame: it receives a reader arriving from a home answer and puts the marked shelf under her eye, focused, centred and outlined, with the answer's own lines repeated beside it; and, second, it turns a pull list into an ordered walk over that same drawing.

**The reader.** Two readers, one surface, in the direction's own order of stages. The newcomer arrives here already holding the right words ("Level 10, top row, index 10, Right side") and needs the place; she fails if she lands on a plan that is scrolled elsewhere, unmarked, or marked with something she has to hunt for — that is the exact failure this whole direction exists to fix, and landing at the top of /map to look for a pinned line is the same failure by ear. The staff reader arrives with eight to twelve slips and needs a walk that is monotonic and honest about what it could not place; he fails if an unlocatable call number is quietly moved to the bottom of the page, or if the order is asserted rather than looked up.

## Rulings

### MAP-1

Arrival is one code path, and every deep link takes it: ?q=, ?lvl=&id=&side=, and #level-N all resolve to the framed answer state — level set, shelf selected, stage scrolled to centre, the plan's horizontal scroll set so the marked face sits under the middle of the viewport, and programmatic focus moved to that shelf's g[role=button].

*Because.* The direction's /map paragraph and the graft at DIRECTION.md:141 ("programmatic focus moves to the target shelf, scrolled to the centre") plus "Deep links resolve to the answer state, never to a homepage the reader must re-query." Today only the ?lvl=&id= branch scrolls and centres; the ?q= branch — which is the one home actually hands over — calls locate() and returns, so the commonest arrival is the un-centred one. Without this the newcomer lands where she landed before.

*Caught by.* For each of the three deep-link forms, assert after load: document.activeElement is the marked shelf group; .planwrap scrollLeft puts colX(index) within the middle third of clientWidth; the marked face carries the outline class. Same assertions at 390px and at desktop width.

### MAP-2

The arrival mark is a persistent non-animated outline that stays until the reader asks a different question; the 1600 ms flash-then-clear is deleted, and no setTimeout ever removes a mark.

*Because.* The /map paragraph says "persistent non-animated outline", and refusal 5 forbids animated camera work. G1: a mark that expires means a reader who looked up mid-walk comes back to an unmarked plan and has to re-query. The three existing `setTimeout(()=>{flashId=null;renderPlan();},1600)` calls in map.html (locate, the deep-link IIFE, routeShow) are the thing this ruling removes.

*Caught by.* grep the file for setTimeout paired with flashId — zero hits. After locate(), advance timers 5000 ms and assert the outline is still in the DOM.

### MAP-3

The arrival banner repeats the home answer's lines verbatim and in home's order — sentence, staff code at equal type size, landmark clause where the geometry has one — regenerated from the same geometry, never paraphrased and never re-worded for the smaller frame.

*Because.* The /map paragraph: "a banner repeating the exact lines home showed", and the /map density note: "Nothing here is absent from home except the other levels and the walk." Layers 1-3 of G3's seven. If the two surfaces word the same answer differently, crossing between them is a change of kind, not of zoom, and G5's one-vocabulary rule breaks at the exact moment the reader is comparing the two screens.

*Caught by.* One shared renderer produces both; a test asserts string equality between the home answer block and the /map banner for a fixture set of call numbers, including one with no landmark and one Special Collections hit.

### MAP-4

A refusal clears the mark before it prints: on a miss the page re-renders with selected, flashId and marked all null, so no outlined face survives under a sentence saying no shelf was found. The level plan itself stays drawn and unmarked.

*Because.* Refusal 3 at DIRECTION.md and the sceptic's elimination note at :185 — "a drawing asserts harder than a sentence withdraws." This is a live defect: in locate(), the stacks miss branch sets marked=null and returns without re-rendering, so the previous query's `.sel` shelf is still highlighted beneath "No mapped shelf contains …". G2.

*Caught by.* Search a hit, then search a miss; assert no element carries the selected or outline class and that #detail is back to its empty state, while #plan still contains shelves.

### MAP-5

A refusal on /map renders as a filled object in the answer's own grammar — the named refusal, the staff-code slot voided with dashes rather than removed, and the evidence line naming how many mapped ranges were checked and on which levels — never as an empty #result div.

*Because.* Binding rule 2, and the graft at DIRECTION.md:171 ("a refusal renders as a filled answer with dashes in the value slots rather than as blank space, so it can never be mistaken for a page that failed to load") and :141 ("Checked 41 mapped ranges on levels 8-10"). Today three paths write `out.innerHTML=''` or an empty string: the empty-box path, the Reference branch with an empty query, and clear(). Blank is the one shape a refusal may not take.

*Caught by.* For each miss path assert #result contains the call number, a dashed staff-code slot, and an evidence line with an integer; assert innerHTML is never empty after a submitted query.

### MAP-6

An unlocatable call number in a pull list keeps its numbered slot in the itinerary, in list order, reading "n. No mapped shelf contains ZZ 999 Q999" — it is not collected into a footer block and not reordered.

*Because.* Binding rule 3 and DIRECTION.md:117/177: "Unmapped entries keep their slot and their refusal by name, never dropped and never silently reordered." Today buildRoute() partitions want[] into located and missing and appends miss(missing) after every floor card, so an entry that failed is physically separated from the list the reader is checking against her slips — the one place she is counting. Keeping today's diagnosis sentence ("Mis-read by OCR, shelved in Reference on floor 4, or outside the mapped ranges") is required by MAP-11.

*Caught by.* Build a route from [hit, miss, hit]; assert the itinerary's ordered items are 1,2,3 with item 2 carrying the refusal text and the input's original spelling, and that no separate trailing miss block exists.

### MAP-7

Every stop row and every shelf on the plan is a real focus target with the accessible name shelfLabel() already produces (index, row, level, then each face's range, or "no ranges mapped"), and the drawing keeps exactly one aria-label for itself — the arrow-key row walk moves the mark and announces one sentence per row carrying that row's number and call-number range.

*Because.* G6, plus the /map paragraph's arrow-key walk and the acceptance test at DIRECTION.md:44 — same string for sighted and screen-reader, one aria-label per drawing, "never forty spoken R L's". The existing role="group" (not role="img") on #plan and the delegated Enter/Space handler are the mechanism that already satisfies half of this and must not be re-simplified back into role="img".

*Caught by.* Assert #plan has role="group"; assert every g.shelf with a mapped range has role=button, tabindex=0 and a non-empty aria-label containing its ranges; drive ArrowLeft/ArrowRight and assert exactly one live-region announcement per move, containing the row number and the range.

### MAP-8

Unrecorded space is drawn hollow with a dashed edge and named "not recorded" in every place it is named — legend, detail panel, and the em-dash glyph's own explanation. The words "unmapped" and "empty" do not appear as the name of that state.

*Because.* Refusal 4 and DIRECTION.md:153 ("the legend says 'not recorded', never 'empty'"), plus G5's one vocabulary for the same thing. Today the legend reads "filled = mapped · – = unmapped", the detail panel says "No ranges mapped on this level yet." and the levels bar says "not mapped" — three phrasings for one state. G4 permits the rewording; it does not permit dropping the statement.

*Caught by.* grep the rendered page for /unmapped|empty shelf/ in reader-facing strings — zero hits; assert the legend, the detail panel empty row and the level button aria-label all use the same phrase.

### MAP-9

One word per thing, across the plan, the banner, the itinerary and the level bar: a floor is a "level", a shelf position is an "index", a face is "Left"/"Right"/"Single (R)". "Floor", "bay" and "aisle" are not used as synonyms for these on this surface.

*Because.* G5. Today one page says "Level 8", "Floor 4 · Reference", "FLOOR 10" in the special-floor card, "floor 4" in the Reference sentence and the OCR miss line, and walkList prints "to aisle 7" for a thing the plan labels index 7. A reader crossing from home's "index 10" to a step that says "aisle 7" is being asked to translate mid-walk. Which noun the building itself prints on its shelf ends is out of remit (see below); that a single one is used is not.

*Caught by.* A vocabulary test over the rendered strings: the set of words used for floor/index/face is a singleton each, and matches the set used by index.html's answer line.

### MAP-10

The walk's per-stop wording stays absolute — compass direction, index, face letter, row — and states no step count off a door, no turn, and nothing about which way the reader is facing. The anchor phrasing is "Start at the level N landing" where the landing is a verified fixed feature.

*Because.* Refusal 1: routes are refused, "and therefore no 'on your left'", with the walking cue surviving only in reduced form plus that anchor phrasing. Today's walkList is already deliberately absolute ("East and west are the arrow, north and south are the row") and already declines to count off a door — that discipline is the thing to preserve, not to re-derive. The aisle-to-aisle shelf counts it does print are the open question; see silences.

*Caught by.* grep the itinerary output for /left|right of you|turn|facing|ahead/ used as directions — zero hits. "Right" as a face name is exempt and must be matched as the face token.

### MAP-11

The five pinned claims that live on this page today survive the port with their signatures intact, whatever the layout becomes: the skip link, aria-live="polite" on the result region, "in your browser" on the OCR notice, "surveyed by hand", and "Not affiliated with, or endorsed by, the UCLA Library".

*Because.* G4, mechanically. Tools/pins.test.js searches the whole app and fails only on a claim found nowhere, so a rewrite that drops the OCR privacy line or the footer disclaimer from /map passes only if another page still carries it — which is not the same as this page being honest. Rewording is permitted; deletion is not.

*Caught by.* node Tools/pins.test.js --where, asserting map.html still appears for those five ids.

### MAP-12

The per-floor walk maps are the same drawing at the same scale, generated by the same planShelves()/planFeatures() as the whole-level plan — never a second picture type, never a route line drawn through the aisles.

*Because.* Refusal 5 (one drawing, no second style) and refusal 6 (no decorative plan detail). The existing code already made this decision and wrote down why the route line was removed — an aisle is a twelve-pixel gap and every device for separating the legs added ink to a picture already too busy. That reasoning must survive the port, because "add an arrow so people can follow it" is the first thing a redesign proposes.

*Caught by.* Assert the walk map SVG and the plan SVG share a generator and a viewBox width; assert no path/polyline/marker elements exist in the walk map.

## Must survive the port

Read off the working page. These are what a rewrite deletes without noticing.

- **The Reference (floor 4) honesty branch: cnShaped() gating, and the conditional answer "<CN> is inside a mapped stacks range on level N. If that is the copy you want, switch to Main stacks for the shelf."** — This branch has no shelf data under it. Before it existed the page asserted floor 4 for any string at all — it put "NOT A CALL NUMBER AT ALL" on floor 4, and put W1 AM4990 there when its own data places it on level 7. It is the only place on this surface where an answer with no lookup behind it is refused. Pure G2, and invisible to anyone editing for appearance.
- **Level 9 (Special Collections) is excluded from routeLocate() — the `if(key.charAt(0)==='9' && key.charAt(1)==='|') continue;` guard.** — Level 9's seventeen faces run A to ZWZ 330 and therefore contain almost every call number in the building. Without the guard every book whose real home was level 10 or 11 routed to level 9 — 98 of 436 mapped faces, both floors entire — and it looked like an OCR failure because only the floor was wrong. A rewrite that re-derives routing from DATA will reintroduce this silently.
- **The truck rule: over five books, the stairs stop being an option and every floor change is the elevator, stated in the itinerary summary as "Over five books, so it is a truck trip: elevator between every floor", plus the route-hint that says it before you build.** — It is a load constraint, not a distance cost, which is why it overrides the routing maths instead of being folded into it. Fold it in as a weight and the planner will cheerfully route nine books down a stairwell.
- **"Text recognition runs in your browser and is imperfect, especially on handwriting. Check the list before building."** — Two claims in one sentence: a pinned privacy claim (photos are processed locally) and a scope claim (the machine reading is not trusted, the human is the check). It is the sentence that makes the editable textarea make sense rather than look like a formality.
- **The itin-miss diagnosis: "Mis-read by OCR, shelved in Reference on floor 4, or outside the mapped ranges. Fix the spelling above and rebuild."** — It names the three real causes in the order of likelihood and tells the reader the one action that helps. A generic "not found" here turns a fixable typo into an abandoned trip. MAP-6 moves it into each entry's slot; it does not shorten it.
- **The serial caveat printed under a multi-hit lookup: "N shelves match. For serials, check the volume and year on the spine."** — It is the ambiguity disclosure required by refusal 8, in today's wording. The direction says the caveat outranks the picture when the fold is tight.
- **The empty-state text on a special floor: "Reference is shelved by call number on floor 4. There is no per-shelf map.", and the matching suppression of both the legend and the tap-a-shelf invitation on those floors.** — The invitation used to point at a control that is not on the screen, and the legend named colours for shelves not being drawn. `hidden` does not work for the legend because `.legend{display:flex}` outranks the browser's [hidden] rule — a note worth carrying, since the fix looks redundant.
- **shelfLabel(): one accessible name per shelf, reading index, row, level, then each mapped face and its range, or "no ranges mapped".** — The ranges are the answer for a reader not using the drawing; a position on a picture is no answer at all if the picture is not what you are using. This is also what keeps #plan at role="group" rather than role="img", which had made every shelf presentational.
- **The levels bar as real <button> elements with aria-pressed and aria-label "Level 8 · 41 shelf faces mapped" / "· not mapped", and the delegated Enter/Space handler on #plan.** — These were plain divs with onclick — the entire floor selector was unreachable without a mouse. G6, and the kind of thing a markup rewrite loses in one line.
- **The section pills scoped by `#sect .pill` with aria-pressed, not by `.pill` alone.** — `.pill` is a shared look across the catalog scope pills, the article year pills and the hours day strip. Selecting all of them meant picking a floor quietly un-highlighted "Keyword" and "today" in panels nobody had touched. G5's shared vocabulary is exactly what makes this trap available.
- **The route toggle's aria-expanded being updated when the body opens or closes.** — It was the one disclosure of four whose state only a sighted reader could see.
- **extractCallNumber() on paste — accepting a whole Primo record and lifting the call number, including the Hist. Div. form which also switches to Special Collections — and the typed "Hist Div …" prefix handling in locate().** — It is the actual behaviour of the actual user: they copy the whole holdings line. Removing it turns every paste into a no-match.
- **The non-blocking web-font loading: preload as=style, media="print" + onload swap, the two woff2 preloads, and the noscript fallback.** — The blocking sheet cost 803 ms of a 3.5 s first paint on a page whose HTML arrives in 50 ms, and the late reflow moved the shelf map down the page — 0.375 of layout shift. G1, and it will read as removable cleverness to anyone tidying the head.
- **The pinned CDN versions with subresource-integrity hashes for tesseract.js and heic2any, and the offline error text that tells the reader they can still type call numbers.** — `@5` was a moving target running with the run of the document. The error text keeps a failed library from being a dead end.
- **The order-as-colour ramp being redundant with the numbered badges, stated as a rule: colour gives the shape of the walk, the badge is exact, neither is load-bearing alone.** — Colour-blind readers keep the badges and a photocopy keeps the numbers. Any "simplify the itinerary" pass will propose dropping one of the two.
- **The lvl-total line: "453 Biomed shelf faces mapped", placed beside the per-floor counts it is the sum of.** — It is a scope statement — the size of the hand survey — and it belongs next to its parts, not in a masthead for a tool that also searches 21 libraries.

## New claims, to be pinned before the page is written

- The evidence line on a /map refusal: 'Checked 41 mapped ranges on levels 8-10' — new to this surface, and a G2 claim that a rewrite would drop as decoration. Pin the fragment 'mapped ranges on levels'.
- The in-slot route refusal, 'No mapped shelf contains ZZ 999 Q999', now rendered inside the numbered itinerary rather than in a trailing block. Pin 'No mapped shelf contains' if it is not already carried by index.html's wording of the same refusal — check for a signature collision before adding.
- 'not recorded' as the single name for unrecorded space, replacing today's 'unmapped' / 'not mapped' / 'No ranges mapped on this level yet.' The G4 obligation is to update the pin signature to the new wording, not to leave the old one failing.
- The Reference conditional answer, 'is inside a mapped stacks range on level', which today exists only in map.html and is pinned nowhere. It is the sentence that stops this page asserting floor 4 for a number its own data places elsewhere, and it is the single most deletable line on the surface.
- The anchor phrasing 'Start at the level N landing' for the walk's first move, if adopted — it replaces a door name with a verified fixed feature and is therefore load-bearing for refusal 1.

## Out of remit (G7): a person decides

- What colour the arrival mark and the persistent outline are, in light and dark; the only constraint the panel may impose is that the mark is distinguishable without relying on hue alone (DIRECTION.md:223).
- How the mark is rendered — solid fill, hatch, outline, or a combination — and how it reads against the hollow/dashed 'not recorded' convention. A legibility test on a coarse pointer in stack lighting, which nobody has run.
- The exact hues of the order ramp in the itinerary, and whether four anchors is right. The panel may only require that order is encoded twice and that white badge text stays legible at every position.
- Typeface for the staff code in the arrival banner (monospaced or tabular). Ruled only that it stays at equal type size to the sentence; the face is taste, and must be system-stack — no web font may block paint.
- Which physical features on each level count as 'verified fixed' landmarks and what each is called in the reader's words. This is a walk-the-building decision by library staff; the landmark clause on this surface is empty without it, and the surface must render correctly with it absent.
- The verification interval for spine ranges and per-zone dates, and who owns re-survey after a shift. The software suppresses stale data automatically; the cadence and the owner are staffing decisions.
- Transition duration and easing for the home-to-/map zoom, inside the fixed constraint that reduced-motion is an instant swap.
- Whether the building itself calls an index position a bay, an aisle or a range — i.e. which noun MAP-9 collapses to. The rule that there is exactly one is the panel's; which word it is comes off the shelf ends.
- Page title and whether /map keeps its name.
- Wording review of every refusal, caveat and scope sentence introduced here — the evidence line, the in-slot route refusal, the 'not recorded' legend — by whoever wrote the originals. G4 permits rewording; it does not permit a second voice.

## Silences in the direction, raised not filled

- The direction's /map paragraph does not mention the pickup-walk planner at all. The planner reaches this brief only through grafts (DIRECTION.md:117 and :177, from Route Of One and The Queue Is The Unit) and through binding rule 3. So the walk's ownership of this surface — whether it stays a collapsed disclosure below the fold, as today, or is a peer of the lookup — is not settled by the frozen text. I have not settled it either. Note that DIRECTION.md:248 treats the pull list becoming the dominant task as a trigger to re-run the direction, so this is a live question, not an oversight to paper over.
- Refusal 1 refuses step counts, and today's walkList prints '→ 3 shelves to aisle 7' for every move after the first. It is arguably not a route claim — it is aisle-to-aisle, absolute, and falsifiable against the drawing in front of the reader — and it is arguably exactly the 'walk into the stacks and count ten rows' that killed spatial-1. The direction grafts 'the walking delta as vocabulary between consecutive stops — same aisle, four bays further' at :177 and refuses step counts at :191, in the same document. I am not resolving that. Whoever does should note that the existing counts are already careful about the one case the refusal names: a move off a door lands on a half shelf and is stated as a direction with no count.
- The direction says the drawing never appears without a mark, but /map's zoom-out exists before any query is made and is also the browse index ('what is on level 8, where does the K run end'). Whether an unqueried level plan counts as a drawing without a mark is not addressed. I read it as permitted — the rule's stated reason is that a blank plan 'asserts a place nobody looked up', and a browse plan asserts nothing about a query — but the direction does not say so, and MAP-4 depends on that reading.
- How many instances of the one drawing may appear on a single surface. Today /map renders the big plan plus one small walk map per floor in the route, i.e. up to ten. 'One drawing, two zooms' is a rule about kinds, not counts, and the direction never says whether a stack of small same-drawings is one drawing repeated or a second picture type. MAP-12 assumes the former.
- What the arrival banner does when the reader then taps a different shelf on the plan, or arrows to another row. The mark is meant to be persistent; the banner repeats a specific answer. Whether the banner is dismissed, replaced, or held while the mark moves is not addressed anywhere in the frozen text.
- Whether /map's own lookup box is the same polymorphic field as home's (title, twelve numbers, a photo) or stays the narrow call-number-only box it is today. DIRECTION.md:111 says 'the one field stays polymorphic' about the product; the /map paragraph says /map adds only levels, the arrow walk and the reference index. Those two do not obviously agree, and the code comment on locate() says this box asks exactly one question because here the answer is always a shelf.
- Refusal 3 says a refusal clears the canvas. On /map the canvas is the surface. MAP-4 clears the mark and keeps the level plan, which is the only reading that leaves a browsable page, but the direction does not distinguish 'the drawing' from 'the mark on it' at this zoom.

