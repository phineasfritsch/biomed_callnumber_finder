# Biomed Stacks · Call-Number Finder

A single-page web app that turns a **call number into a physical shelf** in a biomedical
library's closed-ish stacks — and (new) turns **a photo of a pull list into an efficient
walking route** through the building.

It is built from a hand-verified dataset of shelf-end labels: someone photographs the range
labels on the ends of the physical shelves, those labels are transcribed and validated into one
JSON file, and that file is baked into the app. No catalog API, no server database — just a
careful map of where every call-number range actually lives.

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

The route is **deterministic and explainable** — OCR only fills the list of call numbers; the
walking plan is computed from the shelf map and the building's stair/elevator geometry. Because
browser OCR is imperfect (especially on handwriting), the editable list is the real interface — the
recognizer is just a head-start. Tap any floor in the itinerary to jump the floor plan to it.

**Mobile & iPhone:** the whole site is responsive (the floor plan becomes horizontally
scrollable so shelves stay tappable). There's a **"Take photo"** button that opens the phone
camera directly, and **HEIC/HEIF** photos from iPhones are converted to JPEG in-browser (via
[heic2any], lazy-loaded) before recognition — `<canvas>` can't decode HEIC, so this conversion is
what makes iPhone uploads work at all.

[Tesseract.js]: https://github.com/naptha/tesseract.js
[heic2any]: https://github.com/alexcorvi/heic2any

---

## Repo layout

| Path | What it is |
| --- | --- |
| [`index.html`](index.html) | The deployed app (data baked in). **Generated** — see below. |
| `biomed-shelf-locator.html` | Same app, downloadable copy (also generated). |
| [`biomed-shelf-ranges.json`](biomed-shelf-ranges.json) | The master dataset: one entry per shelf *face*. |
| [`.build_locator.py`](.build_locator.py) | Source of truth for the HTML; bakes the JSON in. |
| [`Instructions.txt`](Instructions.txt) | The mapping handbook: dataset format, comparator, shelf physics. |
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
# writes biomed-shelf-locator.html and copies it to index.html
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
