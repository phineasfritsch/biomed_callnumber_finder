# What the panel found

Six readers, each under a different constraint, used the site and reported what happened.
Every finding was then checked by a reader whose default was to refute it. This file is the
output; `ops/QUEUE.md` carries the ones that became work.

    panellists      6
    raw findings    47
    upheld          24
    REFUTED         23   (roughly half; see the note at the end)

## The headline

The panel would put this on a desk today for call numbers, and would not let it answer an edition question. Its three worst defects are one defect wearing three coats — a surface that returns a confident answer without checking that it answered the question asked: the home box appends the second slip onto the first and returns the first book's shelf, the Reference map asserts that any string you type is on floor 4, and the catalog calls fourteen separate editions "printings" of one. None of those look wrong on screen, which is precisely what makes them expensive on a product whose entire trust case is that it refuses to guess. Everything below that line is repair work on claims the site makes about itself — an undated survey, a privacy sentence the browser contradicts on every load, a page count that disagrees with the bar two centimetres above it — and it does not yet read as one product, because the site cannot count itself and its two call-number boxes have not signed the same contract.

## Ranked, by what it costs a real person

### 1. The home box appends the next slip to the last one and returns the PREVIOUS book's shelf

**Where.** / (index.html:436-462 shelfPreview, shelf-core.js:35 parseCN)  **Raised by.** Desk worker (raised); everyone downstream who trusts a green panel

**Cost.** A wrong aisle that is visually identical to a right one, produced by the single most repeated gesture at a service desk. Forty slips a shift, no warning, no echo of what was actually matched — the only tell is a range line nobody re-reads on a lookup that looks like it worked. This is exactly the failure the rest of the product is architected to avoid, committed on the highest-traffic path.

**Change.** In shelfPreview(), refuse or flag any input parseCN did not fully consume: echo the number actually matched in the hit panel ('Matched W1 AM4990') and warn on leftover text rather than silently discarding it. Separately, call #q.select() on focus so a fresh slip overwrites instead of concatenating. Ship both — the focus change alone leaves pasted and appended strings still wrong.

### 2. The Reference map cannot refuse anything — it asserts that any string is on floor 4

**Where.** /map, Reference · L4 pill (map.html:258-264)  **Raised by.** Cohesion reviewer (raised); desk worker and novice both exposed

**Cost.** One surface with no lookup behind its sentence. It echoed 'NOT A CALL NUMBER AT ALL is on floor 4' and placed W1 AM4990 — the tool's own worked example, which its own data puts on Level 7 — on floor 4. A desk worker who switched collections and forgot to switch back sends a patron to the wrong floor in a sentence shaped exactly like a real answer. It needs a mode error first, which is why it is second and not first; the output when it fires is a fabricated location from the one tool that markets itself on not fabricating.

**Change.** In the collection==='ref' branch, run the string through findFaces before answering. Refuse anything not call-number shaped using the same miss sentence the stacks branch uses, and when the string matches a mapped stacks range say 'this is mapped on Level 7 — switch to Main stacks' instead of asserting floor 4.

### 3. Fourteen distinct editions are labelled 'printings' of the 20th edition

**Where.** / catalog panel (index.html:1946 badge, :1949 disclosure)  **Raised by.** Reference librarian (raised); any patron asking which edition UCLA holds

**Cost.** A false bibliographic statement in the tool's own voice, on the record type where being wrong about currency matters most. The 1970 6th edition of Harrison's is not a printing of the 2018 20th, and telling a resident it is says the older text is interchangeable. The site contradicts itself in two places the reader can check: the checkbox says 'Group editions' and /methodology says 'Editions of one work are grouped'. The reference librarian's verdict — usable for call numbers today, not for edition questions — turns on this one word.

**Change.** Change index.html:1946 to 'N editions · newest shown' and :1949 to 'N earlier editions of this title', matching the #catGroupEd label and methodology.html. Do not change the grouping itself — the panel found the grouping defensible and the 2025 22nd edition is card 2, not hidden.

### 4. A missing space produces a coverage diagnosis the tool has no grounds for

**Where.** / (shelf-core.js:90 scheme(), index.html:441-442)  **Raised by.** Desk worker (raised); reference librarian

**Cost.** 'W1AM4990' returns 'It may be on a level not yet entered, or outside the mapped ranges' — byte-identical to the message for a book that genuinely is not in the building. Those demand opposite desk actions: retype, versus send the patron to SRLF or ILL. Worse, the sentence asserts a reason that is false here — scheme() has already classified the string as a W1 number, the book is on Level 7, and the tool knows it. And the asymmetry is silent: the NLM branch tolerates 'WA900.1M300' fine.

**Change.** Add a second miss message. When scheme() matches a W1–W4 prefix but the string does not segment, either normalise the missing space and retry, or say 'A W1 number needs a space after W1 — try W1 AM4990'. Reserve the coverage sentence for strings the parser genuinely read and could not place.

### 5. Every page load contacts Google, on a site whose privacy paragraph says otherwise

**Where.** /methodology (lines 209, 215, 228) and every page's head  **Raised by.** Distrusting patron (raised); anyone who reads /methodology to decide whether to trust /

**Cost.** This is the one claim on the site a suspicious reader can check in ten seconds, and it is the claim the site chose to state most absolutely. 'No third-party code on load' is arguable for a stylesheet; 'Cover images are the one request that leaves the UCLA and Cloudflare pair' is not — it is false on every page load, before the reader touches anything, and Google Fonts is filed under a heading reading 'ALSO, ON DEMAND ONLY'. Once the checkable sentence fails, the unverifiable ones get re-read with suspicion, and the unverifiable ones are the whole methodology page.

**Change.** Self-host the two woff2 files so the sentence becomes true, or move Google Fonts out from under 'ALSO, ON DEMAND ONLY' and amend line 228 to name the font request as a second on-load exception.

### 6. '27 records in Biomed Library' does not describe the list beneath it and never moves when filters do

**Where.** / catalog status line (index.html:2519; card-level drop at :1943; footer tally at :2027-2029)  **Raised by.** Reference librarian (raised)

**Cost.** The count is the sentence a librarian uses to answer 'is that everything?' before sending someone to ILL. Here it is the raw upstream number presented as a description of the list, and it stayed at 27 across three rendered sets of 22, 25 and 27. Two records are dropped silently by the only-my-library filter while three records in the same condition are kept and annotated, and one shown record is held at SLF-S, not Biomed. The tool proves it can do this correctly: at 903 records it says 'newest 81 ranked' and discloses the shortfall.

**Change.** Fold the card-level onlyMine drops at index.html:1943 into footer()'s hidden tally, and give the small case the same sentence shape as the 903 case — 'N records in Biomed Library · M shown'. Scope the 'in Biomed Library' phrase to the copies actually rendered.

### 7. 'Show covers' ships ticked, so a first search sends seven ISBNs to openlibrary.org before the disclosure renders

**Where.** / catalog panel (index.html:159), claimed at /methodology lines 207 and 228  **Raised by.** Distrusting patron (raised)

**Cost.** The defect is the claim, not the request. A default-on cover toggle is unremarkable product behaviour; what makes it a finding is that /methodology says covers 'happen only if you ask for covers', and the box that would let a reader decline is invisible (offsetParent null) until the results render — the same moment the requests fire. The label text itself is exactly right, which is what makes the default read worse than not having thought about it.

**Change.** Ship #catCovers unticked, or render the control with its label above the results area so the disclosure precedes the first request. If neither, change /methodology's consent sentence to describe the actual default.

### 8. A link-resolver failure is reported as 'Could not reach the article index', and a parse error as a network error

**Where.** / article panel (index.html:3329, over src/worker.js:436-441)  **Raised by.** Distrusting patron (raised); cohesion reviewer

**Cost.** One unconditional catch wraps both branches of look(), so a resolver failure is announced as an article-index failure one line after the page said 'Asking the resolver about this DOI…' — and a resolver HTTP 500 renders as the self-refuting 'Could not reach the article index: the resolver returned HTTP 500.' A shape mismatch prints a raw TypeError behind a reachability claim, which is the exact distinction /methodology says the tool is careful about. The worker already keeps three separate messages and the test suite pins all three; the front end throws the distinction away and then names the wrong door.

**Change.** Split the catch in look() by branch: resolver errors say 'Could not reach the link resolver', /api/articles errors keep the index wording, and surface e.message only when it is one of the worker's own sentences rather than a raw JS exception.

### 9. The catalog's 27 records are 4,670 characters with no headings, no list, and no way in but arrowing

**Where.** / (#catResults; clusterCard at index.html:1947)  **Raised by.** Screen-reader user (raised)

**Cost.** A screen-reader user is told there are 27 records and given no route to record 2. Heading navigation has nothing to land on (the page has three headings, all outside the results); list navigation has nothing to land on; neither NVDA nor JAWS quick-navigates <article> reliably. The only path is arrowing through record 1's title, publisher, edition, printing badge, holdings and copy notes before record 2 begins. This is the same product that reduced a whole floor plan to one well-chosen sentence for the same reader.

**Change.** Give each <article class="work"> an h3 carrying the title (or role=heading plus aria-labelledby), and wrap the cards in a ul/li so heading and list navigation land on record boundaries.

### 10. /hours announces 'Asking LibCal…' and then never announces that the answer arrived

**Where.** /hours (hours.html:92 #hrsStatus, :72 #hrsSummary)  **Raised by.** Screen-reader user (raised)

**Cost.** The page's only live region is cleared on success, and the sentence the reader came for — '2 of 3 locations open now' — lands in a plain <p> with no role and no aria-live. The sequence heard is 'Asking LibCal…' then silence forever, so the reader must keep manually re-reading to discover whether an answer exists. That is exactly what a status line is for. The author already got this right one page over.

**Change.** On success, write the outcome into #hrsStatus instead of clearing it — 'Biomedical open now; 2 of 3 locations open, Monday, August 31' — mirroring databases.html:85, which writes its result into the identical role=status region.

### 11. On /hours, 'Next week' rebuilds the page, drops focus to body, and says nothing  (marginal)

**Where.** /hours (#hrsPrev / #hrsNext, renderDays())  **Raised by.** Screen-reader user (raised)

**Cost.** A state change that replaces the week strip and the whole location list gives no announcement and no reading position, so the reader cannot tell whether the press registered, whether it is still loading, or whether they mis-hit. Day selection on the same page does announce ('Showing Thursday, September 3, 2026'), so the pattern exists and was simply not applied here.

**Change.** After a week change, restore focus to the pressed #hrsNext/#hrsPrev and write the new range into #hrsStatus ('Showing week of September 6'), matching the day-selection path.

### 12. The shelf survey — the one dataset that can go silently stale — is the only thing on /methodology without a date

**Where.** /methodology, shelf-map section (against dated probes at lines 121 and 158)  **Raised by.** Reference librarian and distrusting patron (raised independently; merged here)

**Cost.** The API sections carry hard timestamps ('All probed against the live endpoint on 10 August 2026'). The hand survey says 'The map is accurate as of when a face was walked' and never says when. The API side is self-correcting — if Alma changes, the page breaks visibly. The survey is the one thing that can be confidently, invisibly wrong, producing a beautifully formatted answer pointing at an aisle that was reshelved. 'Accurate as of when a face was walked' is an unanswerable sentence without a when.

**Change.** Add a survey date range to the shelf-map section of /methodology, and a last-walked month per level if the data supports it. If a line near the result is wanted, make it one 'map surveyed <range>' note on / and /map — not a per-face timestamp; the result already ships the face's call-number range, which is a better check than a date because it can be verified at the spine.

### 13. Arriving on the map from a catalog result, the shelf is half-clipped at the right edge and two pixels below the fold

**Where.** /map?lvl=&id= arrival branch (map.html:352-357)  **Raised by.** First-year student on a phone (raised)

**Cost.** The one moment the tool converts an answer into a place in a room, the place is not on screen and nothing indicates the diagram scrolls. At 390x844 the highlighted face sits at x 356-378 in a container visible to x 365, with scrollLeft 0 and 220px of plan off to the right; the index strip reads 0-9 then a cut-off '1'. The student sat looking at shelves 0-9 wondering whether she had been sent to the wrong floor. Not blocking — the detail panel further down names 'Index 10 · top row' in words — but it is the handoff failing at the handoff.

**Change.** Give the ?lvl=&id= branch what routeShow already does at map.html:799: scrollIntoView on the stage, plus set planwrap.scrollLeft so the selected face is centred rather than merely rendered.

### 14. The map forgets which book sent you and shows two ranges without marking yours

**Where.** / to /map handoff (index.html:1841; map.html:233-244, :346-350)  **Raised by.** First-year student on a phone (raised); desk worker on a handoff

**Cost.** The reader must carry 'WB 115 H322 2018' and 'Right side' across a page navigation, on a phone, in a building they have never entered, to disambiguate a LEFT and a RIGHT range the detail panel lists neutrally. Note the reviewer's own explanation was wrong — id=top-10 carries row and index only, no side, and no q — but the complaint stands and the receiving end is already built.

**Change.** Append &side= and &q= at index.html:1841; map.html:346-350 already fills the box and calls locate on arrival. Mark the named face in renderDetail instead of emitting identical .face-rows for both sides.

### 15. /methodology contradicts itself on a measured figure and describes a page shape the site no longer has

**Where.** /methodology (line 89 vs line 259; line 261)  **Raised by.** Reference librarian and cohesion reviewer (raised separately; merged)

**Cost.** The page opens by asking to be checked — 'a tool that tells you which shelf to walk to should be checkable'. A reader who takes that invitation finds the same LibGuides payload described as '1.17 MB to extract about 60 KB of facts' and '1.17 MB of markup to extract about 190 KB of facts', three times apart, with no qualifier distinguishing them; and 'The page fetches it the first time the panel is opened, not on load' describing a /databases that requests /api/databases on plain load. Two checks, two failures, which retroactively discounts the probed figures in the same section that are presumably right.

**Change.** Recompute the extracted-facts figure once and make methodology.html:89 and :259 agree. Replace line 261 with the shipped behaviour — /databases requests /api/databases on load — and sweep the section's other 'panel' references at the same time.

### 16. Two adjacent buttons on the home page are both named 'OPEN'

**Where.** / (#catToggle and #artToggle)  **Raised by.** Screen-reader user (raised)

**Cost.** In a buttons list — how this reader reaches controls as often as by tabbing — they read 'OPEN button, OPEN button' with nothing to distinguish the catalog panel from the article panel, forcing a return to the page to read surrounding text. The disambiguating words are already on screen in the adjacent h2s and simply are not wired up; aria-expanded and aria-controls are already correct.

**Change.** Add aria-labelledby on #catToggle and #artToggle pointing at the ids of their panel h2s ('Find a book in the catalog', 'Find an article').

### 17. The 404 tells a lost reader the site has three pages, above a bar showing four

**Where.** /404 (404.html:46 and :55), contradicted by about.html  **Raised by.** Reference librarian, distrusting patron, cohesion reviewer (three findings, one edit)

**Cost.** Small, and raised independently by three of the six reviewers, which is itself the signal. This is the page a reader meets when they already do not know where they are, and its whole job is to state the shape of the site. It states it wrongly, twice, and the reader can disprove it by counting the pills an inch above. /about says four.

**Change.** Change both sentences in 404.html to 'four', or drop the count entirely ('they are all in the bar above'). Best: derive the number from the same nav list the bar renders so the two cannot drift again the next time a section is added.

### 18. /about and /methodology are called four different names across seven footers

**Where.** index.html:372, map.html:146, hours.html:99, databases.html:92, 404.html:60, about.html:193, methodology.html:401  **Raised by.** Cohesion reviewer (raised)

**Cost.** These two pages are not in the nav, so the footer strings are the only names they have — and they vary on exactly the pages a returning reader arrives from. /about is 'How to use this' or 'How to use it'; /methodology is 'How it works' or 'How it works in detail'. The 404 footer omits the methodology link altogether.

**Change.** Use one pair of strings everywhere — 'How to use this' for /about, 'How it works' for /methodology — fixing methodology.html:401 and about.html:193, and add the methodology link to 404.html:60.

### 19. Two of the four upstream error lines stutter, because the client prefix repeats the worker's own sentence

**Where.** / article panel (index.html:3329) and /databases (databases.html:191), over src/worker.js:436 and :585  **Raised by.** Cohesion reviewer (raised)

**Cost.** 'Could not reach the article index: could not reach the article index. Try again.' fires on a real network failure — the exact condition the message exists for — and the databases line says two different things in one breath ('Could not load… could not reach'). The catalog and LibCal lines read cleanly because the worker's HTTP branches are noun phrases; this is one missed case in an otherwise deliberate pattern, not a general copy problem. Low cost, but it reads like a bug leaking through a set of messages that are otherwise the most trustworthy thing on the site.

**Change.** Make worker.js's outright-failure strings noun phrases the prefixes can carry ('the article index', 'the database list'), matching worker.js:437 and :586, and change databases.html's 'Could not load' to 'Could not reach' so prefix and wrapped message agree.

### 20. The Reference map keeps the shelf legend and 'tap any shelf' over a plan with no shelves in it  (marginal)

**Where.** /map, Reference · L4 (renderDetail empty state and the legend block)  **Raised by.** Cohesion reviewer (raised)

**Cost.** Seconds, no wrong answer. Half this finding was refuted in verification: the '453 Biomed shelf faces mapped' count is anchored to the floor strip it sums, not captioned on the plan, and the plan itself already prints 'Books are shelved by call number. No per-shelf map.' What survives is that the detail panel's generic empty state instructs the reader to tap a control that does not exist on this view, under a colour legend for marks that are not on screen.

**Change.** On the Reference view, hide the shelf legend and swap renderDetail's empty-state text for 'Reference is shelved by call number on floor 4 — there is no per-shelf map.'

## Cohesion

Not one product yet — but the failure is specific, not diffuse, and four things genuinely hold. The shelf vocabulary (level / top row / index / side) is word-for-word identical on the home result, the mini map, the full map and inside a catalog row, so no reviewer had to translate between screens. Landmarks, nav, footer and skip link are identical on all six pages including the 404. The refusal grammar on the three main surfaces is one voice: each names the thing it searched and offers a next move. And the /map?q= handoff carries the answer without re-typing. What does not hold is that the site cannot count itself, its two call-number boxes have not signed the same contract, and its own good patterns are applied on one page and half-applied on its sibling. The most damaging seam is not cosmetic: two boxes that look alike and are labelled alike have opposite contracts, and one of them cannot fail. Fix seams 1 and 2 and this reads as one product; the rest are copy edits.

**Seam: / vs /map (Main stacks) vs /map (Reference · L4)**

Two call-number boxes, three contracts. The home box routes, states its decision and offers the reverse; the map's stacks box always answers a shelf; the map's Reference branch answers with no lookup at all and therefore cannot be wrong in a way it can detect. The product's stated position — '/methodology: A face nobody has surveyed shows as a dash rather than as an empty shelf, because those are different claims' — is contradicted by one of its own surfaces.

*Fix.* Every box runs its input through findFaces before it answers. The map's box does not need the home page's routing UI — that asymmetry is defensible and the panel refuted the complaint about it — but map.html:258-264 must be able to refuse, and index.html:436 must refuse a string it only partly parsed. One rule: no surface asserts a location it did not look up.

**Seam: /404, /methodology, / (catalog status line)**

The site cannot count itself. The 404 says three pages above a bar showing four; /methodology gives one payload two extracted-fact figures three times apart; the catalog status says 27 over a list that renders 22, 25 or 27 depending on filters that never move the number. By the sixth page the cohesion reviewer had stopped believing any number on any page.

*Fix.* Derive each number from the thing it counts: the 404's page count from the nav list the bar renders; methodology's KB figure measured once and used at both line 89 and line 259; the catalog status from the rendered set, using the sentence shape the 903-record path already uses.

**Seam: /hours vs /databases**

Announcement discipline is fully implemented on one page and abandoned on its sibling. /databases writes its outcome into a role=status region ('3 databases, 2 of them needing a UCLA login'); /hours uses the identical markup pattern and then clears the region on success, leaving the answer in a plain paragraph.

*Fix.* hours.html writes the outcome into #hrsStatus on arrival the way databases.html:85 does with #dbStatus, and announces week changes the way day selection already does.

**Seam: / (article panel) and /databases, against / (catalog) and /hours**

Upstream error grammar splits down the middle. Catalog and LibCal read cleanly because the worker's HTTP branches are noun phrases; articles and databases stutter because the outright-failure strings are full sentences wrapped in a prefix — and the article branch additionally names the wrong service, reporting a link-resolver failure as an article-index failure.

*Fix.* Make worker.js:436 and :585 noun phrases like :437 and :586 already are, and split index.html:3329's single catch so the resolver and the index get their own sentences.

**Seam: all seven footers**

The two pages that carry the site's whole argument have no fixed name. /about is 'How to use this' on five pages and 'How to use it' on /methodology; /methodology is 'How it works' on the tool pages and 'How it works in detail' on /about. Neither is in the nav, so these strings are the only names they have — and the variants live on precisely the pages you arrive from.

*Fix.* One shared pair of strings in every footer, and add the missing /methodology link to 404.html:60.

**Seam: / (shelf result) vs / (catalog result), both to /map**

The handoff to the map is lossier from one origin than the other. The shelf lookup sends ?q= and lands with the face outlined and the box filled; a catalog result sends only lvl and id, so the map arrives with an empty box, no side, and two ranges listed neutrally — even though map.html already handles a q parameter on arrival.

*Fix.* index.html:1841 sends q and side as index.html:439 already sends q, and renderDetail marks the named face.

## Where the personas disagreed, and how it was resolved

**Library desk worker (twenty seconds a slip) vs first-year student on a phone (needs the words explained)**

*About.* How much explanation belongs in the shelf answer. The desk worker wants three lines and no chrome; the student did not know what 'index 10' meant, looked for a glossary, found none on /about, and ended up walking Level 10 reading spines.

*Resolution.* Resolve entirely toward the desk worker on the answer line, and pay the student back in the handoff. Verification already refuted her requests that 'index' be glossed and that /about carry a contents list, and it was right to — her actual failure was spatial, not lexical. She could read 'Level 10 · top row · index 10 · Right side' and knew it was the answer; what defeated her was tapping it and landing on a diagram where her shelf was half off-screen (#13) and unmarked (#14). Fix those two and the vocabulary problem evaporates without a word being added to a panel someone reads forty times a shift. Do not add a 'what is an index?' link, a gloss, or an explanatory sentence to the result. The one exception cuts the other way: #1's 'Matched W1 AM4990' echo adds a line the desk worker did not ask for, and it ships anyway, because a correctness check is not the same category of cost as an explanation.

**Desk worker who types the next slip vs a reader refining a query they just typed**

*About.* Whether the search box should clear or keep its contents on focus.

*Resolution.* Select-on-focus, not clear-on-focus — that is a mechanism that serves both, not an average that serves neither: typing overwrites, an arrow key preserves. But the load-bearing half of the fix is unconditional and independent of focus behaviour: the box must refuse to answer for a string the parser only partly consumed. Shipping only the focus change makes the common case safer and leaves the pasted and appended cases silently wrong, which is the worse outcome because it looks fixed.

**Distrusting patron vs desk worker**

*About.* How much provenance to stamp on the answer itself. The patron wants to know when the face he is being sent to was walked; the desk worker reads three lines and moves on.

*Resolution.* One date on /methodology, at most one 'map surveyed <range>' line near the result — not a timestamp per face. Verification already collapsed the per-face version into the survey-date version and I agree with it: the result panel already carries the face's call-number range, which is a better check than a date because it can be verified against the spine at the shelf. The patron's underlying complaint is legitimate and unaddressed (#12) — the page dates the two datasets that self-correct and leaves undated the one that decays invisibly — but it is a documentation fix, not an answer-panel fix.

**The screen-reader user against himself**

*About.* He praised the floor plan being reduced to a single image label ('somebody thought about me') and then asked for more headings, more announcements, more structure. Those look like opposite asks and a compromise between them would be incoherent.

*Resolution.* Not actually a tension once you state the rule the site is already half-following: announce outcomes, suppress ornament, and give structure to anything the reader must navigate rather than merely hear. The floor plan is ornament whose outcome is already stated in words — correctly silenced. /hours' '2 of 3 locations open now' is an outcome — wrongly silenced (#10). The 27 catalog records are a thing to navigate — wrongly unstructured (#9). All three follow from one rule, so do not treat #9 and #10 as a verbosity budget to be split against the SVG decision.

**Cohesion reviewer vs the verifier (and the pages themselves)**

*About.* Whether the four differently-worded refusals are a vocabulary failure that should be standardised into one sentence.

*Resolution.* Side with the verifier. The stacks miss says 'may be on a level not yet entered' because eleven floors exist and some are unentered; Special Collections is a single level, so the same clause there would be a false next step. Wording that varies with what is actually unknown is correctness, not drift, and flattening it would make the tool sound more uniform and less honest. What must be uniform is the contract — every call-number box refuses what it cannot resolve — which is exactly where Reference breaks (#2). Standardise the behaviour, not the sentences.

**Reference librarian ('is that everything?') vs the catalog's ranking design (the upstream total is the honest number)**

*About.* Whether the status line should describe the result pool or the rendered list. Both are the right answer to a different question, and picking one loses the other.

*Resolution.* Print both, which the tool already does above a threshold and drops below it. '903 records in Biomed Library · newest 81 ranked' answers both questions at once; '27 records in Biomed Library' answers neither reliably once the display filters run. Do not replace the upstream total with a rendered count — that would break the ILL decision the librarian described. Give the small case the sentence shape the large case already has, and fold the card-level drops into the hidden tally so the second half of the sentence is true.

## What no panel can settle

- Whether 'index 9' can actually be counted by a person standing in the aisle — which end it starts from, and whether it corresponds to anything printed on the shelf ends. The panel refuted this finding on the evidence available (the answer ships a marked floor plan and a call-number range, and the map legend labels the columns 0-16), but only someone on Level 7 with the diagram in hand can say whether the number is usable or purely internal.
- When the 453 faces were walked, and whether the W1 and WB ranges are still true. Nobody here can date a hand survey or check a range against a spine. #12's fix is to publish a date; somebody has to know it, and if nobody does, that is itself the finding.
- Whether 'Level 10' is the button in the elevator. The panel was right to refuse to let the tool assert an equivalence its data does not carry — a wrong floor is worse than a literal one — but a person in the building can establish it, and then the tool is allowed to say it.
- Whether the edition grouping is correct in substance, as opposed to correctly named. We reviewed one stubbed response for one title. #3 fixes what the badge calls the cluster; whether the right Alma records are in the cluster needs a cataloguer against live data.
- Every accessibility finding here is a Chromium accessibility-tree measurement or a scripted proxy, not a session with a person using NVDA or JAWS. #9, #10, #11 and #16 are confident about markup and inferential about experience — and the skip-link finding was refuted on precisely that distinction. One hour with a real screen-reader user would settle all of them and would probably reorder them.
- Which behaviours here are artefacts of the working tree. The deployed site apparently links catalog results out to Primo and this render does not; at least two findings were refuted on that basis. The catalog findings (#3, #6, #7) should be re-run against the live site before anyone acts on them.
- Anything about how it looks. Palette, type, whether the six pages read as one hand, and whether the green result box reads as tappable to a person who has never seen it — out of remit here and genuinely undecidable from a DOM and an accessibility tree.
- Whether the desk worker's twenty-second budget survives the fixes. Adding a 'Matched W1 AM4990' echo to the hit panel is the correct fix for the worst defect in this report, and it is also one more line to read on the highest-frequency path. Only a real desk can say whether that costs a second.

## What the site already gets right

Recorded because it is what the refutations were made of, and because a redesign that does
not know these are load-bearing will delete them.

- Unmapped call numbers are refused by name, in the same live region as the answer: 'No mapped shelf contains ZZ 999 Q999. It may be on a level not yet entered, or outside the mapped ranges.' No nearest match, no invented aisle. Four of six reviewers named this unprompted as the thing that bought their trust — and the one place it is missing (the Reference map) is the panel's second-ranked finding.
- Ambiguity is stated rather than resolved for the reader: '2 shelves match — a serial run shares one call number, so check the volume and year on the spine.' One line, and it is repeatable out loud to a patron.
- The widen notice names the scope change and warns that the reader's own filter would hide the result: 'Nothing in Biomed. Widened to Every UCLA library… "only my library" would hide every one of them.' That is the sentence a librarian would otherwise have to say out loud.
- Large result sets disclose their own truncation: '903 records in Biomed Library · newest 81 ranked', with 'LOAD 50 MORE · 81 OF 903 RANKED SO FAR'.
- The shelf vocabulary — level / top row / index / side — is identical on the home result, the mini map, the full map and inside a catalog row. Not one reviewer had to translate between screens.
- The routing decision is stated and reversible in one click: 'Searched the catalog. Treat it as a call number instead · Search articles on this topic.' The cohesion reviewer called this the hardest thing the design had to get right, and both the novice and the screen-reader user independently named it as what kept them oriented.
- The floor-plan SVG is role="img" with a single aria-label and every inner <g> aria-hidden, so 131 characters reach speech instead of forty spoken 'R L's. A deliberate decision, and the right one.
- Every interactive control on /, /map and /hours has a real accessible name — no unnamed and no placeholder-only controls in the accessibility tree — the pill groups are role="group" with aria-label and per-pill aria-pressed, and landmarks are identical across pages with nav nested inside banner.
- Upstream failures name the upstream and the code rather than shrugging: 'Could not reach LibCal: LibCal returned HTTP 503.' and 'Could not reach the catalog: the catalog returned HTTP 503.'
- The catalog panel is honest about the library picker: with Powell selected it says 'Powell Library has no per-shelf map in this app. Results are scoped and ranked for it… but only Biomed resolves to an actual aisle.'
- 'Shelf order (walk it)' genuinely sorts in call-number order — WB 100 H248p 1970 through WB 115 H322 2018 — a list you can pull off the shelf without backtracking.
- The zero-hit answer names the query and says what it already tried ('even after retrying with fewer words'), and it really did widen past Biomed first: twelve SRU calls, the second with the location clause dropped.
- The map states its own coverage rather than implying completeness: '453 Biomed shelf faces mapped', per-level face counts that visibly vary (level 9 shows 17 against ~49 elsewhere), and '– = unmapped' held distinct from an empty shelf.
- A hit answers in under 100ms and lands above the fold with no scrolling, on the page's most repeated task.
- No accounts, no cookies, no analytics, no email capture, no cookie wall, no chat widget, no claim anywhere to be AI-powered, and every footer disclaims UCLA endorsement.
- /methodology dates its API probes to the day and distinguishes what was learned by probing from what was read in documentation — which is exactly the standard the shelf survey is being held to in #12.
- The /databases empty state is both announced and useful: '0 of 3 databases' plus 'The list is UCLA-wide, so try a shorter word — pub finds PubMed, psyc finds PsycINFO.'
- The misspelt title is not silently rewritten: 'No UCLA record matches harrisen priciples of internal medicine… Check the spelling, or switch the search field above. Keyword is the loosest.'

## On the refutation rate

About half of every finding raised did not survive verification. That is the point of the
step rather than a sign the panel was bad: a group convened to find problems will find them,
and roughly half of what it finds is preference, misreading, or an artefact of the harness.
Shipping the unverified list would have meant acting on twice as much, half of it wrong.

Two of the refutations are worth keeping in view, because they say what the tool is doing
right. Requests that it be more confident than its data supports were refused: a wrong aisle
is worse than none. And the four differently-worded refusal messages were defended rather
than standardised, because wording that varies with what is actually unknown is correctness,
not drift.
