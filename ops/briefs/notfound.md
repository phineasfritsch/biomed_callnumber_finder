# Brief: /404 (today /home/user/biomed_callnumber_finder/404.html)

Written from the frozen direction in `ops/DIRECTION.md`. Rulings are numbered so a code
comment can cite one six weeks from now by somebody arguing with it.

**The job.** Tell a reader who landed on an address that does not exist that nothing was found, in the same grammar the tool uses when no mapped shelf contains a call number, and hand them the one surface that would have helped — drawing nothing.

**The reader.** Two readers, one page. (a) Someone who followed a stale link from a bookmark, a LibGuide or an older version of this site and now suspects the thing they used has been deleted; they need to learn in one sentence that it moved, not that it is gone, and where to. (b) Someone who mistyped or was redirected mid-task while looking for a shelf; their clock is still running (G1) and the only thing they need is the fastest legible route back to the search field. Failing looks like: a blank or decorative error page that reads as "the site is broken", so the reader closes the tab and walks to the desk — or worse, a page that shows a floor drawing left over from a previous state, which asserts a place nobody looked up (Rule 2, refusal 3 of the direction).

## Rulings

### 404-1

No drawing appears on this surface, and no drawing-shaped hole either: no SVG floor plan, no empty frame, no reserved box, no skeleton, no placeholder sized to a crop.

*Because.* Binding rule 2 and the direction's refusal 3 ('It refuses to draw when it has no mark') plus G2. Nothing was looked up here, so any plan — filled, hollow or empty — asserts a place. A reserved empty box is the specific failure the direction names: at speed a blank reads as a page that failed to load.

*Caught by.* Assert 404.html contains no <svg> element other than the brand mark and no element whose class matches the crop/plan family used by index.html and map.html.

### 404-2

The refusal is a positive object made of prose: a heading that names the failure, a first line that names what was asked for and states nothing was found, and a named onward surface — never blank space, never a bare status word, never an icon standing in for the sentence.

*Because.* Binding rule 2 (a refusal renders as a positive object) and G5 (one grammar for failure across all seven surfaces). The unmapped-call-number refusal on home is a filled line; this must read as the same species of object.

*Caught by.* Assert the <main> of 404.html contains a heading and at least one sentence stating non-existence, and at least one in-page link to /.

### 404-3

The dash-voided value slot is NOT imported here. This surface has no staff-code slot, no mapped-range receipt and no evidence line, and the port may not fabricate one to look like the home refusal.

*Because.* Binding rule 2 voids the slots that an answer would have had; /404 answered no query, so it has no slots. G2 forbids asserting a lookup that never happened — an evidence line such as 'Checked 41 mapped ranges' would be a literal lie on this page. Symmetry of grammar is not symmetry of furniture.

*Caught by.* Assert 404.html contains no evidence-line string of the form 'Checked N mapped ranges' and no dashed value-slot markup.

### 404-4

Exactly one onward surface is offered as the primary route, and it is / (the search tool), named in a sentence. The four-item nav and the footer links remain but are not the offer.

*Because.* The direction's 404 entry: 'offers the one surface that would help'. Also G5 — the nav is the same nav as everywhere and is not permitted to become this page's answer.

*Caught by.* Assert exactly one link to "/" inside <main>, and that the site nav and footer are byte-identical in structure to the other surfaces.

### 404-5

The response is served with HTTP status 404, never a 200 soft error, and the page keeps <meta name="robots" content="noindex">.

*Because.* G2 — a refusal that reports success to the client is the same class of untruth as a mark drawn without a lookup. Static-files-plus-one-Worker means this is a serving-config claim, not a markup claim, so it has to be written down somewhere or it is lost in the port.

*Caught by.* curl -o /dev/null -w '%{http_code}' against a nonexistent path returns 404; grep the noindex meta.

### 404-6

This page loads no JavaScript and gains none. Whatever machinery the crop needs on / and /map does not ship here.

*Because.* G1 and the hard constraints (198 KB home, 53 KB stylesheet, 803 ms font cost on a 3.5 s first paint). This is the cheapest page in the product and the one most likely to be reached on a bad connection; it has nothing to compute.

*Caught by.* Assert 404.html contains no <script> element.

### 404-7

The skip link stays, keeps class="skip", and keeps its surface-specific text "Skip to the message" pointing at #main.

*Because.* G6 and the pinned claim skip-link-exists (signature 'class="skip"', which Tools/cohesion.test.js asserts on all seven pages). The wording is surface-specific on purpose — the target here is a message, not a result — and a normalising rewrite to "Skip to content" is the kind of edit that passes every test while flattening G5's vocabulary in the wrong direction.

*Caught by.* pins.test.js already fails on loss of class="skip"; add a check that the skip link's href resolves to an id present in the document.

### 404-8

The three claims currently in the body — the site's shape, what the search field accepts, and "nothing has been taken away; it has only moved" — may each be reworded, and whether any may be dropped to satisfy the direction's density note of "two sentences and a link" is escalation E-10.

*Amended (Stage 02b, after re-audit).* The ruling originally settled the collision by inventing a precedence rule the direction does not state: "where the density note and G4 collide, G4 wins". G4 is a ruling and the density note is frozen text, and nothing ranks them — so a brief cannot resolve the collision by declaring which of the two it prefers, however well it flagged that it was doing so. The claims and the density note both stand until the owner ranks them.

*Because.* G4: a refusal may be reworded, never removed. The direction's density line describes a target, not a licence to delete a stale-link caveat that exists because people arrive here from old links. Where the density note and G4 collide, G4 wins.

*Caught by.* Add three pins by signature: 'no page at this address', 'Nothing has been taken away', and one for the input-kinds sentence. Signatures capped at 90 chars per pins.test.js rule 1.

### 404-9

The page never names a specific removed feature, a guessed destination, or a redirect it did not perform; it states the general fact that content moved onto the surfaces in the nav.

*Because.* G2. Guessing which page the reader wanted and sending them there is the wrong-aisle failure in navigational form ('a wrong aisle is worse than none', pinned).

*Caught by.* Manual review; no automated check can catch a plausible-sounding wrong guess. Stated plainly.

### 404-10

The affiliation disclaimer in the footer stays on this page, as on every page.

*Because.* Pinned claim not-affiliated-with-ucla, whose why is explicitly 'On every page, deliberately.' A 404 is one of the pages most likely to be reached by someone who thinks they are on a UCLA Library site.

*Caught by.* pins.test.js searches the whole corpus, so the pin passes if it survives anywhere; add a per-file assertion in cohesion.test.js instead.

## Must survive the port

Read off the working page. These are what a rewrite deletes without noticing.

- **<title>Not here — Shelfmark</title> and the h1 "Not here".** — The tab title is the refusal for a reader with twelve tabs open. A generic "404" or "Error" replaces a sentence with a code.
- **meta description "That page is not part of Shelfmark." and meta robots noindex.** — Scope statement plus the instruction that keeps this page out of search results. A rewrite that copies the head from index.html silently drops the noindex.
- **Skip link with the text "Skip to the message" (class="skip", href="#main").** — G6 and a pinned claim; the wording is deliberately not "Skip to content" because the target is a message.
- **"There is no page at this address."** — The refusal itself — states plainly that nothing was found. Everything else on the page is support.
- **"Shelfmark is four of them, and they are all in the bar above."** — A scope statement: it bounds the product so the reader stops hunting for a fifth page. See silences — the count is asserted while the footer links to two further surfaces.
- **The sentence naming what the one field accepts: a call number finds the shelf, a title searches UCLA's catalog, a DOI finds who carries the full text.** — This is the only orientation a reader gets before landing on /. It also carries the derived/looked-up distinction in miniature (a title goes to the catalog; a call number goes to the shelf) and stops a DOI-holder concluding the tool is not for them.
- **"If you followed a link from somewhere and it landed here, it was probably a link to an older version of this site, which had a different shape."** — Names the actual likely cause instead of blaming the reader. This is the caveat a redesign deletes as chatter.
- **"Nothing has been taken away; it has only moved onto one of the four pages above."** — The load-bearing reassurance for reader (a). Without it a stale link reads as a discontinued feature and the reader stops returning.
- **nav aria-label="Sections" with Search / Map / Hours / Databases in that order, and the footer's three links (How to use this · How it works · Back to the tool).** — G5: one nav, one footer, one vocabulary. "Back to the tool" is the same name for / that the body paragraph uses ("the tool"); the two must stay in step.
- **The footer byline and "Not affiliated with, or endorsed by, the UCLA Library."** — Pinned. Provenance and authority, on every page deliberately.
- **Zero scripts; fonts loaded non-blockingly with a <noscript> fallback stylesheet.** — The noscript link is the only reason a scriptless reader gets the typeface at all, and the print-media swap is what keeps the 803 ms font cost off the critical path. A tidy-up that "simplifies" the three font lines into one blocking <link> is a measurable regression on the slowest page's cheapest visit.
- **The brand link wrapping the mark and the tagline "the book, then the aisle" as a single link to /.** — A second, redundant route home that costs no fold and is already in tab order.

## New claims, to be pinned before the page is written

- No new copy is introduced. Three sentences already on the page are newly PINNED by this brief and need signatures added to Tools/pins.test.js before the port: 'no page at this address' (the refusal), 'Nothing has been taken away' (the moved-not-removed caveat), and a ≤90-char fragment of the input-kinds sentence.
- A negative pin, if the suite supports one: 404.html must contain no evidence-line string of the form 'Checked N mapped ranges' and no floor-plan SVG (404-1, 404-3). pins.test.js as written only asserts presence, so this needs a new assertion kind or a check in cohesion.test.js.
- A serving-config assertion that a nonexistent path returns HTTP 404 (404-5). Nothing in the current test tooling covers response status.

## Out of remit (G7): a person decides

- Palette: the light-only color-scheme and theme-color #f3efe4. G7 — goes to a person.
- Typeface: Fraunces and Spline Sans Mono, and the weights loaded. The loading STRATEGY is ruled above on performance grounds (404-6, preserved item 11); which faces are chosen is not.
- Brand: the stack-and-bookmark favicon/mark SVG, the wordmark, and the tagline wording "the book, then the aisle".
- Tone and register of any reworded refusal. The direction's own open work item requires wording review of every refusal, caveat and scope sentence by whoever wrote the originals; this brief rules what must be said, not how it sounds.
- Whether the h1 should be "Not here" or another equally short phrase — a naming question, not a structural one, provided 404-2 is satisfied.

## Silences in the direction, raised not filled

- The direction says the 404 'names what was asked for', but this is a static file with no script (404-6) and the requested path is only knowable server-side. The direction does not say whether the literal path must be echoed (as home echoes the query) or whether the class noun "this address" satisfies it. This brief keeps today's wording and flags the gap; if echoing is wanted it has to come from the one narrow Worker, escaped and inert, and someone must rule that.
- The direction's density note for /404 is "Two sentences and a link", but the live page carries three paragraphs including a stale-link caveat. The direction does not say which yields. 404-8 resolves it for G4, but a person should confirm that reading rather than inherit it from me.
- Layer 7 requires every key term in a refusal to link to its own anchored paragraph in /methodology. The direction does not say whether that applies to a navigational refusal, which contains no shelf vocabulary. This brief adds no such links; if the rule is meant to be universal, someone must say what the anchor targets would be.
- "Shelfmark is four of them" counts the nav, while the direction describes seven surfaces and this page's own footer links to /about and /methodology. The direction does not say whether the count is a claim about the nav or about the product. Reworded carelessly it becomes false; deleted, a scope statement is lost.
- HTTP status and the host's 404 wiring are not addressed anywhere in the frozen direction. 404-5 rules it from G2 rather than from the direction, and it is flagged here because it is an infrastructure decision, not a markup one.
- Whether /404 is in scope for the cohesion suite's "seven pages" is asserted in a pins.test.js comment but not by the direction. It matters because the skip-link and nav guarantees hang off that count.

