# Biomed Shelf Scanner (iOS)

Native rewrite of the web locator. Live camera OCR of spine labels → shelf lookup → optimal walk.
iOS 17+, iPhone, portrait, fully offline.

**Read [DESIGN.md](DESIGN.md) first** — particularly §3.3, which documents a trap that looks
obviously correct and is not.

---

## Build

```bash
brew install xcodegen
cd ios
xcodegen generate          # writes BiomedShelfScanner.xcodeproj from project.yml
open BiomedShelfScanner.xcodeproj
```

Set `DEVELOPMENT_TEAM` in `project.yml` (or pick a team in Xcode's Signing tab) before running on
a device. **The camera does not work in the Simulator** — the scanner needs real hardware. Manual
entry and routing work fine in the Simulator, which is enough to exercise everything except
Vision.

The project is generated rather than checked in: `project.pbxproj` is unreviewable in a diff and
merge-hostile. `project.yml` is neither.

---

## Verify the port before trusting it

The routing logic was ported from working JavaScript. Two golden fixtures, generated from that
JavaScript running over the real dataset, prove the port is faithful:

```bash
# from the repo root
node ios/Tools/golden.js      biomed-shelf-ranges.json ios/Tests/CallNumberGolden.json
node ios/Tools/routeGolden.js biomed-shelf-ranges.json ios/Tests/RouteGolden.json

# Not a fixture — an executable model of the recognizer (extract -> parse -> isWellFormed ->
# locate) that runs against the real dataset without Xcode. If you change any of those four,
# change it here first and watch it fail; it is far faster than a device round-trip.
node ios/Tools/pipeline.js    biomed-shelf-ranges.json
```

Then run the test target (⌘U). `CallNumberTests` re-sorts all 651 endpoints and asserts the order
matches JS exactly; `RouterTests` asserts whole routes match step-for-step.

**Run these before touching the camera.** Everything else rests on the comparator, and it is the
easiest thing to break invisibly.

If the dataset changes, regenerate both fixtures and re-run. If `testGrammarAcceptsRealEndpoints`
starts failing, the grammar (§3.3) no longer fits the collection — re-measure, don't just widen it
until the test passes.

---

## Layout

```
BiomedShelfScanner/
  App.swift                       entry; builds the single Router + TripStore
  Models/
    CallNumber.swift              parse, compare, isWellFormed  ← the grammar gate
    Router.swift                  locate, sweep, buildRoute
    Trip.swift                    trip model + persisted store
  Scanning/
    CallNumberRecognizer.swift    ranked-candidate resolution (pure, testable)
    ScanEngine.swift              AVCapture + Vision + stability voting
    DocumentScanner.swift         request-sheet capture (VisionKit)
  Views/
    ScanView.swift                root: camera + viewfinder
    TripSheet.swift               the growing trip (Maps-style sheet)
    RouteView.swift               the walk, with check-off
    ManualEntryView.swift         type/fix a call number; sheet-import review
    Theme.swift                   tokens + StatusChip
    CameraPreview.swift           AVCaptureVideoPreviewLayer wrapper
  Resources/
    biomed-shelf-ranges.json      copied from the repo root — see below
Tests/                            golden fixtures + tests
Tools/                            golden generators (Node)
```

### The dataset is duplicated

`BiomedShelfScanner/Resources/biomed-shelf-ranges.json` is a **copy** of the repo-root file. The
web app and the iOS app share one source of truth that currently has to be copied by hand:

```bash
cp biomed-shelf-ranges.json ios/BiomedShelfScanner/Resources/
```

Do this whenever the ranges change, or the app will route against stale shelves. Worth wiring into
`.build_locator.py` if the iOS app becomes the primary client.

---

## Things that will bite

- **This code has never been compiled.** It was written on Windows without Xcode. The logic is
  verified against the real dataset via the Node fixtures; the Swift syntax is not. Expect to fix
  some build errors — start with `xcodegen generate && xcodebuild` and work through them.
- **`usesLanguageCorrection = false`** in `FrameProcessor` and `DocumentScanner` is load-bearing,
  not a preference. Turning it on makes Vision bend `NA388` toward English words. See DESIGN.md §3.1.
- **The seam tiebreak in `Router.locate`** exists because 237 of 651 endpoints match two faces at
  once and Swift's `Dictionary` order is randomized per launch. Removing the `$0.key < $1.key`
  tiebreak reintroduces a bug that changes answers between runs — it will look like flaky OCR.
- **`SWIFT_STRICT_CONCURRENCY: complete`** is on deliberately. `FrameProcessor` is
  `@unchecked Sendable` because `AVCaptureVideoDataOutput` serializes its delegate callbacks; if
  you add a second caller, that reasoning stops holding.
