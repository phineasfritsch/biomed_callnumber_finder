# Catalog lookup (Alma SRU) — what the endpoint actually does

Companion to [`README.md`](README.md). The shelf map answers *"where is this call number?"*;
this answers *"do we have this book, and which edition is newest?"* and then hands the call
number to the map.

Everything in §1 was measured against the live endpoint on **2026‑08‑05**, not taken from
vendor documentation. Re-run the probes if Alma is reconfigured — several answers here are
institution-specific and none of them are contractual.

> Three findings from the 2026‑08‑05 round reversed earlier conclusions: the CQL `sortBy`
> *clause* works even though the `sortKeys` *parameter* is ignored; trailing `*` truncation
> works after all; and roughly two hundred `alma.*` indexes are usable as filters, including
> the one that finally makes "only what is in this building" a server-side question.

---

## 1. Endpoint findings

```
https://ucla.alma.exlibrisgroup.com/view/sru/01UCS_LAL
```

| Question | Answer | How it changes the design |
| --- | --- | --- |
| **CORS** | `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET` | **No proxy needed.** The browser calls Alma directly; there is no Worker, no server, no API key. This was flagged as a v1 blocker and it is not one. |
| **Auth** | None sent, none required | — |
| **Indexes** | `operation=explain` lists **437** `alma.*` indexes ([`fixtures/explain.xml`](fixtures/explain.xml)) | — |
| **`alma.author` / `alma.subject`** | Do **not** exist | Author search uses `alma.creator`; subjects are `alma.subjects`. |
| **`alma.all_for_ui`** | Exists. `alma.all_for_ui="phrase"` returns **0**; `alma.all_for_ui all "words"` works | Keyword mode must use the `all` relation. Quoting it silently returns nothing, which reads as "not held". |
| **`alma.title` / `alma.isbn`** | Both work with `=` and a quoted phrase | Title mode is an exact phrase; keyword mode is looser. The UI says so. |
| **Default page size** | 10 | |
| **`maximumRecords`** | Honoured to **50**; asking for 100 silently returns 50 | `PAGE = 50`, and "load more" pages with `startRecord`. |
| **`startRecord`** | Works. Past the end of the result set it returns 0 records, not an error | Paging needs no guard beyond `loaded < total`. |
| **Booleans** | `and` works (`alma.title="…" and alma.creator="…"`) | Available if v2 wants it. |
| **Truncation `*`** | **Trailing only, and it works**: `alma.all_for_ui all "cardio*"` → 11 017 against `alma.title="cardiology"` → 1 104. Leading `*` is ignored (`"*cardiology"` returns exactly what `"cardiology"` returns) and infix is dead (`"card*logy"` → 0) | Trailing `*` is passed through untouched and documented in the syntax panel. Nothing pretends `*word` or `car*logy` does anything. |
| **Parentheses** | Three rules, all unwritten. A parenthesised **single** clause is `Invalid query`. A parenthesised clause using the **`all` relation** returns **0 records, with no diagnostic**. A parenthesised **OR group of two or more** simple clauses is fine anywhere | The CQL builder never wraps one clause, and always emits the free-text `all` clause bare and first. The silent-zero case is the dangerous one: it reads at the desk as "the library does not have it". |
| **`not`** | Works, and may follow any number of `and` clauses | Negation (`-lang:eng`) is appended after every positive clause and before `sortBy`. |
| **`maximumRecords=0`** | Returns the count with no records, in ~200–900 ms | Used for the probe scripts; cheap enough to sweep candidate values with. |
| **`sortKeys`** | **Accepted and ignored**, whatever you pass it | Do not use it. It is a silent no-op, which is why the earlier round concluded sorting was impossible. |
| **CQL `sortBy` clause** | **Works.** `… sortBy alma.main_pub_date/descending` really does reorder the result set, and paging through it is stable and duplicate-free across `startRecord` | **Newest-first is a server-side sort.** It matters most when the result set is bigger than the pool: the 150 records ranked are then the *newest* 150, not an alphabetical slice. |
| **Sortable indexes** | Exactly three: `alma.main_pub_date`, `alma.title`, `alma.creator` (the ones marked `<index sort="true">` in `explain`). Any other index in a `sortBy` is rejected outright | The sort menu can offer newest / oldest / title / author and nothing else server-side. Shelf order is computed locally. |
| **Result order without `sortBy`** | Filing-title alphabetical. There is no relevance ranking at all | **All ranking is client-side.** See §3 — still the single most consequential finding. |
| **Response time** | 0.5–3 s typical; ~3–7 s at `maximumRecords=50` | One request in flight at a time; two backed-off retries (500 ms, 1.5 s) then a visible failure. |
| **Rate limits** | Undocumented; nothing observed at this volume | Assume they exist — hence the single-flight + backoff above. |
| **Availability enrichment** | Confirmed on. `AVA` (physical) and `AVE` (electronic) ride along with the bib | One request returns bib + holdings + call number + availability. |

## 2. Data findings

**`$e` / `$f` / `$g` are per holding, not per bib.** Verified on a Harrison's bib whose two
`AVA`s report different totals. `check_holdings` arrives with `$f`/`$g` absent, so the UI
renders "Multiple volumes — check at the desk" and never invents a count.

**`$k` is not a reliable gate.** The brief expected every Biomed holding to be `$k=2` (NLM).
It is not: `bi` holdings appear with `$k=0` carrying LC-shaped numbers such as
`BF789.D4 K16a 2005` and `HV245 .R662r 1998`. Those books *are* in the Biomed sequence —
NLM adopts LC classes for non-medical subjects, and the shelf map already covers `BF`, `QL`,
`QH`, `HM`, `PE` on level 11. **Routing is therefore by library + `$j`, never by `$k`.**

**Biomed `$j` location codes.** Four were known; live sampling of ~300 Biomed holdings found
five more. All nine are in the routing table:

| `$j` | `$c` | Routing |
| --- | --- | --- |
| `bi` | Biomed Library | **stacks → shelf lookup** |
| `biper` | Biomed Stacks; Current issues in Current Journals | **stacks → shelf lookup** |
| `biprwt` | Biomed Stacks Building Use; Current issues in Current Jrnls | **stacks → shelf lookup** |
| `bian` | Biomed:Search the Series to see current Location of volumes | **stacks → shelf lookup**, with a caveat shown |
| `birf` | Biomed Reference | Floor 4, no per-shelf map |
| `birs` | Biomed Reserves | Ask at the Circulation Desk |
| `bicidperm` | Biomed Circulation Desk Permanent Reserves | At the desk |
| `bicimm` | Biomed Circulation Desk Media | At the desk |
| `biherb` | Biomed Herbarium | Ask at the desk |

**Those nine codes are also a server-side filter, and that is what makes the default work.**
`alma.permanentPhysicalLocation` accepts each of them and narrows the result set
(`bi` 135 980 · `bian` 22 698 · `birf` 3 409 · `bicidperm` 831 · `bicimm` 332 · `biherb` 299 ·
`biprwt` 111 · `biper` 41 · `birs` 2). `alma.itemPhysicalLocation` and `alma.current_Location`
return identical counts and are the same index by another name.

**Every library-shaped index is dead.** `alma.itemLibrary`, `alma.holding_Library`,
`alma.rep_Library` and `alma.current_Library` all answer a query for `BIOMED` — and for
`Biomed`, `biomed`, `BIO`, `BM` and `"Biomedical Library"` — with zero records. There is no
way to ask "at Biomed" except by enumerating the nine `$j` codes, so a *scope* in this app is
literally an OR of location codes and nothing more.

This list is still **empirical, not authoritative** — it is what a sample happened to contain.
An unlisted `bi*` code falls through to "this Biomed location is not in the routing table yet —
ask at the desk" and is never given a shelf. Getting the real location table from Library IT
remains worth doing; the failure mode without it is now visible rather than silent.

**Coverage.** Of ~291 sampled Biomed *stacks* holdings, **98 % resolved to a shelf**; the 2 %
that did not are genuine gaps in the map (mostly `QV`, plus one `W1`). One such gap is pinned
as a test: the dataset jumps from `WJ 348 C616` (level 10) to `WJ 752 P968` (level 8), so
`WJ 752 M2673 2004` — a real Biomed holding in the fixtures — correctly reports *range not
mapped* instead of being rounded to a neighbour.

The brief said levels 5, 7 and 8 were mapped. The dataset in this repo actually covers
**1, 2, 3, 5, 6, 7, 8, 9, 10, 11** (453 shelf faces), which is why coverage is as high as it is.

## 3. The default: newest edition, in this building

Everything the desk does fifty times a day is one question — *do we have this book, and
where is the current edition?* — so that is what a bare search does, without being asked:

1. **Scoped to Biomed.** The query goes out ANDed with an OR of the nine `$j` codes, so the
   result set is what is in this building, counted correctly, before anything is ranked.
2. **Sorted newest-first at the server** with `sortBy alma.main_pub_date/descending`. This
   only shows when the result set exceeds the 150-record ranking pool — but then it decides
   whether the pool is the newest 150 or an arbitrary alphabetical slice.
3. **Ranked locally** (§3.1), then **grouped by edition** (§3.2), newest printing on top.
4. **Widened only if it has to.** Nothing at Biomed → retry across UCLA and say so.

**Widening also fires when the scoped result is *bad*, not just empty.** A search for
*atlas shrugged* matches exactly one Biomed record — on a stray keyword, not on the title —
and that single hit would otherwise stop the widening dead and answer a question nobody
asked. So when the best score in scope is below the "the title matched at all" threshold, one
cheap 10-record probe goes out to the wider scope and is taken only if it scores materially
better. The status line always names which scope the answer came from, and why.

Scopes are `biomed` (all nine codes, the default), `stacks` (the four walkable ones),
`reference`, `desk` and `ucla`. `at:` in the query box overrides the pills, and an explicit
`at:` is treated as an instruction — it disables widening entirely.

### 3.1 Relevance — all of it local

**The endpoint does no ranking whatsoever.** Without `sortBy` it returns hits in filing-title
order: a keyword search for *atlas shrugged* hands back *The American Bible*, *Answer to Ayn
Rand*, *The art of fiction*, and only then *Atlas shrugged*. `sortBy` fixes the *order* but
knows nothing about the *query*. So scoring is entirely local.

**Scoring.** The whole title matching exactly is worth far more than the main title matching
with a subtitle attached, which is worth more than merely containing the query — so *Atlas
shrugged* beats *Atlas shrugged : manifesto of the mind* beats *Ayn Rand's Atlas shrugged : a
philosophical companion*. On top of that ladder:

- **Rare words decide.** Word coverage is weighted by inverse document frequency computed
  over the pool that was actually fetched. Unweighted, "medicine" — in a large fraction of a
  medical library's titles — counts for exactly as much as "harrisons", which is in almost
  none. The df comes from the pool rather than the catalogue because that is what is on hand
  and it costs no extra request; it is enough to separate the distinctive words in a query
  from the filler. A word that matched fuzzily is weighted by the rarity of the word it
  *matched*, not of the typo.
- **Word order counts.** The longest run of query words appearing contiguously and in order
  earns up to 22 points. "principles of internal medicine" buried in a thirty-word title is a
  signal a bag of words cannot see.
- **Length is penalised smoothly**, `26 x extra/(extra+7)`, rather than 2 points a word up to
  a flat cap. The old shape punished a six-word subtitle as hard as a thirty-word one.
- **Small physical tiebreaks.** A Biomed copy is worth 12; a copy that actually resolved to a
  shelf face is worth another 6. Both are tiebreaks between near-equals and neither can beat
  a materially better title match — there is a test that says so.

**The author trap, generalised.** The author field only earns credit for query words the
*title did not already contain*. Without that rule, searching "harrison's principles of
internal medicine" gives every printing that happens to carry a MARC 100 for Tinsley Harrison
a bonus the 2018 edition (which has no 100) can never make up, and the newest edition lands
sixth. The same residual rule is what now lets **series, subject, uniform title and
publisher** contribute at all: "cardiology lange" finds the Lange series, "atlas shrugged
rand" still finds Rand, and none of them can reorder the printings of one book.

**Spelling.** There is no fuzzy search and no "did you mean", so:

- Word matching tolerates edits scaled to word length — none at three letters, one up to six,
  two beyond. `wtlas` matches `atlas`; `cat` does not match `bat`.
- When a query returns *nothing*, words are dropped and the query retried: one at a time
  first, then pairs from among the four longest words. Each retry is one cheap 10-record
  probe, and the **best** retry wins — judged by how well its top hit scores against what was
  originally typed — rather than the first one that returns anything.
- The winning relaxation is then **narrowed back down through the scope chain**, so a
  misspelt title whose book *is* at Biomed comes back as a Biomed answer rather than an
  all-of-UCLA one. `harrisons principals of internal medicin` (three typos, two of them real
  words) recovers via `harrisons of internal` to 21 Biomed records, with the 20th edition on
  top and a shelf under it.

**The limit worth knowing.** A real-word typo cannot be *detected*, only routed around —
"principals" is a word, and the catalog has books about principals. Correcting it in place
would need a spelling dictionary this app does not carry.

**Ranking pool.** Up to 150 records (3 pages) are pulled before anything is scored. With
`sortBy` in play those are the newest 150 rather than the alphabetically first 150, which is
the right 150 for "what is the current edition". Past that the status line says how many were
ranked and "load more" keeps browsing.

### 3.2 Edition clustering

§7 used to list work-level clustering as deliberately not built. It is built now, locally and
conservatively: records are grouped by their **full normalised 245 (`$a` plus `$b`)**, the
newest printing represents the group, and the rest fold behind "*N* earlier printings".

Clustering on the full title rather than on `$a` alone is the whole trick. Every edition of
Harrison's from 1970 to 2025 carries `245$a` = *Harrison's principles of internal medicine*
with an empty `$b`, so they collapse into one card — while the *companion handbook*, the
*PreTest self-assessment* and the *board review* keep their own `$b` and stay the separate
books they are. Author is deliberately **not** part of the key: the printings that carry a
MARC 100 for Tinsley Harrison would split away from the ones that do not, which is exactly
the group that has to stay together.

A cluster inherits its best member's score, so grouping never changes which book wins — only
how many rows it takes to say so. `editions:all`, or the **Group editions** checkbox, turns
it off. Under `sort:oldest` the *oldest* printing leads its cluster instead: a list ordered
oldest-first whose every row is the newest printing of something answers no question at all.

A title search for Harrison's is 21 Biomed records and 6 cards, the first of which is the
2018 20th edition with `WB 115 H322 2018` on level 10 and fourteen earlier printings folded
underneath.

### 3.3 Sorting

| Mode | Server `sortBy` | Then, locally |
| --- | --- | --- |
| Best match (default) | `main_pub_date/descending` | score, then newest |
| Newest / Oldest | `main_pub_date/descending` / `ascending` | year, then score |
| Title / Author A–Z | `title/ascending` / `creator/ascending` | cluster key / MARC 100 |
| Shelf order | `main_pub_date/descending` | level, then `cmpCN` — a real walk |

Shelf order is the one the endpoint cannot do at all: it needs the shelf map and the decimal
Cutter comparator. `cn:"WM 100" at:stacks sort:shelf` returns 521 records and walks them in
the order you would pull them off level 8.

### 3.4 The filter vocabulary

Several hundred `alma.*` indexes answer queries; these are the ones probed to actually narrow
a real result set, and they are the whole vocabulary the query box accepts.

| Token | Index | Notes |
| --- | --- | --- |
| `title:` `author:` `subject:` | `alma.title` `alma.creator` `alma.subjects` | `alma.author` does not exist; it is `creator`. |
| `mesh:` `lcsh:` | `alma.mesh` `alma.lcsh` | MeSH is the useful one in this building. |
| `series:` `genre:` `uniform:` | `alma.series` `alma.genre_form` `alma.uniform_title` | `genre:atlases`, `genre:handbooks`. |
| `publisher:` `place:` `note:` | `alma.publisher` `alma.publisher_location` `alma.notes` | |
| `isbn:` `issn:` | `alma.isbn` `alma.issn` | Punctuation stripped before sending. |
| `cn:` `nlm:` `lc:` | `alma.PermanentCallNumber` `alma.nlm_call_number` `alma.lc_class_number` | Class browsing. Range relations (`>=`) on `PermanentCallNumber` **error**, despite `explain` advertising them. |
| `lang:` | `alma.language` | By name or MARC code; `lang:spanish` becomes `spa`. |
| `year:` `after:` `before:` | `alma.main_pub_date` | `>=`, `<=`, `>`, `<` all work, so `year:2010..2020` compiles to two clauses. |
| `type:` | `alma.type_of_record` + `alma.bib_level` | leader/06 and /07. `a`+`m` book, `s` journal, `g` video, `i`/`j` audio, `c` score, `e` map, `m` software, `t` manuscript, `k` image, `p` mixed. |
| `material:` | `alma.materialType` | Item level: `BOOK` `ISSUE` `ISSBD` `DVD` `CDROM` `MAP` `MICROFORM` `SCORE` `RECORD` `MIXED` `OTHER`. |
| `loc:` `at:` | `alma.permanentPhysicalLocation` | See §2. |

**Offered by `explain`, useless in practice** — each answers a query and returns zero for
every value tried, which is worse than not existing, so none of them is in the UI:
`alma.mms_resource_type` (all of `Book`, `Journal`, `Article`, `Dissertation`, `Video`,
`Map`, `Other` and a dozen more), `alma.audience` (all of `a`–`j`), and every `*_Library`
index.

`shelf:`, `level:`, `avail:`, `online:` and `editions:` are **not sent to the endpoint** —
they are facts about the shelf map and about the fetched pool, applied here. Because they
filter the pool rather than the query, the count they act on is the ranked pool, and the UI
says how many records they removed rather than pretending the catalogue is smaller than it
is.

Every control in the Filters panel compiles to exactly one of these tokens and the compiled
string is echoed above the results. A filter that narrows the answer silently is
indistinguishable, at the desk, from a gap in the collection.

### 3.5 Carrier: a recording is not a newer edition of a book

UCLA's newest "edition" of *Atlas Shrugged* is a 2022 Blackstone Audio recording, and until it
was looked at, the app said so. It is worth writing down exactly why, because the record gives
no honest field to read:

```
leader/06      a          language material
007            (none)
336 / 338      (none)
245 $h         (none)
300            (none)
250 $a         Unabridged.
260 $b         Blackstone Audio, Inc., and Buck 50 Productions, LLC
590 $a         info:sid/primo.exlibrisgroup.com-overdrive
AVA $b         RES_SHARE      $j OUT_RS_REQ      $q Resource Sharing Library
```

It is an OverDrive brief record. Every field designed to say "this is a sound recording" is
either absent or says the opposite, and `type:book` — which asks Alma about leader/06 — keeps
it. So carrier is decided locally, by a ladder of six signals, strongest first:

1. **007/00**, and **only the first 007**. The field is repeatable and the ones after the first
   describe *accompanying material*. Harrison's 19th edition is a two-volume printed book with
   a DVD-ROM in the pocket: `007#1 = ta` (text, regular print), `007#2 = vf`. Reading all of
   them called the book a video and split it out of its own edition cluster.
2. **leader/06**, for the values that are decisive (`i` `j` `g` `c` `d` `e` `f` `k` `m` `r` `p`).
3. **RDA 336 + 338**: "text" in a "volume" is a book, and nothing in the 300 can argue with it.
4. **338 / 336 / 245 $h / 300 $a phrases** — "sound cassette", "videodisc", "microfilm reel".
   `dvd` is matched with `(?!-?rom)`, because a DVD-ROM is data in a back pocket, not a film.
5. **`Unabridged` beside a publisher named for what it makes.** Both halves are required:
   "Unabridged" alone is an ordinary print edition statement, and a publisher with "Sound" in
   its name proves nothing by itself. This is the rung that catches the record above.
6. **AVE with no AVA** — online only.

The carrier is part of the cluster key, so the recording forms its own group instead of
crowning itself the newest edition of the novel; it is shown as a chip on the card, before the
year rather than after the walk; and print gets a +10 ranking nudge, because the unqualified
question at a physical desk is about a book. That nudge is uniform under an explicit
`carrier:` filter, so it costs nothing when the recording is what was wanted.

`carrier:print` is the reliable way to exclude recordings — `type:book` is not, for the reason
above.

**`RES_SHARE` is not a copy.** That AVA is a resource-sharing *request placeholder* on a record
UCLA does not hold. Rendering it as "held at Resource Sharing Library" invents a building, so
it routes to its own `phantom` kind and says what it is.

## 4. Cover images

Jacket art comes from **Open Library**: `covers.openlibrary.org/b/isbn/<isbn>-L.jpg?default=false`.
(`-L` is the large file, around 500 px wide. `-M` is 180 px, which was visibly soft once the
covers were displayed at a useful size — same request, same one ISBN.)
Keyless, CORS-open, and with `default=false` it returns 404 rather than a placeholder — so a
missing cover removes its own element instead of leaving a grey box. ISBNs come from MARC 020
`$a`, which carries qualifiers (`9780071802154 (hardcover)`), so only well-formed 10- or
13-digit values are kept.

This is the only third-party request the app makes. It carries the ISBN and nothing else, it
is per-image and lazy, and the **Show covers** checkbox turns it off. Syndetics and Bowker
were not considered — both need a license.

## 5. The join, and how it refuses

`resolve()` in the catalog module is the only place a patron is pointed at a shelf. It declines
in five distinct ways, each of which is rendered rather than swallowed:

| `reason` | When | Shown as |
| --- | --- | --- |
| `not-stacks` | `$j` is a desk/reference/offsite code, or the library is `RES_SHARE` | The location message for that code |
| `media` | `$d` starts with `DVD`, `CD-ROM`, `MICROFILM`… | "Media copy — held at a service desk" |
| `no-call-number` | `$d` was only a `[Barcode:…]`, or empty | "No call number on this holding" |
| `unparseable` | Survived stripping but is not a call-number shape | "Could not be parsed with confidence" |
| `unmapped` | Parsed fine, no mapped range contains it | "Range not mapped" |

Ordering is by the **year parsed out of `AVA $d`**, not by the call-number string and not by
MARC 250. Harrison's reassigns its Cutter from `H248p` to `H322` in 2015, so string order is
chronologically wrong; and the year is read only from tokens *after* the class number, so a
large class number can never be misread as a year.

Call numbers always come from `AVA $d`, never from MARC 050/060 — the fixtures contain a bib
where 060 says `WJ 752 P96665` and the item says `WJ 752 P9665`. The spine follows the item.

## 6. Tests

```bash
node Tools/catalog.test.js      # 341 assertions, no network
```

The harness extracts the `catalog-core` block and the comparator **verbatim out of the built
`index.html`** and runs them against two saved SRU responses in [`fixtures/`](fixtures/). The
other tools in this repo each keep their own copy of the comparator and those copies drift;
this one cannot, because a passing run is a statement about the file that ships.

Fixtures: `focused-ultrasound.xml` (11 records — NLM/LC split, `AVE` electronic, the 060-vs-AVA
discrepancy, the `WJ` gap) and `harrisons.xml` (27 records — every Biomed sublocation, the
Cutter transition, `check_holdings`, media prefixes, barcode-only call numbers).

The three endpoint rules in §1 that fail *silently* rather than loudly are each pinned as an
assertion about the string the builder emits — the keyword clause leads, nothing wraps a
single clause, a multi-code scope is one OR group — because the symptom of getting any of
them wrong is an empty result page, which looks exactly like a book the library does not own.

Two throwaway harnesses were used to establish §1–§2 and are not part of the repo: a probe
sweep over candidate indexes and values (`maximumRecords=0`, which returns the count alone in
under a second), and a replay that pulls `catalog-core` out of the built `index.html`, builds
the CQL for eighteen realistic queries, and fires each at the live endpoint to confirm none is
rejected. Re-run something like the latter after touching `buildCQL`; the unit tests can only
prove the string is what was intended, not that Alma accepts it.

## 7. Deliberately not built

**Real FRBR clustering.** §3.2 clusters on the normalised full title, which is a heuristic,
not a work identifier. It holds up well on the case that matters — 33 printings of Harrison's
collapse correctly while its three companion volumes stay separate — but two genuinely
different books that happen to share a `245` will be merged, and a printing whose subtitle was
transcribed differently will split off. Primo's `/primaws/rest/pub/pnxs` exposes a real
`frbrgroupid`; that is the upgrade path, and it is a different endpoint with different terms.

**Server-side relevance.** There is none to have. `sortBy` orders by date, title or creator
and by nothing else, so a query-aware ordering has to be computed over a fetched pool, and the
pool is capped at 150 records. For a query matching thousands, the best match can in principle
sit outside the pool — mitigated by the newest-first server sort and by scoping to Biomed
first, but not eliminated.

**A spelling dictionary.** Real-word typos are routed around, never corrected (§3.1).

**Facet counts.** Alma will answer `maximumRecords=0` in well under a second, so a live count
per filter value is affordable in principle; it would mean one request per facet per keystroke
and it was not worth the request budget against an endpoint whose rate limits are undocumented.

Also out: real-time due dates and item-level status (needs the Alma Items REST API and a key),
holds/requests, and patron accounts.
