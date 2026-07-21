import XCTest
@testable import BiomedShelfScanner

/// Validates the Swift `Router` port against golden vectors generated from the working
/// JavaScript `buildRoute` (`ios/Tests/RouteGolden.json`).
///
/// Regenerate from the repo root with:
///   node scratchpad/routeGolden.js biomed-shelf-ranges.json ios/Tests/RouteGolden.json
final class RouterTests: XCTestCase {

    struct Golden: Decodable {
        struct Stop: Decodable { let id: String; let side: String; let x: Double; let cns: [String] }
        struct Step: Decodable {
            let type: String
            // transit
            let kind: String?
            let well: String?
            let to: Int?
            let skipping: Int?
            // floor
            let level: Int?
            let direction: String?
            let stops: [Stop]?
        }
        struct Expected: Decodable {
            let steps: [Step]
            let unlocated: [String]
            let bookCount: Int
            let stairs: Int
            let skips: Int
        }
        let name: String
        let input: [String]
        let expected: Expected
    }

    lazy var golden: [Golden] = {
        let url = Bundle(for: Self.self).url(forResource: "RouteGolden", withExtension: "json")!
        return try! JSONDecoder().decode([Golden].self, from: Data(contentsOf: url))
    }()

    lazy var router: Router = try! Router(bundledRanges: "biomed-shelf-ranges")

    /// Full route equivalence: step sequence, transit kinds, sweep direction, stop order.
    func testRoutesMatchJS() {
        for c in golden {
            let cns = c.input.compactMap(CallNumber.parse)
            XCTAssertEqual(cns.count, c.input.count, "[\(c.name)] parse failure")

            let route = router.buildRoute(cns)

            XCTAssertEqual(route.bookCount, c.expected.bookCount, "[\(c.name)] bookCount")
            XCTAssertEqual(route.stairDescents, c.expected.stairs, "[\(c.name)] stair descents")
            XCTAssertEqual(route.elevatorSkips, c.expected.skips, "[\(c.name)] elevator skips")
            XCTAssertEqual(Set(route.unlocated), Set(c.expected.unlocated), "[\(c.name)] unlocated")
            XCTAssertEqual(route.steps.count, c.expected.steps.count, "[\(c.name)] step count")

            for (i, (actual, want)) in zip(route.steps, c.expected.steps).enumerated() {
                switch (actual, want.type) {
                case let (.transit(t), "transit"):
                    assertTransit(t, want, "[\(c.name)] step \(i)")
                case let (.floor(leg), "floor"):
                    assertFloor(leg, want, "[\(c.name)] step \(i)")
                default:
                    XCTFail("[\(c.name)] step \(i): kind mismatch, expected \(want.type)")
                }
            }
        }
    }

    private func assertTransit(_ t: Router.Transit, _ want: Golden.Step, _ ctx: String) {
        switch t {
        case let .elevator(to, skipping):
            XCTAssertEqual(want.kind, "elevator", "\(ctx) transit kind")
            XCTAssertEqual(to, want.to, "\(ctx) elevator target")
            XCTAssertEqual(skipping, want.skipping ?? 0, "\(ctx) skipped floors")
        case let .stairs(well, to):
            XCTAssertEqual(want.kind, "stairs", "\(ctx) transit kind")
            XCTAssertEqual(well.rawValue, want.well, "\(ctx) stairwell choice")
            XCTAssertEqual(to, want.to, "\(ctx) stairs target")
        }
    }

    private func assertFloor(_ leg: Router.FloorLeg, _ want: Golden.Step, _ ctx: String) {
        XCTAssertEqual(leg.level, want.level, "\(ctx) level")
        let dir = leg.direction == .leftToRight ? "LR" : "RL"
        XCTAssertEqual(dir, want.direction, "\(ctx) sweep direction")

        // Stop *order* is the point — a route whose stops are right but ordered wrong is a route
        // that backtracks.
        let actual = leg.stops.map { "\($0.shelfID)|\($0.side)" }
        let expected = (want.stops ?? []).map { "\($0.id)|\($0.side)" }
        XCTAssertEqual(actual, expected, "\(ctx) stop order")

        for (a, e) in zip(leg.stops, want.stops ?? []) {
            XCTAssertEqual(a.callNumbers.map(\.raw), e.cns, "\(ctx) call numbers at \(a.shelfID)")
        }
    }

    /// Boundary call numbers are contained by two faces at once (one face's `end` is the next
    /// face's `start`). 237 of 651 real endpoints do this. `Dictionary` iteration order is
    /// randomized per launch, so without an explicit tiebreak this would resolve differently on
    /// different runs — a third of the collection routing to a different shelf each launch, which
    /// would look like a flaky scanner rather than an ordering bug.
    func testSeamTiebreakIsDeterministic() {
        let seam = CallNumber.parse("W1 DE244")!
        let first = router.locate(seam)
        XCTAssertNotNil(first)

        for _ in 0..<50 {
            let again = router.locate(seam)
            XCTAssertEqual(again?.level, first?.level)
            XCTAssertEqual(again?.shelfID, first?.shelfID)
            XCTAssertEqual(again?.side, first?.side)
        }
        // Matches the web app, which walks lexicographically sorted keys: bot-1 beats top-1.
        XCTAssertEqual(first?.shelfID, "bot-1")
        XCTAssertEqual(first?.side, "left")
    }

    /// A fresh Router must agree with a differently-constructed one — guards against any
    /// dictionary-order dependence sneaking back in.
    func testLocateIsStableAcrossInstances() throws {
        let a = try Router(bundledRanges: "biomed-shelf-ranges")
        let b = try Router(bundledRanges: "biomed-shelf-ranges")
        for text in ["W1 DE244", "W1 DE957", "W1 EC899", "W1 NA388 no.66 1984"] {
            let cn = try XCTUnwrap(CallNumber.parse(text))
            XCTAssertEqual(a.locate(cn)?.shelfID, b.locate(cn)?.shelfID, text)
            XCTAssertEqual(a.locate(cn)?.side, b.locate(cn)?.side, text)
        }
    }

    func testEmptyTripProducesNoSteps() {
        let route = router.buildRoute([])
        XCTAssertTrue(route.steps.isEmpty)
        XCTAssertEqual(route.bookCount, 0)
    }
}
