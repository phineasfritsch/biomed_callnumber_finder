# Getting it on your phone, and iterating without losing your mind

Setup this is written for: **Windows workstation + MacinCloud + paid Apple Developer account.**

---

## 1. The constraint that shapes everything

**You cannot plug your iPhone into a MacinCloud machine.** Their managed plans don't do USB
passthrough, so the normal iOS loop — cable, ⌘R, running in 30 seconds — does not exist for you.
Everything has to reach the phone over the air.

That makes your realistic loop:

| | time |
| --- | --- |
| Edit on the cloud Mac | — |
| `xcodebuild archive` | 1–3 min |
| Upload to App Store Connect | 1–2 min |
| Apple processing | 5–15 min |
| Install on phone | 1 min |
| **Total** | **~10–20 min per iteration** |

Fine for "does the button work". **Hopeless for tuning OCR**, which needs dozens of cycles.

So the strategy is not to make the deploy faster. It's to **stop needing a deploy to tune
recognition** — see §3, which is the important part of this document.

> Worth a five-minute check before you build anything: confirm with MacinCloud whether your
> specific plan offers USB device redirection. A few dedicated plans advertise it. If yours does,
> you get the normal cable workflow and most of this section stops mattering.

---

## 2. Two ways onto the phone

### TestFlight — use this for real testing and for colleagues

One-time setup:

1. App Store Connect → **Apps** → **+** → New App. Bundle ID `com.biomedshelf.scanner` (matches
   `project.yml`).
2. In `project.yml`, set `DEVELOPMENT_TEAM` to your 10-character Team ID (Apple Developer →
   Membership).
3. On the Mac: `cd ios && xcodegen generate && open BiomedShelfScanner.xcodeproj`
4. Xcode → **Product → Archive** → **Distribute App** → **TestFlight & App Store**.

Then per build: bump `CURRENT_PROJECT_VERSION` in `project.yml`, archive, upload. Wait for
processing, install from the TestFlight app on your phone.

- **Internal testers** (up to 100, your own team) need **no review** — builds appear as soon as
  processing finishes. This is the path you want.
- **External testers** need a one-time review of the first build. Only relevant when you hand it to
  colleagues.
- Builds expire after 90 days.

Command-line archive, once signing works in Xcode at least once:

```bash
cd ios
xcodebuild -project BiomedShelfScanner.xcodeproj \
           -scheme BiomedShelfScanner \
           -configuration Release \
           -archivePath build/Scanner.xcarchive \
           archive
xcodebuild -exportArchive \
           -archivePath build/Scanner.xcarchive \
           -exportPath build/ipa \
           -exportOptionsPlist ExportOptions.plist
xcrun altool --upload-app -f build/ipa/BiomedShelfScanner.ipa \
             -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
```

### Ad-hoc + OTA link — faster, for your own rapid iteration

Skips Apple's processing queue entirely: **~3 minutes instead of ~15.**

1. Register your iPhone's UDID (Apple Developer → Devices). Get the UDID from Finder/iTunes, or
   from Settings → General → About on iOS 16+ after tapping into the details.
2. Export with `method: release-testing` (Xcode 15+; older Xcode calls it `ad-hoc`).
3. Upload the `.ipa` to a distribution service (Diawi, InstallOnAir — both have free tiers), open
   the link on your phone, install.

Ad-hoc profiles cover 100 devices per year. Use this while you're iterating alone; switch to
TestFlight when other people are involved.

---

## 3. Tune OCR without deploying — the actual answer

This is the part that makes the slow loop survivable.

The recognizer is **pure logic**: `extract → parse → isWellFormed → locate`. No camera, no Vision,
no UI. So if you capture what Vision *actually returned* on real labels, you can replay that
offline and iterate as fast as you can type — on Windows, with no Mac involved at all.

### Capture once

1. In the app: sheet menu (**⋯**) → **Scan diagnostics** → toggle **Record what Vision sees**.
2. Go scan a shelf. Fifty labels is plenty. Include the ones that fail — those are the valuable ones.
3. **Export corpus** → AirDrop or email the folder to yourself.

You get `corpus.json` (every ranked Vision candidate, verbatim, with confidences) plus a JPEG for
each frame that failed.

### Then iterate on Windows

```bash
node ios/Tools/replay.js biomed-shelf-ranges.json corpus.json
```

To measure accuracy rather than just observe behaviour, add `expected` to records in
`corpus.json` — the correct call number, or `""` if the frame genuinely contains none:

```json
{ "candidates": [...], "expected": "W1 NA388 no.66 1984" }
```

Then replay classifies every mistake into three buckets, which need completely different responses:

- **WRONG** — confidently produced the wrong call number. The dangerous bucket: it walks someone to
  the wrong shelf. Fix before anything else.
- **MISSED** — a real label the pipeline threw away. Costs a manual entry. Annoying, not dangerous.
- **SPURIOUS** — invented a call number from a book title or shelf sign. Pollutes the trip list.

Edit `ios/Tools/recognizer.js` — one copy of the model, shared by `replay.js`, `pipeline.js` and
`confusable.test.js` — re-run, compare. Seconds per iteration. When it's right, port the identical
change into the Swift and deploy **once**.

Before you deploy, run the two suites that do not need a corpus:

```bash
node ios/Tools/pipeline.js            # named cases, readable
node ios/Tools/confusable.test.js     # the same rules across all 906 range endpoints
```

`confusable.test.js` is the one that catches collateral damage: it resolves every endpoint through
the old pipeline and the new one and fails if *any* of them changed where it routes. A grammar
tweak that fixes your label and quietly moves forty others will not get past it.

### Reading the JPEGs

When a label won't scan there are two completely different causes, and the corpus tells you which:

- `candidates` is **empty or garbage** → *Vision* didn't read it. A camera problem: lighting, ROI,
  distance, glare, focus. Look at the JPEG; adjust `wideROI`/`precisionROI` or use the torch.
- `candidates` **contains the right text** but the outcome is `none` → the *pipeline* rejected a
  good read. A grammar problem. Fixable entirely in `replay.js`, no deploy.

Conflating these two wastes days. Always check which one you have before changing anything.

---

## 4. Test at your desk, not in the stacks

```bash
node ios/Tools/testsheet.js biomed-shelf-ranges.json ios/Tools/test-labels.html
```

Open in a browser, **print at 100%** (not "fit to page" — scaling changes the glyph size the
scanner sees, which is the whole variable you're testing). You get real call numbers from the live
dataset, laid out the way Biomed actually prints spine labels: one token per line, monospaced,
`Biomed` header.

Each card shows the shelf it should resolve to. The orange dashed cards at the bottom are the
known-odd real endpoints (`ZWZ 330`, `Q 41 R81R8`, …) that the grammar **correctly rejects** —
they're there so you can verify the manual-entry path works, not just the happy path.

This won't fully substitute for real spines: printed paper is flat, evenly lit, and unglossy, while
real labels are curved, laminated, and often in shadow. Use the sheet to prove the pipeline works,
then a real shelf to prove the *camera* works.

---

## 5. Suggested order

Each step de-risks the next, cheapest first.

1. **Get it compiling.** Nothing was ever compiled — expect errors. `xcodegen generate`, then
   build, then work through them.
2. **⌘U in the Simulator.** `CallNumberTests` + `RouterTests` prove the port is faithful to the
   working JS. No device needed. If these fail, stop — everything rests on the comparator.
3. **Simulator smoke test.** Camera won't work, but manual entry, routing, check-off and
   persistence all do. Type `W1 NA388 no.66 1984` → expect Level 2, top-5, right.
4. **First TestFlight build.** Confirm the camera opens, the torch works, and *any* label scans.
5. **Print the test sheet.** Scan it at your desk. Fix what's broken.
6. **Capture a corpus on a real shelf.** Fifty labels. Export.
7. **Iterate on Windows** until the numbers are good.
8. **One more deploy.** Then use it for a real shelving trip and see what the *workflow* gets wrong
   — which is a different question from what the OCR gets wrong, and the one you can only answer
   with a cart in front of you.

---

## 6. If Vision disappoints on real labels

Before rewriting anything, check in this order — cheapest first, and the first three are far more
often the cause than the model is:

1. **Distance and fill.** The label should fill most of the ROI band. Vision needs roughly 20+
   pixels of glyph height; a label shot from two feet away won't have it.
2. **Precision mode.** If it's reading the neighbouring spine, narrow the ROI (top-left toggle).
3. **Torch.** The lower stacks are genuinely dark and laminated labels throw glare — try both on
   and off, they fail differently.
4. **`recognitionLevel`.** Already `.accurate`. If it's too slow on older hardware, `.fast` is the
   trade, but expect worse reads.
5. **`minConfidence`** in `CallNumberRecognizer` (default 0.4). Raising it cuts spurious reads;
   lowering it recovers missed ones. Tune against a corpus, not against a hunch — that's exactly
   what replay is for.

Only after all of those, consider whether the grammar needs widening. And if you widen it, re-run
`testGrammarRejectsDangerousMisreads` — that test exists to stop a well-meant fix from
reintroducing wrong-shelf routing.
