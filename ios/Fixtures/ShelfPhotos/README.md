# Shelf photo corpus

Real photographs of Biomed shelves, used to tune and test the Shelf Read feature (`DESIGN.md` §3.9).

These are **not** in the app bundle and **not** on the website. `ios/` is excluded by
`.assetsignore`, which is the only reason a 2.7 MB photo at the repo root is not a public URL —
see `Tools/assets.test.js`, which now fails loudly if a `.HEIC` reappears up there.

## Why the photos exist

Three different jobs, at three different stages of the build:

1. **Measurement, on Windows, today.** Open a photo and measure, in pixels, the cap height of a
   call-number glyph and the x-extent of each spine. That is what turns the estimate
   ("~19-22 px at 20-24 inches") into a number, and it is what sets `ShelfReadConfig`'s
   `overlapFraction`, `maxColumnWidth` and `spineAngleLimit`. It also empirically tests the
   assumption the whole grouping design rests on: that adjacent spines are disjoint in x.
2. **Hand-transcribed geometry fixtures.** `index.json` records what is actually in each photo.
   That gives `ios/Tools/spinegroup.test.js` real geometry instead of synthetic geometry, which is
   the difference between testing the algorithm and testing our imagination of the algorithm.
3. **Real Vision, on a Mac.** `VNImageRequestHandler(url:)` works in the Simulator with no camera,
   so a curated handful of these run the entire pipeline — Vision → grouping → recognizer → judge —
   against a still with known ground truth. This is why `ShelfFrameProcessor` accepts a `CIImage`
   and not only a `CVPixelBuffer`.

## The rule

**A photo without ground truth is not a fixture.** It is a snapshot, and it cannot fail a test.
Recording the truth at capture time costs seconds; reconstructing it later, from a photo of a shelf
you are no longer standing at, costs an afternoon and is often impossible.

So every photo added here gets an entry in `index.json` before it is useful. An entry with
`"groundTruth": null` is a placeholder — it is a photo we have, not a fixture we can test against.

## What to photograph

The ordinary case is well covered by any shelf. What is **not** covered, and what actually decides
whether this feature is trustworthy, is the set of books whose label is not a normal spine label.
Those are the cases that produce a *confident wrong answer* rather than an obvious failure, so they
are worth going and finding on purpose:

| `labelPlacement` | what it is |
| --- | --- |
| `spine` | the normal case: label applied to the spine, readable head-on |
| `frontCover` | a thin item — pamphlet, unbound issue, thesis — too narrow for a spine label, so the label is on the front cover and is only visible when the item sits proud or angled |
| `flat` | an oversize volume shelved on its side. The label is rotated 90°, and shelf order runs top-to-bottom rather than left-to-right |
| `box` | a pamphlet box or Princeton file: one label legitimately covering several items, which is not a misfile |
| `none` | shelved fore-edge out, or the label is missing or destroyed. OCR can never see this one, and the app must say so rather than skip it silently |

Also worth capturing deliberately: a shelf with a **genuine** misfile in it (record which one), a
serials run with many volumes (`no.1 … no.80`), and the same shelf with the torch on and off —
glare and small text fail differently, so the two mitigations are not interchangeable.

## Fields

Per photo:

- `file` — filename in this directory
- `level`, `shelfID`, `side` — where it was taken, matching `Router.Hit`
- `distanceInches` — camera to spine face, roughly. Sets the px-per-inch the photo represents
- `spanInches` — how much shelf is in frame edge to edge
- `torch` — `true` / `false`
- `notes` — anything about the lighting, the shelf, or what makes this photo interesting
- `groundTruth` — an ordered array, in true shelf order, or `null` if not yet transcribed

Per item in `groundTruth`:

- `callNumber` — as printed on the label, exactly, dots and all
- `labelPlacement` — one of the five values above
- `misfiled` — `false`, or one of `"outOfOrder"`, `"wrongShelf"`, `"volumeBreak"`
- `rect` — optional `[x, y, width, height]` in Vision's normalized bottom-left coordinates, for the
  grouping fixtures. Approximate is fine; the grouping thresholds are not that tight
