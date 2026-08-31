# Brief: /about

Written from the frozen direction in `ops/DIRECTION.md`. Rulings are numbered so a code
comment can cite one six weeks from now by somebody arguing with it.

**The job.** Hold the permanently reachable, findable-by-looking version of everything the answer line's pressable terms open in place — the shelf vocabulary, what index counts from, one worked example from slip to shelf — plus the product's scope, privacy and provenance statements, on the one surface where reading rather than locating is the task.

**The reader.** Two readers arrive here at the same stage of the same task, not from two audiences. One has an answer on screen, pressed "index", read one sentence and still wants the account of how bays are counted and what the tool will and will not claim; she came by looking, not by knowing the word "explainer". The other is deciding whether to trust the tool at all before walking someone into the stacks, and is checking who made it, what was surveyed, what leaves the browser and what the counts cover. Failure is: she reads the whole page and still cannot say what "index 10" is counted from, or she cannot find the scope sentence that tells her a Powell copy will never resolve to a shelf, or she leaves believing the tool will tell her which way to turn. Second failure mode, quieter: a rewrite trims the page for elegance and the caveats go with it, so nothing here contradicts a confident wrong answer any more.

## Rulings

### ABOUT-1

This surface renders no floor drawing. The worked example is prose.

*Amended (Stage 02b, after re-audit).* The ruling previously granted conditional permission —
"unless the drawing is produced by the same code path and the same recorded geometry as a live
lookup and carries a mark" — where the other five non-answer surfaces refuse outright. Two things
are wrong with it. It relaxes a binding rule from inside one surface's brief, which is the move
ABOUT-11 correctly refused to make on a smaller question. And it makes the drawing's presence
contingent on an engineering fact no brief establishes, so `/about` could carry a drawing or not
and neither outcome would violate the ruling: a rule that cannot be broken is not a rule. A worked
example on an explainer is not a lookup, and the direction says the drawing is generated from the
geometry the lookup already used.

*Because.* Binding rules 1, 2 and 4 (the drawing never appears without a mark, never draws what it did not look up) and G2. A hand-drawn illustrative plan on the explainer is a second drawing style and a picture of a place nobody looked up — refusals 4 and 5 of the direction.

*Caught by.* Assert about.html contains no inline <svg> whose shapes are literal markup rather than emitted by the shared drawing function, and no <img> of a floor plan. A path element with hardcoded coordinates in about.html fails.

### ABOUT-2

Every term the home answer line makes pressable has exactly one anchored section here, and the single sentence the pressable term opens is that section's first sentence. All three renderings of a term — home's expansion, this section's first sentence, and /methodology's paragraph — are generated from one constant per term, held in one file. Nothing is retyped anywhere.

*Provisionally amended (Stage 02b), reversible by the owner.* ABOUT-2 and METH-1 each claimed sole ownership of the definitive string, so "index" acquired a home expansion, an /about first sentence and a /methodology paragraph with two briefs each asserting theirs was the single one. The default taken here: **/methodology owns the term paragraph**, because DIRECTION line 42 sends key terms there explicitly; /about quotes it and home's expansion quotes it. The /about ÷ /methodology boundary as a whole is escalation E-3 and the owner may reverse the direction of the quotation without disturbing the mechanism. "Character for character" is dropped as the *rule* and kept as the *consequence*: with one generating constant it is automatic, and without one it was enforceable only by a human diffing two hand-written pages — which is exactly the drift it existed to prevent.

*Because.* G5 (one vocabulary for the same thing) and layer 6/7 of the seven layers: the pressable expansion is the in-place version and this page is 'the permanently reachable version' of it. Two wordings of 'index' is two products.

*Caught by.* Assert home's expansion, this page's section opening and /methodology's paragraph
all resolve to the same per-term constant, by identity rather than by string comparison between
hand-written pages. A term whose three renderings do not share a source fails, and so does a term
with no constant.

*Corrected after re-audit.* The amendment declared /methodology the owner while this test still
asserted the expansion appears "in about.html", and the ruling body still read "exactly one
anchored section **here**". An implementer reading top-down would have built the rule the
amendment overturned. The ruling body above now says where the string comes from; this test now
checks the mechanism rather than a literal prefix in one file.

### ABOUT-3

The worked example runs one real call number from slip to shelf in the answer's own word order and staff-code form, and is followed by one worked refusal in the refusal grammar (named call number, staff-code slots voided with dashes, evidence line) — never a success example alone.

*Because.* G4 and binding rule 2/3: the refusal is part of the answer shape, not an edge case. An explainer that demonstrates only success teaches a grammar the reader will not recognise the first time the tool declines.

*Caught by.* Assert the example block contains both a four-value coordinate line and a dashed staff-code line plus an evidence sentence of the form 'Checked N mapped ranges'.

### ABOUT-4

The definition of 'index' states what it is counted from and what physical label the reader can check it against, and states it without any route language — no step counts, no turning, no facing, no 'on your left'.

*Because.* Direction refusal 1 (it refuses routes), the ruling that killed spatial-1. This page is the likeliest place for a route to leak back in, because prose invites walking instructions.

*Caught by.* Grep the page for 'walk', 'turn', 'left', 'right as you', 'steps', 'count N rows from' outside quoted answer output; any hit is reviewed as a route claim.

### ABOUT-5

No coordinate on this page is written by hand: every level, row, index, side and range printed as an example is regenerated from the recorded geometry, and an example that no longer resolves fails `ops/test` rather than printing.

*Amended (Stage 02b).* "Fails the build" named machinery that does not exist in a product whose hard constraints state there is no build step. As with METH-1, none was ever needed: this ruling's own *Caught by* is a suite assertion that resolves every call-number literal on the page through shelf-core. The rule is unchanged; only its enforcement story is now true.

*Because.* G2 — no surface asserts a location it did not look up — applies to illustrations as hard as to answers. A stale worked example is a fluent wrong aisle with a teaching voice.

*Caught by.* A test resolves every call number literal in about.html through shelf-core and asserts the printed coordinate matches; unresolvable or mismatched fails.

### ABOUT-6

Legend and vocabulary entries never identify a thing by colour name alone; each names its shape or fill convention as well (double-sided shelf column, bottom row, unsurveyed face drawn hollow with a dashed edge and labelled 'not recorded').

*Because.* G6, and the one constraint G7 permits the panel to impose: the mark must be distinguishable without relying on hue alone. Today's page says 'Each green column…' and 'Black is the bottom row', which is hue-only and untranslatable to a screen reader or a monochrome print of a crop. What the colours actually are stays out of remit.

*Caught by.* Assert every legend row contains a non-colour discriminator; a row whose only discriminator is a colour word fails.

### ABOUT-7

Every count on this page names the set it counts and where that count can be checked, and a count that cannot be derived from live data or the shelf survey is restated as a scope sentence without a number rather than rounded or estimated.

*Because.* G2 and the direction's coverage-honesty trade ('the product will look patchier than a product that simply asserted'). A bare '1,360' is an assertion about a feed that changes daily.

*Caught by.* Assert each numeral in the prose is adjacent to a noun phrase naming the counted set, and that feed-derived counts are emitted from the same data the /databases page renders.

### ABOUT-8

The page is one column of ordinary prose with headed sections, everything open on load: no tabs, no accordions, no progressive disclosure, no basic/advanced or newcomer/staff split.

*Because.* G3 as the owner wrote it — density follows the task, not the person; segregating by audience fails it and so does averaging. Here the task is reading, so the whole text is present and findable with browser find. It is also the only way the page survives being reached by a link that jumps straight to an anchor.

*Caught by.* Assert no [hidden], details/summary, aria-expanded or role=tab in the main prose region, and that every anchor target is visible without a click.

### ABOUT-9

Where a term is defined here and also carries an anchored paragraph in /methodology, this page gives the sentence and links the term out to that anchor; it never carries a third, longer definition of its own.

*Because.* Graft from declarative-2 (legend words and refusal key terms link to their own anchored paragraph in /methodology) and G5. Two prose surfaces drifting apart is exactly how one vocabulary becomes two.

*Caught by.* Assert every term with a /methodology anchor is linked from its first occurrence here, and that the section body does not restate the methodology paragraph.

### ABOUT-10

The privacy and provenance block stays a positive, block-level object at a fixed position on the page — no account, no analytics, no cookies, where typed text goes, OCR local, photos never uploaded, not affiliated with the UCLA Library — rewordable, never removable, never demoted to a footnote or a link.

*Because.* G4, and four pinned claims live in it (not-affiliated-with-ucla, ocr-runs-in-the-browser, photos-are-never-uploaded, plus the no-accounts statement). Tools/pins.test.js names about.html as home for three of the thirty.

*Caught by.* Tools/pins.test.js already fails on deletion of the signatures; add an assertion that they sit in a block element in the main flow rather than inside the footer's byline.

### ABOUT-11

This page carries the same one nav and the same one footer as every other surface, byte-identical, in tab order, below the h1; whether /about itself becomes a member of the nav link set is one decision taken once for all seven surfaces and not made on this page.

*Because.* G5 (one nav, one footer) and refusal 10 (nav demoted, never removed). Today /about is reachable only from the footer and from inline links, which is a site-wide membership question the direction does not settle.

*Caught by.* Tools/cohesion.test.js compares the nav and footer fragments across all seven pages for equality.

### ABOUT-12

The skip link and its destination survive with a destination-naming label, and every section that a pressable term or a refusal links into has a stable id that is never renamed in a redesign.

*Because.* G6 (keyboard and screen reader first-class) and the pinned skip-link claim; an id rename silently breaks every in-place expansion's 'more about this' link and the /methodology cross-links, with nothing turning red.

*Caught by.* cohesion asserts a class="skip" on all seven pages; add a test that every anchor referenced from index.html and methodology.html exists as an id in about.html.

## Must survive the port

Read off the working page. These are what a rewrite deletes without noticing.

- **Footer byline: "Built by Phineas Fritsch. Not affiliated with, or endorsed by, the UCLA Library."** — Pinned (not-affiliated-with-ucla, home about.html). It is the sentence that says this is one person's hand survey rather than the library speaking, and it is what lets a reader weigh everything else on the page.
- **"Photographs are read in your own browser using optical character recognition, and the images are never uploaded anywhere."** — Carries two pins at once (ocr-runs-in-the-browser: 'in your browser'; photos-are-never-uploaded: 'never uploaded'). about.html is the stated home of both. A rewrite that says 'photos are processed automatically' passes every other test and destroys both.
- **The closing note block: "Nothing here needs an account. No sign-in, no analytics, no cookies. What you type is sent to UCLA's public endpoints to answer the search, and nowhere else."** — The only place in the product that states the whole data posture positively, including the 'and nowhere else'. It is also the hard constraint the port must not quietly violate.
- **"Only copies in the Biomed stacks resolve to a shelf you can walk to. A copy at Powell or YRL is reported as being there and nothing more, because this site has no survey of those buildings."** — The scope statement that stops a reader expecting a shelf for every UCLA holding. G2 in prose form, and the explanation behind refusals the reader will meet on home.
- **"Where a range start equals its end, many volumes share one call number, so every matching shelf is returned and you check the spine."** — The serial-run caveat, which the direction ranks above the crop under fold pressure. This is its explanatory home; delete it here and the caveat on home has no account behind it.
- **"A dash means a face nobody has surveyed yet."** — An empty state that explains itself. Without it a dash reads as a rendering fault rather than as recorded absence — the same failure the direction's blank-space rule exists to prevent.
- **"...then each Cutter as a decimal, which is why AM4733 sorts before AM477. Cutters being decimals rather than whole numbers is the part that catches people out, including people who have shelved for years."** — The one worked, falsifiable micro-example already on the page, and the only place the sort rule is explained. It is also the sentence that earns the reader's trust in the locator's arithmetic.
- **"Type a call number as printed. Spaces and the Cutter dot are optional... A W1 number needs the space after W1." and the Hist Div prefix sentence.** — Input tolerances and the one exception. Nothing else documents them; a reader who fails on 'W1JO600' has no other way to learn why.
- **"Any correction it makes is named on screen rather than applied quietly, which matters because a silent correction can send you looking for a book that was never the one you wanted."** — The stated rationale for the whole named-guess mechanic, and the sibling of the pinned routing claims on home. It is a reason, not a feature description, and reasons are what rewrites cut first.
- **"The alternative would be a tool that guesses wrong and says nothing about it, which is a worse failure than simply asking you which you meant."** — The explainer's statement of the product's central argument (the 'wrong aisle is worse than none' pin lives in index.html; this is its account). Losing it leaves every refusal on the site looking like a bug.
- **"Check those years before you walk someone over to a shelf. A provider can carry a journal without carrying the issue you need."** — A caveat aimed at exactly the expensive failure — a confident answer that ends at the wrong place. It is addressed to desk staff mid-task and reads as ornament to anyone editing for length.
- **The databases absence paragraph: "It carries no descriptions... this list leaves out a description column that would have been empty on all 1,360 rows," plus the pointer to the library's own A to Z for blurbs.** — A missing feature explained as a governed absence rather than hidden. Same family as 'not recorded' — a rewrite deletes it as an apology and the gap becomes an unexplained hole.
- **"A database marked no login should open straight away. Everything else will ask you to sign in, whether you are on campus or off."** — Sets the reader's expectation about a third party's behaviour honestly, including the off-campus case. Nothing else states it.
- **"The map belongs to UCLA and is reproduced here so that it opens in one tap instead of three."** — Attribution plus the reason for the copy, in one sentence. Removing the sentence turns a credited reproduction into an uncredited one.
- **Reference on floor 4, Special Collections on floor 9, and the instruction to switch the map pill to search either.** — The only documentation of collections the default search deliberately does not cover — a scope statement disguised as a how-to.
- **"Results are scoped to whichever library you say you are working at, and they widen to the rest of UCLA only when yours turns up nothing."** — Explains why a search can return fewer results than the reader expects. Without it a narrowed answer is indistinguishable from a gap in the collection — the exact failure the catalog-scope-is-named pin guards on home.
- **The skip link (class="skip", "Skip to the guide"), nav aria-label="Sections", lang="en", the h1/h2/h3 hierarchy, and the canonical URL.** — Pinned (skip-link-exists) and asserted across all seven pages by Tools/cohesion.test.js. Nothing about the page looks different when they go, which is why they need naming.
- **"Filtering happens in your browser against the list already on screen, so it answers as you type and costs nothing."** — States where computation happens, which is both a privacy fact and a performance promise the reader can hold the product to.
- **SUPERSEDED (Stage 02b) — "Any shelf shown in a catalog result is a link. Click it and the map opens on that floor with the shelf already lit."** — The only prose description of the home-to-/map crossing. The zoom sentence on the new-claims list **replaces** it: what must survive is the *claim* that a shelf in a catalog result is a link and that following it lands on the lit shelf, not this wording. Two further reasons it cannot be preserved verbatim: it says "that floor" where SHARED-6 requires "level" for a stacks level, and the crossing is now a change of frame rather than a page that opens. The pin signature is updated deliberately, in the same commit as the string, per G4 and SHARED-10 — which is the whole difference between a rewrite and a regression.

## New claims, to be pinned before the page is written

- The worked refusal on the explainer: a named call number, staff-code slots voided with dashes, and an evidence line of the form 'Checked 41 mapped ranges on levels 8-10', appearing off the home path for the first time.
- The statement of what index counts from. Today's page never defines 'index' at all; this is a new sentence and it is the one the pressable term will mirror.
- The explicit no-routes sentence in the explainer's own voice: that the tool names a place and never a way to walk to it, and never claims which way the reader is facing.
- The partial-knowledge caption in its exact form — 'the level, row and side above are looked up; the ranges below are not' — appearing here as vocabulary rather than only under a crop.
- The 'not recorded' convention stated in words: unmapped space is drawn hollow with a dashed edge and is labelled not recorded, never empty. Today's page says only 'a dash means a face nobody has surveyed yet'.
- The zoom sentence replacing 'the map opens on that floor with the shelf already lit': that crossing to the map changes the frame and nothing else, and the marked shelf stays under the same point on screen.
- The staff-code vocabulary ('L10 - R10 - Right - top' read as level, index, side, row) explained in prose for the first time.

## Out of remit (G7): a person decides

- Palette and contrast, including what colour the mark is and what colours the legend describes. ABOUT-6 constrains the wording to be usable without hue; it does not choose the hues.
- Typeface, and whether the staff code is set in a monospaced or tabular face. System stack only, no blocking web font — that is a hard constraint, not a taste ruling. Note that this page currently loads Fraunces and Spline Sans Mono from Google Fonts; whether the print-media-swap loading trick survives is a performance decision for whoever owns the 803 ms measurement, not a design ruling made here.
- How the mark is rendered — solid, hatch, outline — and how it reads against the hollow/dashed convention, if a drawing ever appears here.
- The visible affordance for pressable terms, wherever this page mirrors them.
- Whether this surface keeps the name /about or becomes /explainer, and whether the h1 stays 'How to use Shelfmark'. Listed out of remit in the direction.
- Wording review of every refusal, caveat and scope sentence, including the new ones this brief introduces, by whoever wrote the originals. G4 permits rewording; it does not permit me to do it.
- Which physical features on each level count as verified fixed landmarks and what the reader calls them — a walk-the-building decision by staff. The explainer cannot define the landmark vocabulary before that exists.
- The verification interval and re-survey ownership, which this page must state but may not set.
- Brand, logo, favicon, page titles, and the og-card.
- Whether /about joins the primary nav link set — a site-wide decision, deliberately not taken on this page.

## Silences in the direction, raised not filled

- The direction's surface list describes /explainer as three things — shelf vocabulary, what index counts from, one worked example from slip to shelf — and is silent on the roughly four-fifths of today's page that documents the one box, books and spelling repair, filter syntax, articles and access states, the databases feed, hours and the campus map, and pickup walks. It does not say whether that material stays here, moves to /methodology, or is dropped. This brief assumes it stays (G4 forbids removing its caveats, and no other surface is nominated to hold them) and flags the assumption rather than ruling on it.
- Whether the explainer may render the floor drawing at all is not stated. The direction says there is one drawing in the product, generated inline from the geometry the lookup already used; it does not say whether a worked example counts as a lookup. ABOUT-1 rules only on the conditions if it does draw; the yes/no belongs to whoever owns the drawing code.
- The boundary between /about and /methodology is not drawn. Both are described as prose, both hold per-term explanation, and /methodology is described as anchored paragraphs linked from every legend word and refusal key term — which is also what this page's vocabulary section is. Where 'what index counts from' lives, and whether it lives in both, is undecided.
- The direction does not say whether the explainer's own prose carries pressable terms, or only plain headed sections. ABOUT-8 rules the page is open on load, which forecloses accordions but not the question of whether terms here are buttons.
- How a reader arrives is unspecified. The direction says the explainer is 'reachable by looking, not by naming', but does not say from where: the pressable expansion, the crop legend, the refusal, the nav, the footer, or all of them. ABOUT-11 refuses to settle nav membership on one page.
- Section order on this page is not ruled anywhere, including whether the worked example leads or trails, and whether the vocabulary precedes it. The seven-layer order governs an answer, not an essay.
- The direction requires a paper-crop walkthrough with real newcomers before anything is built, and is silent on whether this page is where a printable crop or a printable vocabulary sheet would live.
- OCR line narration and the read-line-versus-typed-line hollow/solid convention are grafted from declarative-4, but no surface is named as their documentation home. Today's page documents OCR in two sentences; the new narration grammar has no stated explainer.
- Whether the page's title and heading stay 'How to use Shelfmark' when the direction calls the surface an explainer is not addressed; naming is listed out of remit.

