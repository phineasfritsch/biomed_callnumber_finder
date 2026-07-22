# Biomed Shelf Scanner — iOS Design

SwiftUI rewrite of the web locator. Target: iOS 17+, iPhone, portrait-primary, fully offline.

---

## 1. The one insight this design is built on

**Your eyes are on the books, not on the phone.**

Scanning 40 spines off a truck is a physical loop: grab book → aim → confirm → next. If each
book costs a tap and a wait, that is 40 taps and 40 waits, and the librarian looks at the screen
40 times. That is the whole reason the current web app is unpleasant, and it would still be
unpleasant even with perfect OCR.

So the target interaction is **zero taps per book**. Point, feel a haptic tick, move on. The phone
confirms through touch and sound; the screen is for review afterward, not during. Every decision
below follows from that.

**Field revision — one tap per book, not zero.** Continuous capture met reality and lost:
successive reads of ONE label normalize differently (a frame with the volume line, a frame
without), so the same physical book landed in the list twice. A trip list that needs
de-duplicating costs more trust than a button press costs time. Default is now **single-shot** —
press, scan until one accept, idle — with continuous capture kept as an explicit Sweep mode for
running a truck shelf. The store also merges token-prefix re-reads either way (§3.8). The
eyes-off principle survives: you press without looking, the haptic still carries the verdict.

---

## 2. Navigation architecture

**Camera is the root view.** Not a tab, not behind a button. App opens → camera is live and
already scanning. This is the "quickly scan every spine" requirement taken literally.

A **draggable bottom sheet** (`.presentationDetents([.height(96), .medium, .large])`) holds the
growing trip. This is the Maps/Shortcuts idiom — familiar, one-handed, keeps the camera alive
behind it.

```
┌─────────────────────────┐
│  [Scan | Sheet]    ⚡︎ ✕ │  ← mode + torch, top safe area
│                         │
│      ┌───────────┐      │
│      │  W1 NA388 │      │  ← live ROI frame; detected text
│      └───────────┘      │     box turns green when valid
│                         │
│    ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁     │
├─────────────────────────┤
│ ▔▔▔                     │  ← grabber
│  17 books · 12 located  │  ← peek detent: glanceable count
│  [ Plan route ]         │
└─────────────────────────┘
```

Drag up → full list. Everything reachable in the bottom third; nothing critical near the notch.

**Why not a tab bar.** The job is a linear flow (scan → review → route → walk), not four co-equal
destinations. A tab bar would put the camera one tap away from cold, which breaks the zero-tap
goal. Map browsing and history are secondary — they live behind a toolbar button in the sheet, not
in primary nav.

**Route** pushes full-screen via `.navigationDestination(for:)`. It's a distinct mode: you've
stopped scanning and started walking.

### Trip type: Fetch vs Shelve

Segmented control in the sheet header. Be clear about what this actually does: **the route
algorithm is identical for both.** You visit the same shelves in the same order whether you're
pulling books off or putting them back. The toggle only changes copy ("Collect" vs "Shelve"),
the check-off semantics, and history labeling. It is not worth a separate code path — and it would
be dishonest UX to imply the app is doing something cleverer than it is.

---

## 3. The scan engine (the crux)

This is where the app lives or dies. Four techniques, in order of impact.

### 3.1 Vision instead of Tesseract

```swift
let request = VNRecognizeTextRequest(completionHandler: handle)
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false   // CRITICAL — see below
request.recognitionLanguages = ["en-US"]
request.regionOfInterest = roi           // normalized, camera-space
```

`usesLanguageCorrection = false` is non-negotiable. `NA388` is not an English word; with correction
on, Vision will "helpfully" bend call numbers toward real words and quietly destroy them. This
single flag is a common cause of "OCR works everywhere except on my identifiers."

Vision also removes every hack currently in the web app: the 4-rotation loop (it reads text at
arbitrary angles and returns the angle), the Otsu binarization (it works on raw pixels), and the
page-segmentation-mode guessing (no such concept).

### 3.1.1 Vision returns one observation per LINE — reassemble before parsing

**This sank the first field build: the app scanned nothing, ever.** A spine label is stacked one
token per line, so Vision returns five separate observations — `Biomed` / `W1` / `NA388` /
`no.66` / `1984` — and no single observation ever contains a whole call number. Resolving
observations independently *cannot* succeed: `W1` alone fails the grammar, `NA388` alone fails,
forever. Verified in the model: every line alone → nil; joined → locates.

The desk tests missed it because they fed multi-line strings as one candidate — an input shape
Vision never actually produces. The corrected pipeline sorts in-band observations top-to-bottom
(bounding boxes are bottom-left origin: top of frame = larger `midY`), joins top candidates with
newlines, then adds ranked variants swapping one line at a time, then falls back to per-line for
single-line labels (request slips). See `FrameProcessor.process`.

Related trap fixed at the same time: `request.regionOfInterest` crops the **raw landscape
buffer**, not the upright image, so a portrait-drawn guide box selects a different region of the
sensor than it shows. The engine now OCRs the full frame and filters observations by bounding box
in upright space — the overlay's own space — so what you see is what gets scanned, by
construction.

### 3.1.2 Colored journal labels: channel-hunting

Field result: B/W labels scan well; colored bindery labels (white on red, gold on green, white on
anything) fail — their luminance view is low-contrast mush. But in the right single RGB channel
they snap to near-B/W: white-on-red is dark-vs-bright in the GREEN channel, gold-on-green is
brightest in RED. So `FrameProcessor` holds nine CoreImage variants — plain, contrast-boosted
gray, single-channel extracts, and inversions of each — and **hunts**: one variant per frame,
round-robin while nothing reads, stick on the first that produces. Free when plain works (index
stays 0); a full hunt cycle is under a second at 10fps.

Two supporting pieces:
* `StabilityVoter.missTolerance` (8): hunting means legitimate misses between hits, so votes only
  reset after a *sustained* run of misses — otherwise 3 agreeing frames never accumulate and
  colored labels never scan at all.
* Pencil and handwriting: pencil is just low-contrast gray, which the contrast variants lift;
  handwriting is handled natively by Vision `.accurate` with no extra work. Expect partial
  accuracy on handwriting — the grammar gate discards the garbage and the review list catches the
  rest. That's the designed failure path, not a gap.

### 3.2 Domain-constrained decoding — the biggest accuracy win

Vision returns *ranked candidates*, not one string. Almost nobody uses past the first:

```swift
for candidate in observation.topCandidates(5) {              // ← not just topCandidates(1)
    guard let cn = CallNumber.parse(candidate.string),
          cn.isWellFormed                                    // ← the gate. See 3.3.
    else { continue }
    return (cn, router.locate(cn))                           // locate tells you WHERE, not WHETHER
}
```

Vision ranks by visual confidence and has no idea what a call number is. We do. Walking the ranked
list and taking the best read that obeys real call-number notation costs nothing and is the single
highest-leverage trick available. If Vision's top read is `W1 NA3B8` but its third is `W1 NA388`,
the grammar rejects the first and we get the truth for free.

### 3.3 The trap: "it locates" is not a validity check

**This was measured against the live dataset, and it killed the design's first draft.**

The intuitive move is to validate a candidate by asking whether it lands in one of the 453 shelf
ranges. It does not work, because the ranges are *broad intervals* — nearly any string falls inside
one:

| Input | Locates? | Where |
| --- | --- | --- |
| `W1 NA388 no.66 1984` | yes | L2 · top-5 · right ✅ |
| `W1 NA3B8 no.66 1984` | **yes** | L2 · top-6 · right ❌ *wrong shelf* |
| `WI NA388 no.66 1984` | **yes** | L9 · bot-10 · left ❌ *wrong floor* — a 1→I slip flips the scheme |
| `W1 ZZZ999 no.1 1900` | **yes** | L1 · top-14 ❌ *pure garbage* |

Gating on containment would confidently walk you to the wrong floor. The real gate is **grammar**
(`CallNumber.isWellFormed`): a cutter is letters + digits + at most a 2-letter suffix, and may not
re-enter digits afterward. That's what rejects `NA3B8` (NA + 3 + B + **8**).

Measured on the live dataset: **644 of 651 real endpoints pass, and the misreads that matter are
rejected** — `NA3B8`, `NA5B8`, the scheme-flipping `WI NA388`, and spine-title noise.

Be precise about the scope of the claim: **the grammar rejects malformed reads, not
implausible-but-well-formed ones.** `W1 ZZZ999` still passes and still locates, because `ZZZ` +
`999` is structurally a perfectly good call number. Nothing can reject it on structure, and nothing
needs to — Vision will not produce `ZZZ999` from a photograph of a spine. The failure mode being
defended against is *plausible corruption of a real read*, not adversarial input.

Known limits, all acceptable:

- 7 genuinely odd real endpoints fail (`A`, `ZWZ 330`, `Q 41 R81R8`, `Q 41 R81S7`,
  `WX 27 GF7 P3R5D`, `WC 160 G7.78T`, `BF 789 D4 6456s`). Those books need manual entry, which is
  why `ManualEntryView` deliberately skips the grammar gate.
- `NA38B` and `NA3BB` pass and are indistinguishable from real cutters (`CA756TA` has exactly that
  shape). Harmless: both parse to cutter `.38`/`.3`, and the L2/top-5/right face spans
  `.1991`–`.835`, so they land on the **same shelf** as `NA388`. Coarse ranges cut both ways —
  useless as a validator, but they absorb small digit errors. The text in the list is wrong; the
  shelf you walk to is right, and the human reviewing the list is the backstop.

### 3.3.1 The gate can be defeated by its own input stage

Worth its own heading because it cost a real bug. The extraction regex originally matched a
*prefix* and stopped mid-token: given `W1 NA3B8` it returned `W1 NA3B`, quietly dropping the
trailing `8`. That truncation **laundered a corrupt read into a well-formed one** — `NA3B` is a
valid cutter — so `isWellFormed` saw something clean and waved it through. The defense was
bypassed before it ran.

The fix is a `(?![A-Z0-9])` anchor so a match cannot end mid-token. `CallNumberRecognizer.extract`
carries the reasoning; `testExtractionDoesNotTruncateMidToken` locks it in. The general lesson: a
validator is only as good as the string handed to it, and a *greedy* extractor will hand it
whatever parses.

One narrow whitelist is needed: `A1C7` / `A1C8` / `A1Q2` are real jammed double cutters. A general
"letters-digits-letters-digits" rule would readmit `NA3B8`, so the `A1` form is special-cased
rather than generalized.

### 3.4 Character repair — cut, deliberately

The first draft substituted confusable glyphs (O↔0, B↔8, S↔5) and accepted a variant if it located.
Measuring it killed the idea twice:

1. **It never fires when it matters.** `W1 NA3B8` *already* locates, so a repair pass gated on
   "nothing located" is never reached. The wrong shelf is accepted silently, at full confidence.
2. **It cannot be made safe.** Scoring repairs on containment is a machine for inventing plausible
   wrong shelves, since `ZZZ999` locates too.

The grammar gate solves the real problem instead: reject the malformed read so the next-ranked
candidate gets its turn. Anything grammar can't resolve belongs in front of a human, not in a
substitution search. **Vision confidence + grammar + multi-frame agreement + a fast review list —
that's the defense. Not cleverness.**

### 3.5 Stability voting — what makes auto-capture feel solid instead of jittery

A single frame is never trustworthy. Auto-accepting per-frame produces a flickering mess of
half-reads. Require agreement across frames:

```swift
private var votes: [String: Int] = [:]   // normalized CN → consecutive frame hits

func consider(_ cn: String) -> Bool {
    votes[cn, default: 0] += 1
    guard votes[cn]! >= 3 else { return false }   // 3 agreeing frames ≈ 0.3s at 10fps
    votes.removeAll()
    return true                                   // accept
}
```

Throttle Vision to ~10fps (not every frame — you'll cook the battery and gain nothing) and cap
the ROI to a center band. That's cheap enough for `.accurate` on live video on the Neural Engine.

### 3.6 Feedback — the part that lets you stop looking at the screen

| Event | Haptic | Sound | Visual |
| --- | --- | --- | --- |
| Accepted + located | `.success` | short tick | box flashes green, count increments |
| Accepted, not located | `.warning` | lower tick | box amber, row flagged in sheet |
| Repair was applied | `.success` | tick | row shows "corrected" badge |

Distinct haptics for located vs not-located is what makes eyes-off scanning viable — you feel the
difference without looking. Sound uses `.ambient` audio session so it respects the silent switch;
haptics still fire. Both are toggleable (`shelf.scanner.sound` in Settings) because some
librarians work in quiet reading rooms.

### 3.7 Scanning modes

Two, not three:

- **Scan** (default) — continuous live. Accepts every valid call number in the ROI, dedupes by
  string. Sweep the camera along a truck shelf and it collects them all. A **Precision** toggle
  narrows the ROI to a single centered box for tightly-packed spines where you'd otherwise catch
  the neighbor's label.
- **Sheet** — `VNDocumentCameraViewController` for an ILL request sheet. One capture, perspective-
  corrected, returns many lines at once → parse all → reviewable checklist.

### 3.8 Duplicates — revised in the field

The real duplicate problem turned out to be the opposite of the designed one. Exact duplicate
copies are **rare** in this collection; what's common is one book producing two different reads
(`W1 NA388` then `W1 NA388 NO.66 1984`), which exact-string dedupe files as two books.

The rules now:

* **Token-prefix merge, gated by a 2.5-second window, sweep mode only.** If one read's tokens are a
  prefix of the other's *and* the existing row was written within the last few seconds, it's the
  same label at different completeness — keep the longer text, no new row.

  Both gates are load-bearing, and the first draft of this rule had neither. Prefix-relatedness
  does NOT imply same book: journals shelve as **runs**, so the next book on the shelf is usually
  the same title at a different volume, and its full read validly extends the previous book's
  partial read. Ungated merging destroys books silently — scan A (no.66) partial, scan B (no.71)
  full, row becomes B, **A is gone**; in the other order B is dropped instead. A same-book upgrade
  can only arrive within the voter's cadence (~1–2s), hence the window. And in single-shot mode
  the engine disarms after each accept, so an upgrade can *never* follow — there, prefix-merging
  is pure cross-book hazard and is disabled outright. An occasional partial row to tidy in review
  beats a silently missing book.

  Also deliberately NOT "compare ignoring the volume": `NO.66` vs `NO.67` are different bound
  volumes, neither a prefix of the other — separate rows always.
* **Partial reads earn acceptance more slowly.** A volume-less read usually means the label's
  volume lines haven't assembled yet, so it needs 5 agreeing frames instead of 3 — a half-second
  for the full text to out-vote the partial. Fewer partial rows means fewer merge decisions to
  get wrong at all.
* **Re-scan of identical text is a no-op**, with a distinct "already have it" haptic. Auto-bumping
  quantity on re-scan recorded phantom copies; real second copies go through the quantity stepper
  on the row.

---

## 4. Instant validation — scan-time confidence

Because the dataset is bundled, every scan resolves *immediately*:

- **Located** → green chip: `L2 · top-5 · right`
- **Not located** → amber chip: `Not in mapped ranges` (Reference/Floor 4, or unmapped stacks)

The current web app makes you scan everything, build a route, and only *then* discover which
call numbers failed. That's a slow feedback loop at the worst moment — you've already walked away
from the truck. Validating at scan time means you fix it while the book is still in your hand.

This is the single biggest UX improvement over the web version, and it's only possible because the
data is local.

**But be precise about what the green chip means.** It means *"well-formed, and this is where it
goes"* — not *"this read is definitely correct."* Per §3.3, containment proves nothing on its own;
`W1 NA3B8` would show a confident green chip pointing at the wrong shelf if the grammar hadn't
already rejected it upstream. The chip is a location display, not a correctness guarantee.

The design consequence: **the review list must stay fast and prominent, not be treated as
vestigial.** A scanner that quietly implies infallibility is worse than one that makes checking
cheap. Monospaced call numbers, big tap targets to edit, and one-tap delete — because the human is
the last line of defense and always will be.

---

## 5. Route

Port the existing algorithm unchanged — it's sound and already debugged:

- Group located call numbers by floor; **top floor first** (descending).
- Per floor, 1-D sweep over shelf indices: `sweep(L, R, entry, exit)` picks the cheaper of
  left-to-right vs right-to-left.
- Floor transitions: adjacent floors (gap == 1) → cheaper of west/east stairwell, scored by
  `sweep cost + distance to next floor's centroid`; non-adjacent → elevator.
- Geometry constants: `ELEV_X = 6.5`, `STAIR_W = 6.5`, `STAIR_E = 13.5`.

**What's new in the app:**

- **Check-off with persistence.** 40 books is a 20-minute walk; you *will* be interrupted. Trip
  state survives backgrounding and force-quit (SwiftData). Resume where you left off.
- **Route-order truck sorting.** For a shelve trip, offer "sort truck first" — show the books in
  route order so they can be physically reordered on the cart before walking. This is what
  experienced staff already do by hand; the app should just hand them the order.
- **Progress**: `12 of 40 · Level 2` in the nav bar.

Stretch (not v1): Live Activity on the Lock Screen showing next stop + progress. Genuinely useful
for a walking task, but it's polish — ship the loop first.

---

## 6. Design tokens

### Typography — rejecting the tool's recommendation

The design-system generator proposed **Playfair Display + Source Serif 4**. That is editorial/luxury
type. This app is a field utility used one-handed, in dim light, possibly with a cart in the other
hand. Use:

- **UI**: SF Pro (system) — free, Dynamic Type native, zero download weight.
- **Call numbers**: **SF Mono**, always. Non-negotiable. Call numbers are identifiers full of
  ambiguous glyphs (`O`/`0`, `I`/`1`, `S`/`5`). Monospace with tabular figures makes them scannable
  and column-aligned:
  ```swift
  Text(callNumber).font(.system(.body, design: .monospaced))
  ```
- Call numbers **wrap, never truncate**. A truncated call number is a wrong call number.

This preserves the web app's intent (it already uses Spline Sans Mono for call numbers) while
dropping the display serif, which never served a purpose in the UI chrome.

### Color

Chrome goes native (system backgrounds, `.tint` accent). Two things carry over from the web app:

- **Shelf group colors** — green `#5B7D3A`, orange `#C66A25`, char `#3A3631`, slate `#6A7080`.
  These are *semantic* on the floor map (they identify shelf groups), so keeping them preserves
  continuity for anyone who used the web version.
- **High-contrast navy/blue** direction (`#0F172A` / `#0369A1`) — the one useful thing the
  design-system tool returned. Works for a utility app and survives dark mode.

Status colors never stand alone — every one pairs with an SF Symbol and text:

| State | Color | Symbol | Text |
| --- | --- | --- | --- |
| Located | green | `checkmark.circle.fill` | `L2 · top-5 · right` |
| Not located | amber | `exclamationmark.triangle.fill` | `Not in mapped ranges` |
| Corrected | blue | `wand.and.stars` | `Corrected from NA3B8` |

Camera overlays need a scrim (`.ultraThinMaterial` or 40–60% black) — text over live video fails
contrast unpredictably as the scene changes.

### Motion

- 150–300ms, spring-based (`.spring(response: 0.3, dampingFraction: 0.8)`).
- Exits ~60–70% of enter duration.
- Scan-accept flash is the *only* animation during scanning. Anything else competes with the task.
- Respect `.accessibilityReduceMotion` — fall back to a crossfade.

---

## 7. Accessibility

- **Dynamic Type** end to end, tested at largest size. Call numbers wrap to a second line rather
  than truncate.
- **VoiceOver** announces each accept with the resolved location: *"W1 NA388, Level 2, shelf 5,
  right side."* This makes eyes-off scanning work for low-vision users too — same design goal,
  different modality.
- **Torch toggle** is a first-class control, not buried. The lower stacks are dim; this is a
  functional requirement, not a convenience.
- Touch targets ≥44pt; `hitSlop`-equivalent padding on the torch/mode icons.
- Color never load-bearing (see table above).
- Nothing critical within the notch/Dynamic Island or home-indicator zones.

---

## 8. Build order

Ship the loop before the polish. Each step is independently testable:

1. **`CallNumber.swift`** — port `parseCN` / `cmpSeg` / `cmpCN`. Pure logic, no UI, unit-testable
   on any machine. Start here: everything else depends on correct ordering, and it's the easiest
   thing to get subtly wrong (cutter numbers sort as *decimals* — `.388` > `.1991`).
2. **`Router.swift`** — port `locate` / `sweep` / `buildRoute`. Also pure. Golden-test it against
   the current JS output so you know the port is faithful.
3. **`ScanEngine.swift`** — Vision + stability voting + candidate validation. The risky part;
   isolate it behind a protocol so the UI can be built against a mock.
4. **Camera root + sheet** — the zero-tap loop.
5. **Route view + check-off + persistence.**
6. Floor map (port the SVG plan), history, Live Activity.

---

## 9. Honest caveats

- **None of the Swift here has been compiled.** It's written from the API contracts, not verified
  against a build. Treat the code as a design spec, not a drop-in.
- **The Vision accuracy claim is qualitative.** Vision is architecturally much better suited to
  camera photos than Tesseract is, and the constrained-decoding trick in §3.2 is a real multiplier
  — but the actual read rate on *your* labels is an empirical question. Build step 3 against a
  handful of real spine photos before committing to the full rewrite.
- **`topCandidates(5)` + the grammar gate is the highest-leverage idea in this document.** If you
  implement only one thing beyond swapping in Vision, implement that pair. Note they only work
  *together*: ranked candidates are useless without a gate to reject the bad ones, and §3.3 shows
  range containment cannot be that gate.
- **§3.3 and §3.4 are corrections to this document's own first draft**, made after measuring
  against the live dataset rather than reasoning about it. The original design gated on "does it
  locate" and included a character-repair pass; both were wrong, and the second was actively
  dangerous. Worth knowing if you find that reasoning attractive again later — it is attractive,
  and it is still wrong.
- **The grammar was fitted to *this* collection** (644/651 endpoints, plus a hand-whitelisted `A1`
  form). It is not general call-number notation. If the mapped ranges expand into new classes,
  re-run the measurement in `scratchpad/` before trusting it.
- Distribution needs an Apple Developer account ($99/yr) for TestFlight. Free sideloading expires
  every 7 days — not viable for colleagues.
