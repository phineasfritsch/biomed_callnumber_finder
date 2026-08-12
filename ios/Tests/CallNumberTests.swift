import XCTest
@testable import BiomedShelfScanner

/// Validates the Swift `CallNumber` port against golden vectors generated from the working
/// JavaScript comparator (`ios/CallNumberGolden.json`).
///
/// Regenerate the fixture from the repo root with:
///   node scratchpad/golden.js biomed-shelf-ranges.json ios/CallNumberGolden.json
///
/// If `testSortedOrderMatchesJS` fails, the port's ordering has drifted — fix that before
/// touching anything downstream. Routing correctness rests entirely on this comparator.
final class CallNumberTests: XCTestCase {

    struct Golden: Decodable {
        struct Hit: Decodable { let lvl: Int; let id: String; let side: String }
        struct Locate: Decodable { let cn: String; let hit: Hit? }
        struct Search: Decodable { let cn: String; let hits: [Hit] }
        struct Pair: Decodable { let a: String; let b: String; let cmp: Int }
        let sortedOrder: [String]
        let locates: [Locate]
        let searches: [Search]
        let pairs: [Pair]
    }

    lazy var golden: Golden = {
        let url = Bundle(for: Self.self).url(forResource: "CallNumberGolden", withExtension: "json")!
        return try! JSONDecoder().decode(Golden.self, from: Data(contentsOf: url))
    }()

    /// The whole dataset, re-sorted by the Swift comparator, must land in the exact order the
    /// JS comparator produced. 651 endpoints — this catches any subtle ordering divergence.
    func testSortedOrderMatchesJS() {
        let parsed = golden.sortedOrder.compactMap(CallNumber.parse)
        XCTAssertEqual(parsed.count, golden.sortedOrder.count, "some endpoints failed to parse")

        let resorted = parsed.sorted().map(\.raw)
        XCTAssertEqual(resorted, golden.sortedOrder)
    }

    /// Pairwise cases chosen to exercise decimal-Cutter ordering, which is the most
    /// port-hostile rule: NA388 is .388 and NA1991 is .1991, so NA388 sorts *after* NA1991.
    func testPairwiseComparisons() {
        for p in golden.pairs {
            guard let a = CallNumber.parse(p.a), let b = CallNumber.parse(p.b) else {
                return XCTFail("failed to parse \(p.a) / \(p.b)")
            }
            XCTAssertEqual(CallNumber.compare(a, b), p.cmp, "cmp(\(p.a), \(p.b))")
        }
    }

    /// Every call number the JS locates must resolve to the same shelf face in Swift.
    func testLocateMatchesJS() throws {
        let router = try Router(bundledRanges: "biomed-shelf-ranges")
        for c in golden.locates {
            guard let cn = CallNumber.parse(c.cn) else { return XCTFail("parse failed: \(c.cn)") }
            let hit = router.locate(cn)
            XCTAssertEqual(hit?.level, c.hit?.lvl, "level for \(c.cn)")
            XCTAssertEqual(hit?.shelfID, c.hit?.id, "shelf for \(c.cn)")
            XCTAssertEqual(hit?.side, c.hit?.side, "side for \(c.cn)")
        }
    }

    /// The website's SEARCH (index.html `locate()`) is a different operation from routing:
    /// every matching face, level-ascending, Level 9 excluded. 263 of 653 real queries match
    /// more than one face (serial runs) — showing only the first was the "search is completely
    /// wrong" field bug. Order matters and is asserted exactly.
    func testSearchMatchesWebsite() throws {
        let router = try Router(bundledRanges: "biomed-shelf-ranges")
        for c in golden.searches {
            guard let cn = CallNumber.parse(c.cn) else { return XCTFail("parse failed: \(c.cn)") }
            let got = router.search(cn).map { "\($0.level)|\($0.shelfID)|\($0.side)" }
            let want = c.hits.map { "\($0.lvl)|\($0.id)|\($0.side)" }
            XCTAssertEqual(got, want, "search(\(c.cn))")
        }
    }

    /// The scan target from the real spine photo, end to end.
    func testRealSpineLabelResolves() throws {
        let router = try Router(bundledRanges: "biomed-shelf-ranges")
        let cn = try XCTUnwrap(CallNumber.parse("W1 NA388 no.66 1984"))
        let hit = try XCTUnwrap(router.locate(cn), "W1 NA388 must resolve")
        XCTAssertEqual(hit.level, 2)
        XCTAssertEqual(hit.shelfID, "top-5")
        XCTAssertEqual(hit.side, "right")
    }

    /// The two W namespaces must never match across schemes: the biomedical serials prefix
    /// (W1–W4, floors 1–7) vs NLM class W + number ("W 13", floor 10).
    func testSchemeGating() throws {
        XCTAssertEqual(CallNumber.parse("W1 NA388")?.scheme, .w1)
        XCTAssertEqual(CallNumber.parse("W 13 D5537")?.scheme, .nlm)
        XCTAssertEqual(CallNumber.parse("WM 13 D5537")?.scheme, .nlm)
        XCTAssertEqual(CallNumber.parse("W4C AB123")?.scheme, .w1)
    }

    // MARK: - Well-formedness (see DESIGN.md §3.3)

    /// The grammar must accept essentially the whole real collection. Measured at 644/651 when
    /// this was written; the 7 known misfits are listed in `knownOddEndpoints`. If this count
    /// drops, the grammar got too strict and real books became unscannable.
    func testGrammarAcceptsRealEndpoints() {
        let knownOddEndpoints: Set<String> = [
            "A", "ZWZ 330", "Q 41 R81R8", "Q 41 R81S7",
            "WX 27 GF7 P3R5D", "WC 160 G7.78T", "BF 789 D4 6456s",
        ]
        let rejected = golden.sortedOrder
            .filter { !knownOddEndpoints.contains($0) }
            .filter { CallNumber.parse($0)?.isWellFormed != true }

        XCTAssertTrue(rejected.isEmpty, "grammar rejected real endpoints: \(rejected)")
    }

    /// The load-bearing test. Each of these *locates successfully* — at the wrong shelf — so
    /// range containment cannot reject them. Only the grammar can. If this test fails, the
    /// scanner will confidently send someone to the wrong floor.
    func testGrammarRejectsDangerousMisreads() {
        let misreads = [
            "W1 NA3B8 no.66 1984",           // 8→B; locates at L2 top-6 — wrong shelf
            "W1 NA5B8 no.66 1984",           // compound misread; also locates
            "WI NA388 no.66 1984",           // 1→I; flips scheme, locates at L9 — wrong floor
            "PHOTOCHEMOTHERAPEUTIC ASPECTS", // spine title noise
        ]
        for m in misreads {
            let cn = CallNumber.parse(m)
            XCTAssertFalse(cn?.isWellFormed ?? false, "grammar must reject: \(m)")
        }
    }

    /// Documents *why* the grammar can't simply allow "letters-digits-letters-digits": the real
    /// `A1C7` and the bogus `NA3B8` are the same shape. The A1 form is whitelisted narrowly.
    func testGrammarAcceptsRealJammedCutters() {
        for s in ["W1 A1C7", "W1 A1C8", "W1 A1Q2", "W1 NE286DB", "W1 CA756TA", "W4C Z89P 2009"] {
            XCTAssertTrue(CallNumber.parse(s)?.isWellFormed ?? false, "must accept: \(s)")
        }
    }

    /// Constrained decoding end to end: given Vision's ranked candidates where the top read is
    /// corrupt, the recognizer must fall through to the correct lower-ranked one.
    func testRecognizerPrefersWellFormedLowerRankedCandidate() throws {
        let router = try Router(bundledRanges: "biomed-shelf-ranges")
        let recognizer = CallNumberRecognizer(router: router)

        let result = recognizer.resolve(candidates: [
            "Biomed W1 NA3B8 no.66 1984",             // Vision's top pick — corrupt
            "Photochemotherapeutic Aspects of",       // the spine title, also in frame
            "Biomed W1 NA388 no.66 1984",             // the truth, ranked third
        ])

        guard case let .located(cn, hit)? = result else {
            return XCTFail("expected a located result, got \(String(describing: result))")
        }
        XCTAssertEqual(cn.raw, "W1 NA388 NO.66 1984")
        XCTAssertEqual(hit.level, 2)
        XCTAssertEqual(hit.shelfID, "top-5")
    }

    /// Extraction must not match a prefix and stop mid-token.
    ///
    /// This is the bug that made the grammar gate useless: the pattern matched `W1 NA3B` out of
    /// `W1 NA3B8`, dropping the trailing 8 and laundering a corrupt read into a well-formed one.
    /// The gate then saw a clean call number and waved it through. If this test fails, §3.3's
    /// defense is bypassed at its own input stage.
    func testExtractionDoesNotTruncateMidToken() {
        XCTAssertTrue(
            CallNumberRecognizer.extract(from: "Biomed W1 NA3B8 no.66 1984").isEmpty,
            "a corrupt token must fail extraction outright, not be trimmed into a valid one"
        )
        XCTAssertEqual(
            CallNumberRecognizer.extract(from: "Biomed\nW1\nNA388\nno.66\n1984").first,
            "W1 NA388 NO.66 1984"
        )
    }

    /// Extraction must still reach the real oddities the general form would exclude.
    func testExtractionAcceptsRealForms() {
        let expected = [
            "W1 A1C7": "W1 A1C7",                 // jammed double cutter
            "W1 CA756TA": "W1 CA756TA",           // 2-letter suffix
            "W1 AM489H": "W1 AM489H",             // 1-letter suffix
            "W1 NE286DB": "W1 NE286DB",
            "WM 13 D5537": "WM 13 D5537",         // NLM class + number
            "QL737.C22": "QL737.C22",             // LC dot separator
            "W4C Z89P 2009": "W4C Z89P 2009",     // prefix + year
        ]
        for (input, want) in expected {
            XCTAssertEqual(CallNumberRecognizer.extract(from: input).first, want, input)
        }
    }

    // MARK: - O read as zero (see CallNumberRecognizer.restoringConfusableO)

    /// The dangerous half. `W1 J0506` was well-formed under the old grammar, located, and sent
    /// you to a shelf the book is not on — for every one of the 49 `JO` endpoints in the
    /// building, which is most of a floor. The grammar must now reject it outright, exactly as
    /// it rejects `NA3B8`.
    func testGrammarRejectsCutterDigitsStartingWithZero() {
        for s in ["W1 J0506", "W1 J0955 no.66 1984", "W1 M0644", "WM 13 D0537"] {
            XCTAssertFalse(CallNumber.parse(s)?.isWellFormed ?? false, "must reject: \(s)")
        }
    }

    /// The useful half: having rejected it, the recognizer must still find the book.
    func testRecognizerRestoresOMisreadAsZero() throws {
        let router = try Router(bundledRanges: "biomed-shelf-ranges")
        let recognizer = CallNumberRecognizer(router: router)

        // Stacked exactly as Vision returns a spine label.
        guard case let .located(cn, hit)? = recognizer.resolve(
            candidates: ["Biomed\nW1\nJ0506\nno.66\n1984"]
        ) else { return XCTFail("expected a located result") }

        XCTAssertEqual(cn.raw, "W1 JO506 NO.66 1984")

        let truth = try XCTUnwrap(CallNumber.parse("W1 JO506 no.66 1984"))
        XCTAssertEqual(hit.level, router.locate(truth)?.level)
        XCTAssertEqual(hit.shelfID, router.locate(truth)?.shelfID)
        XCTAssertEqual(hit.side, router.locate(truth)?.side)
    }

    /// Ordering: a repair is a *fallback within one candidate*, never a promotion above a
    /// better-ranked candidate that reads cleanly on its own.
    func testRepairNeverOutranksACleanRead() throws {
        let router = try Router(bundledRanges: "biomed-shelf-ranges")
        let recognizer = CallNumberRecognizer(router: router)

        let result = recognizer.resolve(candidates: [
            ("W1 NA388 no.66 1984", 0.90),   // clean, ranked first
            ("W1 J0506", 0.95),              // would repair, ranked second
        ])
        guard case let .located(cn, _)? = result else { return XCTFail("expected located") }
        XCTAssertEqual(cn.raw, "W1 NA388 NO.66 1984")

        XCTAssertEqual(CallNumberRecognizer.readings(of: "W1 J0506").count, 2)
        XCTAssertTrue(CallNumberRecognizer.readings(of: "W1 J0506")[0].contains("J0506"))
        XCTAssertTrue(CallNumberRecognizer.readings(of: "W1 J0506")[1].contains("JO506"))
    }

    /// The repair must stay out of everything it was not aimed at. A false positive here is a
    /// wrong shelf invented out of a read that was previously just a miss.
    func testRepairLeavesEverythingElseAlone() {
        let untouched = [
            "W1 NA388 no.66 1984",   // clean label
            "W1 A1C7",               // jammed double cutter
            "WM 13 D5537",
            "QL737.C22",
            "W1 NA388 pt.3",         // trailers containing digits
            "W1 NA388 v.2",
            "W1 NA388 2001",         // a year with zeros in it
            "W1 NA1991 no.100",      // a volume with zeros in it
            "W1 NA3O8",              // O *inside* a digit run: deliberately NOT repaired
        ]
        for s in untouched {
            XCTAssertNil(
                CallNumberRecognizer.restoringConfusableO(CallNumberRecognizer.normalized(s)),
                "repair must not fire on: \(s)"
            )
        }
    }

    /// A documented, accepted limit — not a bug to fix by tightening the grammar.
    ///
    /// `NA3BB` (a 2-letter-suffix corruption of `NA388`) is structurally identical to the real
    /// `CA756TA`, so no grammar can separate them. It is harmless: it parses to cutter `.3`, and
    /// the L2/top-5/right face spans `.1991`–`.835`, so it lands on the *same shelf* as `NA388`.
    /// Coarse ranges are useless as a validator (§3.3) but they do absorb small digit errors.
    /// The call number shown in the list is wrong; the shelf you walk to is right, and the human
    /// reviewing the list is the backstop.
    func testKnownBenignCorruptionLandsOnSameShelf() throws {
        let router = try Router(bundledRanges: "biomed-shelf-ranges")
        let truth = try XCTUnwrap(CallNumber.parse("W1 NA388 no.66 1984"))
        let corrupt = try XCTUnwrap(CallNumber.parse("W1 NA3BB no.66 1984"))

        XCTAssertTrue(corrupt.isWellFormed, "documenting that the grammar cannot reject this")
        XCTAssertEqual(router.locate(corrupt)?.shelfID, router.locate(truth)?.shelfID)
        XCTAssertEqual(router.locate(corrupt)?.level, router.locate(truth)?.level)
    }
}
