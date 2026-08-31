# Brief: /methodology

Written from the frozen direction in `ops/DIRECTION.md`. Rulings are numbered so a code
comment can cite one six weeks from now by somebody arguing with it.

**The job.** To answer one question at a time, arrived at by link, about a single word the product just used — what "index" counts from, what "not recorded" means, what was looked up versus derived, when the data was last checked — and to keep the endpoint-by-endpoint record that lets a sceptic audit the whole tool without asking anyone.

**The reader.** Two arrivals, one page. (a) Someone mid-lookup who tapped a legend word or a key term in a refusal: they have an answer or a refusal on screen, they want one paragraph, and they want to get back. Failing looks like landing at the top of a 31 KB endpoint document and scrolling to find the word — the /map spatial failure repeated in prose. (b) A sceptic deciding whether to trust the tool at all, reading top to bottom, wanting provenance, dates and the list of things it refuses to claim. Failing them looks like a rewrite that trades the probe dates and the survey window for a tidier page.

## Rulings

### METH-1

Every term the product prints in a legend, in a refusal, or in a disclosure has exactly one anchored paragraph on this page, addressed by a stable id; a linked term with no anchor and an anchor no surface links to both fail `ops/test`.

*Amended (Stage 02b).* "Build failures" named enforcement machinery this product does not have — the hard constraints state there is no build step — which made the ruling unfalsifiable as written. It never needed one: this ruling's own *Caught by* is a suite assertion, and the suite exists. The completeness check also runs over a term list nobody has ratified, so it cannot be run at all until that list has an owner; SHARED-10 owns it.

*Because.* DIRECTION line 42 and the /methodology section: "linked directly from every legend word, every key term in a refusal and every disclosure." Serves G5 (one vocabulary for the same thing) and G3 (explanation reachable without occupying the fold). Without the completeness check, the port ships legend words whose links land on #main and the reader learns the links are decorative.

*Caught by.* Enumerate every href matching /methodology#… emitted by index.html, map.html, hours.html, databases.html and 404.html; assert each fragment exists as an id in methodology.html, and assert every anchored paragraph id is the target of at least one such link. Both directions, both fail.

### METH-2

The term paragraphs are added; the endpoint record is not removed, summarised or relocated to make room for them.

*Because.* G4 (a refusal may be reworded, never removed) and G2 (an answer is trustworthy or it is not shown). The endpoint prose is the only place the tool's claims are falsifiable — the SRU parameters, the probe findings, the resolver tiering. The direction is silent on the endpoint record's fate, and silence is not permission to delete.

*Caught by.* Byte-for-byte, the eight existing <h2> sections and the Google Fonts <h3> still exist. Add pins for the sentences listed under `preserved` so a deletion fails Tools/pins.test.js rather than passing a green suite.

### METH-3

Each anchored paragraph is self-sufficient: it names its own term in its first sentence and never opens with a back-reference to the paragraph above it.

*Because.* The direction's density note for this surface: "addressed by anchor rather than read top to bottom." A paragraph that begins "That has consequences worth stating" is correct when read in order and useless when it is the landing point of a link from a refusal.

*Caught by.* For every element carrying an anchor id, assert its first sentence contains the term named by its id and does not begin with That/This/It/Those/These/Such.

### METH-4

Each term paragraph states, in its own words, whether the thing it names was looked up or derived from something looked up; the derived-versus-looked-up separation gets its own anchored paragraph and is the link target for the two-claim sentence a title query prints on home.

*Because.* Graft from declarative-2 (DIRECTION line 147): "DERIVED is never collapsed into LOOKED UP", ruled "the best trust mechanic in the bracket". G2. Without it, the page explains vocabulary but not authority, and a shaky catalog result borrows the survey's credibility.

*Caught by.* Assert the derived/looked-up anchor exists and is linked from home's catalog-gave-this-call-number clause. The per-paragraph part is a review item, not a machine check — say so rather than pretending otherwise.

### METH-5

No count, coverage claim or verification statement appears on this page without the date it was checked and the scope it covers in the same sentence.

*Because.* G2, and the page already does this in four places (survey window 28 May–5 June 2026; "probed against the live endpoint on 10 August 2026"; "Verified against the live widget on 10 August 2026: 1,360 databases…"; the spine-range and per-zone verification dates the direction requires). The direction's given-up list accepts that "coverage honesty costs visible gaps"; an undated statistic is the cheapest way to lose that.

*Caught by.* Extract every digit-group that is a count or a total from the rendered prose and assert a four-digit year or a named date occurs within the same sentence, with an explicit allowlist for parameter values (maximumRecords=50, 1500 to next year, 44 px).

### METH-6

This surface draws nothing: no crop, no floor plan, no legend rendered as a picture, no SVG in <main> at all. Legend words are explained here in prose.

*Because.* Binding rule 2 — the drawing never appears without a mark — and refusal 3 in the direction. There is no lookup on /methodology, therefore no mark, therefore no drawing. A specimen plan on the page explaining the legend would be a plan asserting a place nobody looked up.

*Caught by.* Assert methodology.html contains no <svg> inside <main>. The header brand mark is outside it and is exempt.

### METH-7

Unsurveyed space is called "not recorded" and never "empty", here and everywhere; the existing dash-versus-empty-shelf sentence becomes the anchored paragraph for the hollow/dashed convention and keeps its "those are different claims" reasoning intact.

*Because.* Graft from declarative-3 ("the legend says 'not recorded', never 'empty'") and refusal 4. This page already contains the ancestor of that rule in the author's own voice; the rewrite must inherit it, not restate it in the direction's words. G4 and G5.

*Caught by.* Pin the signature "because those are different claims" in Tools/pins.test.js, and assert the string "empty shelf" occurs on the site only inside the sentence that denies it.

### METH-8

The verification-interval paragraph states the mechanism — a row past its interval draws no range and says so — and names the interval as a policy owned by library staff; it does not print a number of days the direction never set.

*Because.* Graft from spatial-4 (per-row stamping with automatic suppression) plus the out-of-remit list: "the verification interval for spine ranges and landmarks, who owns re-survey after a shift… are a staffing decision." G7. Inventing "90 days" here would make software policy out of a staffing decision, and the number would then be quoted back as fact.

*Caught by.* Assert the interval paragraph contains no duration literal until an owner supplies one; a reviewer check, since a future real number must be allowed to appear.

### METH-9

No new **fetched** asset — script, font, image or stylesheet — may be added to this page; /methodology stays static HTML served by the existing site.css. The handful of bytes METH-10's `:target` treatment needs in the shared stylesheet are budgeted and permitted.

*Amended (Stage 02b).* Two faults. It bound all seven surfaces from inside one surface's brief — the same overreach ABOUT-11 deliberately refused to commit — so the site-wide asset rule moves to SHARED-9 where it can be argued with by everyone it binds. And it forbade adding anything to the shared stylesheet while METH-10 requires a `:target` treatment that does not rely on hue alone, which is CSS that does not exist today and had nowhere to live: the brief required and forbade the same thing. A stylesheet rule is not a fetched asset; the cost it names is bytes, and bytes are budgetable.

*Because.* G1 and the hard constraints — home is 198 KB and the stylesheet 53 KB, and web fonts once cost 803 ms of a 3.5 s first paint. This page is off the path to a shelf; a term-paragraph style that ships in the stylesheet is paid for on every home load by every reader who never opens it.

*Caught by.* Tools/assets.test.js: methodology.html references site.css and no page-specific JS; the stylesheet's byte count does not grow in the commit that adds the anchors.

### METH-10

Arrival at an anchor is an instant jump to a focusable paragraph: each anchored paragraph carries tabindex="-1" and a :target treatment that does not rely on hue alone, and no smooth-scroll or animation is used to reach it.

*Because.* G6 (keyboard and screen reader are first-class) and the graft from declarative-1 that made focus actually move on /map arrival rather than leaving the reader to hunt for a pinned line. Reduced-motion is honoured across the product; the same arrival by ear must land on the paragraph, not at the top of the document.

*Caught by.* Assert every element with an anchor id has tabindex="-1"; assert scroll-behavior:smooth appears nowhere; assert the :target rule changes more than colour.

### METH-11

The surface keeps its own skip-link destination wording ("Skip to the explanation"), its footer label "How to use this", and the affiliation disclaimer verbatim.

*Because.* G5 (one nav, one footer, one vocabulary) and Tools/cohesion.test.js, which already fails a page that calls /about or /methodology by a second name — it was written after four names appeared across seven footers. The disclaimer is pinned as not-affiliated-with-ucla and this page is one of seven co-hosts.

*Caught by.* Tools/cohesion.test.js and Tools/pins.test.js as they stand; both already cover this.

### METH-12

One anchored paragraph states what the product refuses to claim — no routes, no step counts, no sensors, no guessed shelf — written in the same grammar as the refusals on home, and closing on the existing sentence "When it is wrong about a shelf, the shelf is right."

*Because.* The direction's /methodology section requires "what the product refuses to claim", and its refusal list (1, 2, 3) supplies the content. G5 asks for one grammar for failure; a refusals page written in a different register from the refusals it explains teaches the reader they are two different products.

*Caught by.* Pin "the shelf is right" and "It is not an official UCLA service"; assert the paragraph is the link target of the refusal terms emitted on home and on 404.html.

## Must survive the port

Read off the working page. These are what a rewrite deletes without noticing.

- **The lede's second half: "because most of what is below was learned by probing rather than from documentation."** — It is the page's warrant. It tells the sceptic why undocumented claims are here at all, and it is exactly the clause a tightening edit removes as throat-clearing.
- **"The walk that produced it ran from 28 May to 5 June 2026, so the map is accurate as of then rather than as of today, and shelves get shifted. Nothing in the data notices when they do, which is why the date is on the page."** — The whole verification-interval and per-row-stamp apparatus in the direction is a formalisation of this paragraph. It is also the only statement of the survey window; the answer's receipt line points at it.
- **"A face nobody has surveyed shows as a dash rather than as an empty shelf, because those are different claims."** — The direct ancestor of hollow/dashed/"not recorded", of the voided staff-code slot, and of the whole refusal-is-a-filled-object rule. Losing it leaves the convention with no stated reason.
- **"Where a range start equals its end, many volumes share one call number and every matching face is returned for you to check the spine."** — This is the serial-run caveat's explanation. The direction requires the caveat to outrank the crop on a tight fold; the term it uses must land somewhere, and this is that paragraph.
- **The parsing paragraph with its worked example — AM477 sorting before AM4733 under string comparison, ".4733 is less than .477" — and the W1 rule that "the space after W1 is part of the number, not decoration."** — The only demonstration on the site that the matching is not naive. It is also the natural anchor for "mapped range" and it is written as a proof, which no summary preserves.
- **"a service gets a proxy only when it cannot be called from a page", and the seven-service table that shows which is which and why (Primo sends no Access-Control-Allow-Origin; LibGuides is 1.17 MB of markup for 184 KB of facts).** — It pre-empts the accusation that the Worker is an unnecessary middleman collecting queries. The reasoning, not the table, is what does that.
- **The sortBy finding: the CQL clause is honoured while the request parameter is "accepted and ignored, which is worse than being rejected: a search that looks sorted and is not gives you a confident wrong first result."** — The clearest statement anywhere on the site of the product's governing fear — fluent wrongness. It is undocumented upstream behaviour that nobody will rediscover if it is cut.
- **"Diagnostics are read as errors" (SRU reports failure inside a 200) and "A parser error is treated as an unreadable response rather than as no results."** — Two different failures kept distinct on purpose. A rewrite that merges them into "errors are handled" destroys the distinction the code implements.
- **"Twenty-five requests per question… when the allowance runs out the page says so instead of reporting no match."** — An exhausted budget and an empty collection are different answers. This is the same not-empty/not-recorded discipline in a different place.
- **The scoping paragraph: the search widens only if the home library has nothing, "When it widens it says so, and if the answer turns out to be at another library the 'only my library' filter is suspended rather than left to hide it."** — Explains the pinned status-line claim catalog-scope-is-named. Without it the widening reads as the tool ignoring a filter.
- **The acronym trap in whole: parkisons tFUS → "parkinsons thus", the word-by-word application, the capital-after-first rule, and "If the suggestion differs from the original only in the acronym, nothing is offered."** — A refusal to offer a suggestion, and the reasoning for it. Reads as trivia; is the difference between 14 papers and the wrong papers.
- **Every probe date and the counts they carry: "All probed against the live endpoint on 10 August 2026"; "Verified against the live widget on 10 August 2026: 1,360 databases, 1,254 of them needing a login, 340 best bets, and 106 that open to anybody."** — METH-5 exists because of these. A statistic with its date and scope attached is the house style already; a rewrite that keeps the numbers and drops the dates is the likeliest silent damage on this page.
- **"An empty parse is reported as an error rather than as an empty list, because those are different facts."** — Third instance of the same principle, in the Worker's voice. It is the reason /databases can say "Could not reach the database list" instead of showing nothing.
- **"UCLA tags one database as a trial and none as free, which makes this an inventory rather than an access map", and that all 1,365 description elements are empty "so the page shows names and links and does not pretend to more."** — The ancestor and the justification of the direction's required scope sentence "Listed, not searched." The /databases scope statement must link here.
- **The four resolver handlings, especially "They are dropped, not demoted: a reader has no use for a button that opens a catalogue", and "Access and route are kept separate… the button describes the link behind it rather than the paper in front of it."** — The second sentence is a claims discipline stated about a button — the same derived/looked-up separation the direction grafts for shelves. It generalises and should be cited, not deleted.
- **The LibCal date paragraph: today from local time because an ISO string "puts Los Angeles on tomorrow's row after 4pm", arithmetic in UTC because a DST day is 23 or 25 hours; and that from= and start= "fail silently by returning this week and looking like they worked."** — Silent-failure documentation. /hours must announce both outcomes out loud, and this is the paragraph the announcement's key terms link to.
- **The covers sentence — "the box says what it does: it sends the ISBN to openlibrary.org" — and default=false making a missing cover a 404 "so the image removes itself instead of leaving a grey box."** — Co-hosts the pinned signature openlibrary.org (with index.html). Naming the third party rather than saying "show covers" is the pinned property.
- **The jsDelivr entry: exact pinned versions, "checked against a hash of the reviewed bytes, so the CDN cannot hand this page different code", "Recognition runs in your browser and the images are never uploaded."** — Co-hosts two pinned signatures, in your browser and never uploaded. The supply-chain sentence is pinned by nothing and would vanish unnoticed.
- **The whole Google Fonts section, including "Google sees a request from your browser whether or not you go on to search for something" and "Serving the two files from this domain would end the request, and is the fix; until that is done it is counted here, rather than filed under what happens on demand."** — A page that discloses its own outstanding defect and refuses to file it under a softer heading. If the port self-hosts the fonts, this paragraph is rewritten to say so — it is not deleted, because the reader who read it once will look for it.
- **The privacy paragraph, in particular "The Worker sees the query because it has to forward it, and retains it only inside the cache key of a cached answer."** — The precise, checkable version of "no analytics, no cookies". Precision is the claim; a summary is a weaker claim wearing the same words.
- **"What this is not": not an official UCLA service, no access to your library account, cannot place holds, "It reads the same public endpoints anyone can read. When it is wrong about a shelf, the shelf is right."** — The refusal-to-claim paragraph the direction asks for already exists, in the author's voice, ending on the best sentence on the site.
- **The skip link's own wording, "Skip to the explanation", and the footer's disclaimer and "How to use this" label.** — class="skip" is pinned; the disclaimer is pinned and co-hosted on all seven pages; cohesion.test.js fails a second name for /about or /methodology. Also: the skip destination is worded for this surface rather than generically, which is the small thing a template rewrite flattens.
- **The <title>, meta description and og:description, all of which describe the page as an endpoint-by-endpoint account.** — If the page gains term anchors, the description must gain them too rather than being replaced; the current one is the only machine-readable statement of what this page is for.

## New claims, to be pinned before the page is written

- The partial-knowledge caption in spatial-3's form, quoted on this page as the anchored explanation of the boundary: "the level, row and side above are looked up; the ranges below are not."
- A sentence stating that unrecorded space is drawn hollow and labelled "not recorded", never "empty" — the drawing-side counterpart to the existing dash-versus-empty-shelf sentence.
- A sentence stating that a range past its verification interval prints no numbers and says so, rather than showing numbers nobody has checked since the last shift.
- A sentence stating the derived-versus-looked-up separation for the title path: the catalog supplied the call number, the survey supplied the shelf, and only the second is drawn.
- A sentence stating why no drawing appears on a refusal — there is no mark, and a plan with nothing filled asserts a place nobody looked up.
- A sentence stating that the tool refuses routes, step counts and sensors, and answers about the building rather than about the reader's body.

## Out of remit (G7): a person decides

- What the :target treatment for an arrived-at anchor looks like — the panel may require only that it not rely on hue alone (G7, and the direction's own constraint on the mark).
- Typeface for the staff code and for the term headings, and whether any of it is monospaced. The direction rules only that no web font may block paint; the face is taste.
- Whether the page keeps the name /methodology and the footer label "How it works" — listed in the direction's out-of-remit as brand and page-naming.
- The numeric verification interval for spine ranges and landmarks, who owns re-survey after a shift, and what happens operationally when a zone goes stale. The paragraph describes the mechanism; the cadence and the owner are a staffing decision.
- Which physical features on each level count as "verified fixed" landmarks and what each is called in the reader's words. The landmark paragraph on this page is empty until library staff walk the building and decide.
- Wording review of the new sentences this brief introduces — the partial-knowledge caption, the no-mark-no-drawing sentence, the interval sentence — by whoever wrote the existing prose. G4 permits rewording; the voice is a person's.

## Silences in the direction, raised not filled

- The direction says every legend word and refusal key term links to "its own anchored paragraph" but never enumerates the terms. It names index, row, side, level, staff code, landmark, mapped range, last verified, hollow/not recorded, derived versus looked-up, serial run, "Listed, not searched" and "LibCal did not answer" in passing across seven sections. Someone must ratify the list before the anchors are written, because METH-1 fails the build on any term that is printed and unanchored.
- It says nothing about the anchor ids themselves — whether they are stable across future rewrites, whether they are the term's slug, and what happens to a link in someone's notes when a paragraph is renamed. This page is now a link target with an implied contract and no stated versioning rule.
- It does not divide labour between /explainer and /methodology. /explainer is "the shelf vocabulary, what index counts from, and one worked example"; /methodology is "anchored paragraphs, one per term". Both are told to explain what index counts from. Under G5 (one vocabulary for the same thing) two surfaces cannot each own that sentence, and the direction does not say which does.
- It does not say whether the one sentence a pressable term opens on home is the same string as the first sentence of the corresponding anchored paragraph here. G5 argues yes; the direction is silent, and if the answer is no there are two definitions of "index" in the product.
- It does not say what returns a reader to their answer after they follow a link here. Nav is demoted below the answer and preserved (refusal 10), but a browser Back from a jumped-to anchor is not the same as returning to a marked crop, and nothing in the direction addresses the round trip.
- It does not say whether the endpoint record stays on this page, moves, or is superseded. METH-2 rules it stays on G4 grounds, but that is a brief reading a silence conservatively, and if the intent was a split the port should be told before it is written.
- On a twelve-stop route where several stops refuse, the direction does not say whether each refusal links its key terms independently — twelve copies of the same link — or whether the terms are linked once per page.
- It does not say what a term paragraph says when the product prints the term but has no data behind it on a given level (a landmark linked from a level with no verified fixed feature). The clause is absent on the fold per graft spatial-1; whether the anchor still exists and what it reads is unstated.

