# Biomed Stacks · Call-Number Finder

A single-page web app that turns a **call number into a physical shelf** in a biomedical
library's closed-ish stacks — turns **a photo of a pull list into an efficient walking route**
through the building, and (new) turns **a book title into that shelf**, by asking the catalog
first.

It is built from a hand-verified dataset of shelf-end labels: someone photographs the range
labels on the ends of the physical shelves, those labels are transcribed and validated into one
JSON file, and that file is baked into the app — a careful map of where every call-number range
actually lives. There is still no server and no database of our own; the catalog lookup is the
browser talking straight to UCLA's Alma SRU endpoint, which needs no key.

> Deployed as a static site on **Cloudflare Workers** (see [`wrangler.jsonc`](wrangler.jsonc)).
> The entry point is [`index.html`](index.html).

---

## What it does

### 1. Locate a call number
Type a call number (or paste a whole catalog page — it extracts the call number for you) and the
app finds the exact shelf face whose range contains it: **level → row → column index → side**, and
highlights it on a floor plan.

The hard part is sorting. These call numbers are **not** plain text:

- The digits after a Cutter letter group are a **decimal fraction**, so `AM4733` (.4733) sorts
  *before* `AM477` (.477). Sorting them as integers or as text gets the wrong shelf.
- Two schemes coexist and one parser handles both: the **W1 serials** scheme (`W1 AM477`, levels
  1–7) and the **NLM** scheme (`WM 13 D5537`, `WL 102.8 N398`, levels 8/10/11).

The comparator (`parseCN` / `cmpCN` in [`index.html`](index.html)) is the JS twin of the Python
comparator documented in [`Instructions.txt`](Instructions.txt) §2.

### 2. Plan a pickup route  *(new)*
Open the **"Plan a pickup walk"** panel and upload photos of your **ILL slips / pull list** (or just
type the call numbers in). Text recognition runs **entirely in your browser** ([Tesseract.js],
loaded on demand from a CDN — nothing is uploaded to a server), fills an **editable list** of
detected call numbers, and you correct it before building. Then the app locates each one and
produces a **strategic, ordered walk** that minimizes how far you travel:

- It groups your books **by floor** and orders the floors **top-down**.
- **Stairs go down exactly one floor** (there are two stairwells per floor — west ≈ column 6.5,
  east ≈ column 13.5) — so descending one level at a time uses the nearer stairwell, the quick move.
- For any other vertical move (going up, or skipping floors) the **elevator** is fastest.
- Within each floor it sweeps across the stacks once instead of backtracking, entering/leaving near
  the stairwell or elevator you'll actually use (a 1-D interval-cover from the entry portal to the
  exit portal).

**Special Collections is not in the walk.** Level 9 is a second, parallel sequence whose
seventeen shelf faces run `A` to `ZWZ 330`, so it contains nearly every call number in the
building. The trip planner used to search it alongside the general stacks and then take the
lowest-numbered floor, which sent **every** book whose real home was level 10 or 11 to level 9
— 98 of the 436 mapped faces, i.e. all of both floors. The call number on screen was right and
only the floor was wrong, so it read as a bad scan. The catalog lookup had always excluded
level 9; the planner does now too, in the web app and in the iOS port, and the iOS golden
vectors were regenerated (188 of 653 locate cases moved off level 9, and a further 84 changed
because the generator resolved same-level seam ties by raw JSON order while the app and the
Swift port both use `(level, key)`).

The route is **deterministic and explainable** — OCR only fills the list of call numbers; the
walking plan is computed from the shelf map and the building's stair/elevator geometry. Because
browser OCR is imperfect (especially on handwriting), the editable list is the real interface — the
recognizer is just a head-start. Tap any floor in the itinerary to jump the floor plan to it.

**Mobile & iPhone:** the whole site is responsive (the floor plan becomes horizontally
scrollable so shelves stay tappable). There's a **"Take photo"** button that opens the phone
camera directly, and **HEIC/HEIF** photos from iPhones are converted to JPEG in-browser (via
[heic2any], lazy-loaded) before recognition — `<canvas>` can't decode HEIC, so this conversion is
what makes iPhone uploads work at all.

### 3. Find a book in the catalog  *(new)*
Open the **"Find a book in the catalog"** panel and search by title, author or ISBN. This
answers the question a patron actually asks at the desk — *"do you have this book, and what's
the latest edition?"* — instead of making them translate it into a call number first.

One unauthenticated `GET` to **UCLA's Alma SRU endpoint** returns bib records with holdings
already attached, so every UCLA copy comes back in a single request, grouped by library. The
endpoint sends `Access-Control-Allow-Origin: *` (verified), so the browser calls it directly:
still no server, no API key, nothing to deploy but the static file.

Copies in the **Biomed general stacks** are then run through the same comparator the
call-number search uses and resolved to a real shelf face — tap the result and the floor plan
jumps to it. Everything else is labelled honestly rather than guessed at: Reserves and the
Circulation Desk say *ask at the desk*, Reference says *floor 4*, SRLF and Special Collections
say *offsite, not walkable*. **A holding is never shown a shelf derived from a call number
that didn't fully parse** — a wrong aisle is worse than no aisle, so the app says *range not
mapped* instead.

**The default is the desk question: the newest edition of this book, in this building.**
A bare search is scoped to Biomed's nine location codes and sorted newest-first *by the
server*, then ranked and grouped here. It widens to the rest of UCLA only when Biomed has
nothing — or when what Biomed has clearly isn't the book, which is a different failure and
gets a different message. The status line always names the scope the answer came from.

**The catalog itself ranks nothing.** Alma SRU returns hits in filing-title order, so a search
for *atlas shrugged* comes back with *The American Bible* first and the actual book fourth.
The `sortKeys` parameter is accepted and silently ignored. (The CQL `sortBy` *clause* does
work — that is what supplies newest-first — but it orders by date, title or creator and knows
nothing about the query.) So the app does its own:

- **Best match first.** A title that *is* the query beats one that merely starts with it,
  which beats one that merely contains it. Word coverage is weighted by how rare each word is
  in the pool, so "harrisons" outweighs "medicine" instead of tying with it; words appearing
  contiguously and in order score higher than the same words scattered; and long titles are
  penalised on a curve rather than at a flat cap. Author, series, subject and publisher only
  count for words the title didn't already explain — otherwise the printings carrying a MARC
  100 for Tinsley Harrison outrank the 2018 edition of his own textbook, which has no 100.
- **Then newest edition first**, and editions are **grouped**. Every printing of one book
  folds into a single card led by the newest, with the earlier ones behind a disclosure — a
  Harrison's search is 21 Biomed records but 6 cards. Grouping is on the full 245, so the
  *companion handbook* and the *board review* stay the separate books they are.
- **A recording is not a newer edition.** UCLA's newest *Atlas Shrugged* is a 2022 audiobook
  whose record says "language material" in every field designed to say otherwise. Carrier is
  worked out from six MARC signals instead of one, shown as a chip, and made part of the
  edition-cluster key — so the recording is listed beside the novel rather than on top of it,
  and `carrier:print` excludes it. (`type:book` does not; it asks Alma about the leader, which
  is the field that is wrong.)
- **Typos survive.** Word matching tolerates edits scaled to word length, and a query that
  returns nothing is retried with words dropped — one at a time, then in pairs — keeping the
  *best* retry rather than the first one that returns anything, and then narrowing it back to
  Biomed. `wtlas shrugged` finds Atlas Shrugged; `harrisons principals of internal medicin`
  finds the 20th edition of Harrison's on level 10.

**Filters for anything the endpoint can answer.** The same box takes `field:value` tokens —
`mesh:neoplasms year:2020+ type:book shelf:yes`, `cn:"WM 100" at:stacks sort:shelf`,
`anatomy genre:atlases -lang:eng` — across title, author, subject, MeSH, LCSH, series, genre,
uniform title, publisher, place, notes, ISBN, ISSN, three kinds of call number, language, year
(ranges, decades, open ends), record type, item type, location code, scope and sort order.
A leading `-` negates; trailing `*` truncates. Five more — `shelf:`, `level:`, `avail:`,
`online:`, `editions:` — are facts about the shelf map rather than the catalog and are applied
locally. The **Filters** panel is the same vocabulary with a mouse, and it echoes the tokens it
compiled to, because a filter that narrows the answer silently is indistinguishable from a gap
in the collection. **Search syntax** in the panel lists every field.

Every index offered was probed against the live endpoint; the ones `explain` advertises but
that return zero for every value — `alma.mms_resource_type`, `alma.audience`, every
`*_Library` index — are deliberately absent.

**Cover art** comes from Open Library by ISBN — keyless, and a cover it doesn't have removes
its own element rather than leaving a grey box. It is the only third-party request the app
makes, it carries the ISBN and nothing else, and the **Show covers** checkbox turns it off.

The endpoint's real behaviour — which indexes exist, why `sortKeys` is useless but `sortBy`
isn't, the three unwritten rules about parentheses, the full list of Biomed location codes,
and every way the shelf lookup refuses — is written up in [`CATALOG.md`](CATALOG.md).

[Tesseract.js]: https://github.com/naptha/tesseract.js
[heic2any]: https://github.com/alexcorvi/heic2any

---

## Repo layout

| Path | What it is |
| --- | --- |
| [`index.html`](index.html) | The deployed app (data baked in). **Generated** — see below. |
| [`biomed-shelf-ranges.json`](biomed-shelf-ranges.json) | The master dataset: one entry per shelf *face*. |
| [`.build_locator.py`](.build_locator.py) | Source of truth for the HTML; bakes the JSON in. |
| [`Instructions.txt`](Instructions.txt) | The mapping handbook: dataset format, comparator, shelf physics. |
| [`CATALOG.md`](CATALOG.md) | What the Alma SRU endpoint actually does, and how the catalog→shelf join refuses. |
| `fixtures/` | Saved live SRU responses used as the offline test corpus (not deployed). |
| [`Tools/catalog.test.js`](Tools/catalog.test.js) | `node Tools/catalog.test.js` — 341 assertions against those fixtures. |
| `Floors/` | Raw shelf-end photos, grouped by level (not deployed). |
| [`wrangler.jsonc`](wrangler.jsonc) | Cloudflare Workers config (static-assets / SPA mode). |
| [`.assetsignore`](.assetsignore) | What Cloudflare must *not* upload (raw photos, JSON, tooling). |

---

## The dataset

One flat object in [`biomed-shelf-ranges.json`](biomed-shelf-ranges.json). Each **key** is a shelf
face, each **value** is the call-number range living on it:

```json
{
  "7|top-9|left":    { "start": "W1 AM4986", "end": "W1 AM511" },
  "7|bot-14|single": { "start": "W1 AN819",  "end": "W1 AO671" },
  "8|top-2|left":    { "start": "WM 33 AA1", "end": "WM 100 D299a" }
}
```

Key format is `level|shelf-id|side`:

- **level** — stack level (`5`, `6`, `7`, `8`, `11`, …).
- **shelf-id** — `top-N` / `bot-N`, where `N` is the column index. `top-0` / `bot-0` are special
  half-shelves on some floors.
- **side** — `left` / `right` (a full double-sided shelf has both) or `single` (a half shelf).

The collection runs as **one continuous ascending "snake"** across each floor, weaving between the
top and bottom rows column by column. The validation rules (seams, gaps, the decimal comparator,
the special cases) live in [`Instructions.txt`](Instructions.txt) — **read it before editing the
dataset**. The cardinal rule: *never guess a label or fill a gap from memory.*

---

## Building / regenerating

The app is generated, not hand-edited. After changing the dataset (or the template inside the
build script), regenerate so the new data is baked into the served HTML:

```bash
python .build_locator.py
# writes index.html
```

`index.html` and the HTML template inside `.build_locator.py` must stay in sync — the build script
treats its embedded template (with the `__DATA__` placeholder) as the source of truth.

## Deploying

```bash
npx wrangler deploy
```

Cloudflare serves `index.html` for all routes (SPA mode). `.assetsignore` keeps the multi-gigabyte
`Floors/` photos, the raw JSON, and the Python tooling out of the upload.

---

## Notes

- **Reference** is shelved on floor 4 and **Special Collections** on floor 9 — both are searchable
  via the section pills, but they have no per-shelf map (shelved straight by call number).
- A range where `start == end` is a **serial run** (many volumes share one call number); the
  locator returns every matching shelf so you can check the spine.
- Suffix letters (`AM489H`, `D299a`) are part of the call number and are preserved exactly.
