import XCTest
@testable import BiomedShelfScanner

/// The headcount port against golden vectors generated from the working JavaScript.
///
/// Regenerate the fixture from the repo root with:
///   node ios/Tools/headcountGolden.mjs ios/Tests/HeadcountGolden.json
///
/// The JS in `better_headcount/js/logic.js` is what has actually been run against real rounds and
/// carries 52 tests of its own. This Swift is a port, and a port is a rewrite with a plausible
/// alibi. So the JS supplies the answers and this has to reproduce them exactly.
///
/// `testSnapMatchesJS` is the one to look at first if anything here fails. Snapping decides which
/// row a walk is filed under, and a round filed under the wrong slot looks exactly like a round.
final class HeadcountLogicTests: XCTestCase {

    struct Golden: Decodable {
        struct Slot: Decodable {
            let form: String
            /// Milliseconds since the epoch, as JavaScript counts them.
            let instant: Double
            let index: Int
            let value: String
            let minutesLate: Int
            let wrapped: Bool
            let dayShift: Int
            let dayIndex: Int
            let dayValue: String
            let minutes: Int?
            let dateKey: String?
            let weekday: String?
            let label: String?
        }
        struct Payload: Decodable {
            let form: String
            let day: String
            let timeIndex: Int
            let counts: [String: Int]
            let payload: [String: String]
            let total: Int
            let expectedKeys: [String]
            let dump: String
            let fingerprint: String
        }
        struct Validation: Decodable {
            let label: String
            let payload: [String: String]
            let ok: Bool
            let errors: [String]
        }
        struct Clamp: Decodable { let n: Int; let out: Int }
        struct WalkStop: Decodable { let form: String; let entry: String }
        struct Walk: Decodable { let biomedOnly: [WalkStop]; let combined: [WalkStop] }
        struct Age: Decodable { let ms: Double; let out: String }
        struct Transition: Decodable { let state: String; let event: String; let next: String? }
        struct Backoff: Decodable { let attempt: Int; let r: Double; let ms: Double }

        let days: [String]
        let slots: [Slot]
        let named: [Slot]
        let payloads: [Payload]
        let validations: [Validation]
        let clamps: [Clamp]
        let walk: Walk
        let ages: [Age]
        let transitions: [Transition]
        let backoffs: [Backoff]
        let csv: String
    }

    lazy var golden: Golden = {
        let url = Bundle(for: Self.self).url(forResource: "HeadcountGolden", withExtension: "json")!
        return try! JSONDecoder().decode(Golden.self, from: Data(contentsOf: url))
    }()

    private func form(_ id: String) -> HeadcountConfig.Form {
        HeadcountConfig.form(id: id)!
    }

    private func date(_ jsMilliseconds: Double) -> Date {
        Date(timeIntervalSince1970: jsMilliseconds / 1000)
    }

    // MARK: Pinned schema

    /// A guard against the quiet failure mode of a hand-copied schema. The full field-by-field
    /// comparison against `js/config.js` lives in `ios/Tools/headcount.parity.test.mjs`, which
    /// runs without a compiler; this catches the version drifting on its own.
    func testDaysMatchTheForm() {
        XCTAssertEqual(HeadcountConfig.days, golden.days)
        XCTAssertEqual(HeadcountConfig.days.first, "Monday", "the Google Form's own option order")
    }

    // MARK: Snapping

    /// A full week at ten-minute resolution, per form — 2016 instants, covering every slot, every
    /// gap, and both midnight crossings.
    func testSnapMatchesJS() {
        for c in golden.slots {
            let f = form(c.form)
            let s = HeadcountLogic.snapSlot(date(c.instant), form: f)
            let at = "\(c.form) @ \(c.instant)"
            XCTAssertEqual(s.index, c.index, "index, \(at)")
            XCTAssertEqual(s.value, c.value, "value, \(at)")
            XCTAssertEqual(s.minutesLate, c.minutesLate, "minutesLate, \(at)")
            XCTAssertEqual(s.wrapped, c.wrapped, "wrapped, \(at)")
            XCTAssertEqual(s.dayShift, c.dayShift, "dayShift, \(at)")
            XCTAssertEqual(s.dayIndex, c.dayIndex, "dayIndex, \(at)")
            XCTAssertEqual(s.dayValue, c.dayValue, "dayValue, \(at)")
        }
    }

    /// The parts the snap is built on. If the timezone handling is wrong these diverge before the
    /// snap does, which makes the failure much easier to read.
    func testZonedPartsMatchJS() {
        for c in golden.slots {
            guard let minutes = c.minutes, let dateKey = c.dateKey, let weekday = c.weekday else { continue }
            let p = HeadcountLogic.zonedParts(date(c.instant))
            XCTAssertEqual(p.minutes, minutes, "minutes @ \(c.instant)")
            XCTAssertEqual(p.dateKey, dateKey, "dateKey @ \(c.instant)")
            XCTAssertEqual(p.weekday, weekday, "weekday @ \(c.instant)")
        }
    }

    /// The awkward instants, named, so a failure says which rule broke.
    func testNamedInstants() {
        for c in golden.named {
            let s = HeadcountLogic.snapSlot(date(c.instant), form: form(c.form))
            let at = "\(c.label ?? "") — \(c.form)"
            XCTAssertEqual(s.index, c.index, "index, \(at)")
            XCTAssertEqual(s.value, c.value, "value, \(at)")
            XCTAssertEqual(s.wrapped, c.wrapped, "wrapped, \(at)")
            XCTAssertEqual(s.dayValue, c.dayValue, "day, \(at)")
        }
    }

    /// The specific thing that makes near-midnight worth surfacing rather than deciding: only
    /// Biomed has an 11:00 PM slot, so at 23:50 the two forms legitimately disagree about the day.
    func testTheTwoFormsCanDisagreeAboutTheDay() {
        let late = golden.named.filter { $0.label?.contains("23:50") == true }
        XCTAssertEqual(late.count, 2, "the fixture should carry both forms at 23:50")
        let biomed = late.first { $0.form == "biomed" }
        let collab = late.first { $0.form == "collab" }
        XCTAssertEqual(biomed?.wrapped, false, "Biomed's 11 PM slot is right there")
        XCTAssertEqual(collab?.wrapped, true, "Collab's nearest slot is the next morning")
        XCTAssertNotEqual(biomed?.dayValue, collab?.dayValue,
                          "this is the disagreement the UI must report rather than resolve")
    }

    // MARK: Counts

    func testClamp() {
        for c in golden.clamps {
            XCTAssertEqual(HeadcountLogic.clamp(c.n), c.out, "clamp(\(c.n))")
        }
    }

    func testTotals() {
        for p in golden.payloads {
            XCTAssertEqual(HeadcountLogic.total(form(p.form), counts: p.counts), p.total, p.form)
        }
    }

    // MARK: The walk

    func testWalkSequenceMatchesJS() {
        let solo = HeadcountLogic.walkSequence([HeadcountConfig.biomed])
        XCTAssertEqual(solo.map(\.counter.entry), golden.walk.biomedOnly.map(\.entry))

        let both = HeadcountLogic.walkSequence([HeadcountConfig.biomed, HeadcountConfig.collab])
        XCTAssertEqual(both.map(\.counter.entry), golden.walk.combined.map(\.entry))
        XCTAssertEqual(both.map(\.form.id), golden.walk.combined.map(\.form))
    }

    /// The Hub is inside the Biomed building off Stacks Level 6, so it is counted there. Appended
    /// to the end it would be a walk back up six floors.
    func testTheHubIsCountedOffLevelSix() {
        let stops = HeadcountLogic.walkSequence([HeadcountConfig.biomed, HeadcountConfig.collab])
        guard let hub = stops.firstIndex(where: { $0.form.id == "collab" }),
              let six = stops.firstIndex(where: { $0.counter.entry == "entry.209218120" })
        else { return XCTFail("the walk is missing the Hub or Level 6") }
        XCTAssertEqual(hub, six + 1)
    }

    // MARK: Payload

    func testBuildPayloadMatchesJS() {
        for p in golden.payloads {
            let f = form(p.form)
            let built = HeadcountLogic.buildPayload(
                f, day: p.day, time: f.times[p.timeIndex], counts: p.counts)
            XCTAssertEqual(built, p.payload, p.form)
            XCTAssertEqual(HeadcountLogic.expectedKeys(f), p.expectedKeys, p.form)
        }
    }

    /// Every way a round can be wrong, with the exact wording. The Worker runs the same validator
    /// and does not trust this client; this client should not be the reason it has to.
    func testValidationMatchesJS() {
        let f = HeadcountConfig.biomed
        for c in golden.validations {
            let r = HeadcountLogic.validate(f, payload: c.payload)
            XCTAssertEqual(r.ok, c.ok, c.label)
            XCTAssertEqual(r.errors.sorted(), c.errors.sorted(), c.label)
        }
    }

    /// Byte-identical to `JSON.stringify`'s output, which is why the Swift hand-rolls the JSON
    /// rather than using `JSONEncoder` — `JSONEncoder` makes no promise about key order, and the
    /// drift check is pinned to this exact string.
    func testSchemaFingerprintIsByteIdentical() {
        for p in golden.payloads {
            XCTAssertEqual(HeadcountLogic.schemaFingerprint(form(p.form)), p.fingerprint, p.form)
        }
    }

    /// This text exists to be typed back into the Google Form by hand when everything else has
    /// failed, so it uses the form's own question names.
    func testPayloadDumpMatchesJS() {
        for p in golden.payloads {
            let dump = HeadcountLogic.payloadDump(
                form(p.form), payload: p.payload,
                submissionId: "11111111-2222-4333-8444-555555555555")
            XCTAssertEqual(dump, p.dump, p.form)
        }
        // The Hub's row must name the *form's* field, not the walker's label.
        let collab = HeadcountConfig.collab
        let dump = HeadcountLogic.payloadDump(
            collab,
            payload: HeadcountLogic.buildPayload(collab, day: "Monday", time: "8 AM", counts: [:]),
            submissionId: "x")
        XCTAssertTrue(dump.contains("Headcount Number"), "the form calls it that")
    }

    // MARK: Queue

    func testQueueTransitions() {
        for t in golden.transitions {
            let state = HeadcountLogic.QueueState(rawValue: t.state)!
            let next = HeadcountLogic.queueTransition(state, t.event)
            XCTAssertEqual(next?.rawValue, t.next, "\(t.state) --\(t.event)-->")
        }
    }

    func testBackoffMatchesJS() {
        for b in golden.backoffs {
            let got = HeadcountLogic.backoff(attempt: b.attempt, random: { b.r })
            XCTAssertEqual(got, b.ms / 1000, accuracy: 0.001,
                           "backoff(attempt: \(b.attempt), r: \(b.r))")
        }
    }

    // MARK: Formatting

    func testFormatAgeMatchesJS() {
        for a in golden.ages {
            XCTAssertEqual(HeadcountLogic.formatAge(a.ms / 1000), a.out, "\(a.ms)ms")
        }
    }

    func testCsvMatchesJS() {
        let rows = [
            ["at": "2026-08-06T21:00:00.000Z", "form": "biomed", "day": "Thursday",
             "time": "2:00 PM", "total": "57", "result": "Confirmed", "code": "recorded",
             "submissionId": "abc"],
            ["at": "2026-08-06T21:00:01.000Z", "form": "collab", "day": "Thursday",
             "time": "2PM", "total": "8",
             "result": "Failed — Google returned 200, \"no marker\"", "code": "no-marker",
             "submissionId": "def"],
        ]
        XCTAssertEqual(HeadcountLogic.csv(rows), golden.csv)
    }

    // MARK: Clock

    func testClockPlausibility() {
        XCTAssertTrue(HeadcountLogic.clockPlausible(HeadcountConfig.buildEpoch).ok)
        XCTAssertFalse(HeadcountLogic.clockPlausible(
            HeadcountConfig.buildEpoch.addingTimeInterval(-1)).ok)
        XCTAssertEqual(HeadcountLogic.clockPlausible(
            HeadcountConfig.buildEpoch.addingTimeInterval(-1)).reason, "before-build")
        XCTAssertEqual(HeadcountLogic.clockPlausible(
            HeadcountConfig.buildEpoch.addingTimeInterval(6 * 365 * 24 * 3600)).reason, "far-future")
    }
}
