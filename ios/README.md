# Biomed Shelf Scanner (iOS)

Native rewrite of the web locator. Live camera OCR of spine labels → shelf lookup → optimal walk,
plus the headcount round the same person walks on the same shift. iOS 17+, iPhone, portrait.
Scanning and routing are fully offline; only a headcount submission touches the network.

It shares a visual system with Shelfmark (`../index.html`) and Headcount
(`../better_headcount/`): warm paper, Fraunces for display, Spline Sans Mono for everything else.
Tokens live in `Views/Theme.swift`. They are copied from those files rather than re-derived, and
`better_headcount/DESIGN.md` says why.

**Read [DESIGN.md](DESIGN.md) first.** Especially §3.3. It documents a trap that looks obviously
correct and is not.

**Then [TESTING.md](TESTING.md).** It covers getting the app onto a phone from a cloud Mac, and
tuning OCR *without* redeploying. The second half matters more than it sounds. A build loop here is
about fifteen minutes and recognition tuning needs dozens of cycles.

---

## Build

```bash
brew install xcodegen
cd ios
xcodegen generate          # writes BiomedShelfScanner.xcodeproj from project.yml
open BiomedShelfScanner.xcodeproj
```

Set `DEVELOPMENT_TEAM` in `project.yml` (or pick a team in Xcode's Signing tab) before running on
a device. **The camera does not work in the Simulator.** The scanner needs real hardware. Manual
entry and routing are fine there, which is enough to exercise everything except Vision.

The project is generated rather than checked in: `project.pbxproj` is unreviewable in a diff and
merge-hostile. `project.yml` is neither.

---

## Verify the port before trusting it

The routing logic was ported from working JavaScript. Two golden fixtures, generated from that
JavaScript running over the real dataset, prove the port is faithful:

Nothing here compiles on the machine it is written on. The Mac is in the cloud and a round trip
is ten to fifteen minutes. So most of what a compiler and a test run would tell you is instead
checked by reading the sources as text, and by running the logic's JavaScript twin.

**Everything below runs on any machine with Node, in under a second, with no network.**

```bash
# from the repo root
node ios/Tools/swiftcheck.test.js          # delimiters, symbol resolution, banned patterns
node ios/Tools/pipeline.js                 # the recognizer, on named cases
node ios/Tools/confusable.test.js          # the O/0 rule, across all 906 range endpoints
node ios/Tools/geometry.test.js            # the scan band vs the controls, every iPhone size
node ios/Tools/fonts.test.js               # bundled fonts vs UIAppFonts vs what the Swift asks for
node ios/Tools/headcount.parity.test.mjs   # the pinned form schema vs better_headcount's
```

`swiftcheck.test.js` is the compiler stand-in. It will not catch a wrong argument type. It does
catch what actually goes wrong when you edit twenty files at once: a renamed token, a view that no
longer exists, a file some scripted edit truncated halfway through.

Fixture generators, for when the dataset or the form schema changes:

```bash
node ios/Tools/golden.js         biomed-shelf-ranges.json ios/Tests/CallNumberGolden.json
node ios/Tools/routeGolden.js    biomed-shelf-ranges.json ios/Tests/RouteGolden.json
node ios/Tools/headcountGolden.mjs                        ios/Tests/HeadcountGolden.json
```

Then run the test target (⌘U). `CallNumberTests` re-sorts all 651 endpoints and asserts the order
matches JS exactly; `RouterTests` asserts whole routes match step-for-step; `HeadcountLogicTests`
replays 2016 snapped slots; `ScanGeometryTests` walks every shipping iPhone size.

**Run these before touching the camera.** Everything else rests on the comparator, and it is the
easiest thing to break invisibly.

If the dataset changes, regenerate the fixtures and re-run. A failing
`testGrammarAcceptsRealEndpoints` means the grammar in §3.3 no longer fits the collection. Measure
again. Do not widen it until the test goes green.

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
    CallNumberRecognizer.swift    ranked-candidate resolution + O/0 restoration (pure, testable)
    ScanEngine.swift              AVCapture + Vision + stability voting
    ScanGeometry.swift            where the scan band is allowed to be (pure, testable)
    DocumentScanner.swift         request-sheet capture (VisionKit)
  Headcount/
    HeadcountConfig.swift         the pinned Google Form schema — see the warning below
    HeadcountLogic.swift          snapping, payload, validation, queue (pure, testable)
    HeadcountStore.swift          live counts, outbox, log, persistence
    HeadcountClient.swift         the submit proxy; the only networking in the app
    HeadcountSubmitter.swift      one Submit press to a terminal state, per form
    HeadcountFeedback.swift       the haptic and tone vocabulary
  Views/
    ScanView.swift                root: camera + viewfinder
    TripSheet.swift               the growing trip (Maps-style sheet)
    RouteView.swift               the walk, with check-off
    ManualEntryView.swift         type/fix a call number; sheet-import review
    HeadcountView.swift           the round: where, when, counters, submit
    HeadcountWalkView.swift       walk mode — one stop, phone at your side
    Theme.swift                   the Shelfmark tokens, components and type scale
    CameraPreview.swift           AVCaptureVideoPreviewLayer wrapper
  Resources/
    biomed-shelf-ranges.json      copied from the repo root — see below
    Fonts/                        Fraunces + Spline Sans Mono, built by Tools/make-fonts.py
Tests/                            golden fixtures + tests
Tools/
  recognizer.js                   ONE model of the recognizer, shared by the three below
  pipeline.js                     named cases through it
  confusable.test.js              the O/0 rule across the whole dataset
  replay.js                       replay a phone-captured corpus (see TESTING.md §3)
  golden.js  routeGolden.js  headcountGolden.mjs     fixture generators
  swiftcheck.test.js              the compiler stand-in
  geometry.test.js                the scan band vs the controls
  fonts.test.js                   bundled fonts vs UIAppFonts vs the Swift
  headcount.parity.test.mjs       the pinned schema vs better_headcount's
  make-fonts.py                   rebuilds the bundled fonts from upstream variable sources
  testsheet.js                    printable real-label sheet for bench testing
```

### Headcount

The app carries the second job the same person does on the same shift: the two-hourly walk of the
building with a tally counter. It is a port of `better_headcount` and it submits through that
project's existing Cloudflare Worker. **No server change was needed.** The Worker's CORS allowlist
keys off the `Origin` header, and a native app sends none.

Two things to know before touching it.

`Headcount/HeadcountConfig.swift` is a **second copy of a pinned schema**, which is precisely what
`better_headcount` avoids by having its client and its Worker import one `config.js`. A native app
cannot import a JS module, so the copy is unavoidable.
`node ios/Tools/headcount.parity.test.mjs` is the compensating control. It diffs the two field by
field and byte by byte, including every `entry.NNNNNNN` id. **Run it before every release.** A
transposed digit in one of those ids puts Level 9's count in Level 8's column, and nothing anywhere
reports it.

`better_headcount` is its own git repository that happens to sit in this working tree, so it is
not tracked here and a fresh clone will not have it. The generated golden fixture *is* committed,
so `HeadcountLogicTests` runs without it; only the parity check and the fixture generator need the
source, and both say so and exit non-zero rather than pretending to pass.

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
  verified against the real dataset via the Node fixtures, and `Tools/swiftcheck.test.js` catches
  unbalanced files and unresolved symbols, but nothing here type-checks. Expect build errors.
  Start with `xcodegen generate && xcodebuild` and work through them.
- **The bundled fonts fail silently.** `Font.custom("Fraunces-SemiBold", …)` with nothing
  registered does not throw or warn; it renders the system face, which looks fine and is simply
  not the design. `Tools/fonts.test.js` checks the three things that have to agree: the files on
  disk, the `UIAppFonts` list, and the PostScript names the Swift asks for. iOS resolves a font by
  its PostScript name rather than its filename, which is the part that catches people out.
- **The scan band is derived, not chosen.** `ScanGeometry` computes it from the controls drawn on
  top of the preview, because the band is also what `FrameProcessor` filters observations by: the
  drawn rect and the scanned region are one value by construction. Hard-coding it is what put the
  outline through the shutter button and the read-out chip on top of it.
- **`usesLanguageCorrection = false`** in `FrameProcessor` and `DocumentScanner` is load-bearing,
  not a preference. Turning it on makes Vision bend `NA388` toward English words. See DESIGN.md §3.1.
- **The seam tiebreak in `Router.locate`** exists because 237 of 651 endpoints match two faces at
  once and Swift's `Dictionary` order is randomized per launch. Removing the `$0.key < $1.key`
  tiebreak reintroduces a bug that changes answers between runs, and it will look like flaky OCR.
- **`SWIFT_STRICT_CONCURRENCY` starts at `minimal`.** The design can take `complete`.
  `FrameProcessor` is `@unchecked Sendable` on the specific grounds that
  `AVCaptureVideoDataOutput` serialises its delegate callbacks. The reason to start low is that
  strict checking on a first build buries the real errors under concurrency noise. Raise it in
  `project.yml` once the app runs. Add a second caller to `FrameProcessor` and that `@unchecked`
  reasoning stops holding.
- **`Info.plist` is hand-written**, so it must carry `CFBundleIdentifier`, `CFBundleExecutable`,
  `CFBundlePackageType` and friends itself. Omitting `CFBundleIdentifier` still *builds*, then
  fails at install with `Missing bundle ID` (IXErrorDomain 13). Confusing, because nothing went
  wrong at compile time.
- **Never add a `resources:` key for a path already covered by `sources:`.** XcodeGen routes
  non-compilable files into the Resources phase automatically; listing them twice produces
  "Multiple commands produce …".
