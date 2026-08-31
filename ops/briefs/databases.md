# Brief: /databases

Written from the frozen direction in `ops/DIRECTION.md`. Rulings are numbered so a code
comment can cite one six weeks from now by somebody arguing with it.

**The job.** List every database UCLA licenses or links to, say plainly that this is a list and not a search, and let a reader reach any single entry — by name, by filter, or by walking — without leaving the page or being told a location the product did not look up.

**The reader.** Someone who already knows roughly what they want ("PubMed", "psyc…", "something open to anyone") and needs the link plus one access fact. Failing looks like: typing a full official title and getting the empty state because the feed's name differs; being told "1,360 databases" and having no way to reach item 400 with a keyboard; or reading the page as a search box, typing a topic, getting nothing, and concluding the tool is broken. The last is the failure the scope sentence exists to prevent — this page indexes names, and nothing else about a database.

## Rulings

### DB-1

The scope sentence "Listed, not searched." renders as a standing sentence in the list header, above the filter control and present before the fetch resolves — never inside the empty state, never only after a failed filter.

*Because.* DIRECTION line 70 requires it in the same voice as the shelf refusals; G2 forbids the page implying a capability (topic search) it does not have. Shown only on failure, it reads as an excuse rather than a scope, and the reader who typed a topic has already lost their time.

*Caught by.* Assert the string is present in the served HTML of databases.html (not injected by script), and that its position in the document precedes #dbQ.

### DB-2

No drawing, crop or shelf geometry of any kind appears on this surface.

*Amended (Stage 02b).* This previously also banned any "map link", which read literally deleted the Map entry from the one shared header nav that this brief's own must-survive list and refusal 10 both require on every surface. The shared nav is not this brief's to touch; the ban is narrowed to drawings, crops and geometry, which is what it was for.

*Because.* Binding rule 2 — the drawing never appears without a mark — and G2. This page holds names and URLs, no shelf geometry; any plan drawn here would assert a place nobody looked up. It is also the direction's own rule that a picture of nothing is a lie (graft from subtract-2, line ~around the grafts list).

*Caught by.* Assert databases.html contains no <svg> other than the brand mark in the shared header, and does not load shelf-core.js or shelf-data.js.

### DB-3

Every row is a single focusable stop that announces name, position and total in one string, in the product's list grammar — "PubMed, best bet, no login, item 3 of 60 shown, 1,360 found" — one announcement per row, never one per tag.

*Because.* DIRECTION line 70 ("walkable, each item focusable, position announced"), line 135 ("one grammar for rows, records and stops"), and G6. Line 137 records that the list grammar exists specifically to answer "27 records, no way to reach record 2"; today reaching item 400 requires clicking "Show 60 more" six times with a mouse.

*Caught by.* Keyboard-walk the rendered list and assert each stop's accessible name matches /item \d+ of \d+ shown, [\d,]+ found/ and that tags contribute no separate stop.

### DB-4

The counted status line stays a role="status" aria-live="polite" region carrying the same string a sighted reader sees, and it always names both numbers it is comparing: unfiltered, "1,360 databases, N of them needing a UCLA login"; filtered, "N of 1,360 databases".

*Because.* Binding under G2 and the pinned 'result-is-a-live-region' property; DIRECTION line 159 requires one string that is both visible text and live region. A bare count with no denominator is a statistic that does not name what it covers, and after a filter it is indistinguishable from a broken list.

*Caught by.* Assert #dbStatus keeps role="status" and aria-live="polite"; assert the filtered string contains " of " and the unfiltered string contains both totals.

### DB-5

An upstream that answers with an empty or unusable list is a failure, not a result: it renders the named refusal ("Could not reach the database list: … The A to Z page itself is at library.ucla.edu."), not the zero-match empty state.

*Because.* G4 and the pinned claim databases-failure-points-elsewhere ('Could not reach the database list'); binding rule 2's principle that a refusal is a positive named object, not blank space. Today's `if(!items.length) throw new Error('the list came back empty')` is the behaviour being protected; a rewrite that renders an empty list instead would tell the reader UCLA licenses nothing.

*Caught by.* Stub /api/databases with {items:[]} and assert the refusal string renders and the zero-match copy does not.

### DB-6

The refusal names which upstream failed and where to go instead, in the same shape as /hours and home; it never renders as generic error styling, a colour alone, or a retry that fires silently.

*Because.* G5 (one grammar for failure), DIRECTION line 147 ("one fixed grammar of failure across all seven surfaces … /databases saying 'Listed, not searched'"), line 159 ("no silent retries: a second attempt is a second line"). The worker's own 502 is pinned separately (databases-worker-failure) and must keep saying "the database list did not respond" so the two do not disagree.

*Caught by.* pins.test.js already fails on deletion of either signature; additionally assert no automatic re-fetch occurs after a failed load.

### DB-7

No field is invented for a row. The feed carries a name, a URL, an auth flag and a best-bet flag; the page prints exactly those and prints no empty description line, placeholder, subject tag, or blurb.

*Because.* G2. The head comment records that all 1,365 description divs come back empty. A redesign reaching for visual richness will add a description slot and fill it with something — the moment it does, the page asserts editorial content nobody wrote.

*Caught by.* Assert the row template references only name, url, best and auth; assert no row renders a child element that is empty of text.

### DB-8

Filtering stays local and substring-on-name, keystroke-debounced, with no network request per keystroke; the list is fetched once on arrival because arriving at this page is the request.

*Because.* G1 and the hard constraints (one narrow Worker, day-long cache). Making the filter a request would put a round trip between a keystroke and a name, and would defeat the worker's cache for no gain. Also the reason the local four-line safeHref exists instead of pulling 48 KB of shelf-core.js — that trade must survive.

*Caught by.* Assert exactly one fetch to /api/databases across load plus twenty simulated keystrokes; assert databases.html does not link shelf-core.js.

### DB-9

Because this page genuinely waits on an upstream, a waiting line is permitted here and must resolve out loud ("Asking LibGuides…" → a count or the named refusal); it may never be copied to a surface that does not wait.

*Because.* DIRECTION line 159 bars a ledger on the fast path — "no spinner, skeleton or waiting line ever renders for a lookup that does not wait". That bar is about the answer path, not this one; stating the boundary here stops a porter deleting the skeleton on the wrong reading, and stops a porter exporting it to home on the wrong reading.

*Caught by.* Assert the pending string is written into the same #dbStatus live region as the resolved string, and that it is always replaced by either a count or a refusal.

### DB-10

"best bet" and "no login" are the product's words for those two facts and appear nowhere else under different names; the absence of a login requirement is what is marked, and the presence of one is not.

*Because.* G5 (one vocabulary for the same thing). "Open to anyone", "best bets only" and the two badges must agree with each other and with the checkbox labels — three names for one fact is how the same list stops looking like one product.

*Caught by.* Cross-file grep: assert no surface introduces a synonym ("free", "recommended", "featured", "public access") for these two flags.

### DB-11

Clear resets the query and both checkboxes together, returns focus to the filter input, and announces the restored count; the reveal control keeps a full sentence as its accessible name ("Show 60 more of 1,360"), never a bare "More".

*Because.* G6 and G1. Focus that lands nowhere after Clear costs a keyboard reader the whole nav to get back; a "More" button with no numbers is the one control on the page that a screen reader cannot place.

*Caught by.* Assert focus is on #dbQ after Clear and that all three inputs are reset; assert the reveal button's accessible name contains both numbers.

## Must survive the port

Read off the working page. These are what a rewrite deletes without noticing.

- **The lede: "Everything UCLA licenses, plus what is open to anyone. The same list the library's own A to Z page is built from, refreshed once a day."** — It is the provenance and the freshness claim in one sentence — it tells the reader this is not a curated subset and not a stale copy. It is also the sentence the scope statement joins; DB-1 adds to it, does not replace it.
- **The lede is overwritten on successful load with "N databases, refreshed daily".** — The count is never hardcoded in the body. A rewrite that types 1,360 into the HTML makes the number wrong the first day the feed changes, and G2 forbids asserting a figure the page did not look up.
- **The zero-match empty state: "No database here matches that. The list is UCLA-wide, so try a shorter word — pub finds PubMed, psyc finds PsycINFO."** — It is an empty state that explains itself and teaches the matching rule (substring on name) with two worked examples. It is also the only place the page tells a reader the list is UCLA-wide rather than biomedical, which is the misconception the whole site invites. G4: rewordable, not removable.
- **The failure line: "Could not reach the database list: <cause>. The A to Z page itself is at library.ucla.edu."** — Pinned (databases-failure-points-elsewhere). It names the upstream, carries the actual cause, and hands the reader somewhere that still works. The paired worker string "the database list did not respond" is pinned separately and must keep agreeing with this prefix.
- **Treating an empty upstream response as an error, not as a result.** — `if(!items.length) throw new Error('the list came back empty')`. Without it a healthy-looking page asserts that nothing is licensed.
- **The client-side safeHref filter on every row, applied even though the worker already filters.** — The list is somebody else's markup and the page drawing the link is the last place that can refuse to draw a javascript: URL. Its own four-line copy exists specifically so this page does not pull 48 KB of shelf-core.js.
- **No description is printed for any row.** — The feed's 1,365 description divs are all empty. The page deliberately does not render an empty line pretending otherwise.
- **role="status" aria-live="polite" on #dbStatus, the sr-only label on the filter input, the role="group" aria-label="Narrow the list" on the checkboxes, and the skip link "Skip to the list".** — Four properties that change nothing visually when deleted, which is exactly why they go. class="skip" is pinned site-wide and cohesion.test.js asserts all seven pages carry one.
- **target="_blank" rel="noopener noreferrer" on every outbound database link.** — The reader keeps the list while opening a database; the rel pair is the security half of that decision.
- **The non-blocking web-font load: preload as="style", media="print" with onload swap, the two preloaded woff2 files, the noscript fallback, and the comments recording 803 ms of a 3.5 s paint and a 0.375 layout shift.** — Hard constraint. A porter tidying the head into a plain stylesheet link reintroduces both costs, and the comments are the only record of why the ugly form is correct.
- **PAGE = 60 with fetch-once/filter-locally, and the 120 ms debounce with Enter flushing it.** — The first screen arrives instantly out of 190 KB of JSON and a keystroke is never a request. DB-3's walk must be built on top of this paging, not by abandoning it for a 1,360-row DOM.
- **One header nav (Search · Map · Hours · Databases with aria-current="page") and one footer carrying the hand-surveyed / public-endpoints / not-affiliated disclosure.** — G5. The non-affiliation line is a claim the library cares about and appears on every surface.

## New claims, to be pinned before the page is written

- "Listed, not searched." — the scope sentence introduced by DIRECTION line 70; needs pinning by that signature once written.
- The per-row position announcement string introduced by DB-3 ("item N of M shown, T found") — pin the fragment " shown, " together with the record-grammar equivalent on home so the two cannot drift apart.
- The reveal control's full accessible name (DB-11) — pin "Show" + "more of" as the fragment carrying the numbers.

## Out of remit (G7): a person decides

- Palette and contrast for the "best bet" and "no login" badges, including whether they differ by hue — G7. The only constraint carried over from the direction's mark ruling is that they must not rely on hue alone.
- Typeface for the list, and whether database names take the display or system face — G7, and the standing constraint that no web font may block paint.
- The visible affordance for the reveal control and the focus ring on a walked row — the direction ruled pressability a control-state question but explicitly did not rule what it looks like.
- Whether this page keeps the name "Databases" in the nav and the title "Databases A–Z" — DIRECTION line 234 puts page titles and this page's name to a person.
- Wording review of "Listed, not searched." and of the new position-announcement string by whoever wrote the existing refusals — G4 permits rewording, and the direction requires the new sentences be written in the existing voice by the person whose voice it is.
- Whether the outbound links should open in the same tab — a behaviour preference with no ruling in the direction; today's answer stands until a person changes it.

## Silences in the direction, raised not filled

- The direction gives the list grammar for "rows, records and stops" and never says what a database entry is called in it. DB-3 borrows the record wording; the direction does not authorise that, and a person should confirm the noun.
- The direction does not say where "Listed, not searched." sits relative to the existing lede, nor whether it replaces the lede's provenance sentence. DB-1 places it and keeps both; the direction is silent on the ordering.
- Binding rule 2 specifies a refusal's shape for an answer that has a staff-code slot to void with dashes. This page has no such slot. The direction does not say what the equivalent "filled object" is for a list-shaped refusal; DB-5 reuses the existing named error rather than inventing a dashed skeleton.
- The direction says nothing about whether the arrow-key walk should page automatically past the 60-item boundary, or whether the reader must still press the reveal control. This decides whether "item 61 of 1,360" is reachable by keyboard alone and needs a ruling from someone.
- The direction does not say whether the two filter checkboxes and the local filter survive at all — it describes only "a list and one scope sentence" at low density. DB-8 assumes they stay because they exist today and G4 protects the page's own scope statements; a person should confirm the filters are not what "low density" was cutting.
- Nothing in the direction says whether a database name should be a pressable term linking to /methodology or /explainer, as legend words and refusal key terms are required to be. If "best bet" and "no login" are key terms in that sense, they need anchored paragraphs; the direction names neither.

