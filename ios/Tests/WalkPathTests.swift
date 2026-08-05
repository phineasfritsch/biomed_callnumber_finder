import XCTest
@testable import BiomedShelfScanner

/// The walking geometry — the part that turns "index 6 · top · right" into a place to stand and a
/// direction to face.
///
/// These are the same assertions as `Tools/walk.test.js`, which runs against the code shipped
/// inside `index.html`. Two apps drawing different routes from the same dataset is worse than
/// either being wrong alone, because staff trust whichever they looked at last — so the contract
/// is written down twice on purpose, and both copies have to pass.
///
/// Several of these exist because the obvious implementation gets them backwards.
final class WalkPathTests: XCTestCase {

    private func stop(_ id: String, _ side: String, _ x: Double, _ row: Router.Shelf.Row?)
        -> Router.Stop
    {
        Router.Stop(shelfID: id, side: side, x: x, row: row,
                    range: Router.Range(start: "A", end: "Z"),
                    callNumbers: [])
    }

    // MARK: Standing position

    /// You cannot read a face from inside the shelf. The stop is in the aisle beside the column,
    /// and which aisle depends on which way the face points.
    func testStandingPosition() {
        XCTAssertEqual(WalkPath.standX(stop("top-6", "left", 6, .top)), 5.5,
                       "a left face is read from the aisle to its west")
        XCTAssertEqual(WalkPath.standX(stop("top-6", "right", 6, .top)), 6.5,
                       "a right face from the aisle to its east")
        XCTAssertEqual(WalkPath.standX(stop("bot-14", "single", 14, .bottom)), 14.5,
                       "half shelves are right-side-only and read the same way")

        // The consequence that matters: one aisle serves two faces, and one column is two places.
        XCTAssertEqual(WalkPath.standX(stop("top-6", "right", 6, .top)),
                       WalkPath.standX(stop("top-7", "left", 7, .top)),
                       "shelf 6 right and shelf 7 left are the same aisle")
        XCTAssertNotEqual(WalkPath.standX(stop("top-6", "left", 6, .top)),
                          WalkPath.standX(stop("top-6", "right", 6, .top)),
                          "the two faces of one shelf are not the same place")

        XCTAssertEqual(WalkPath.lane(stop("top-3", "left", 3, .top)), .top)
        XCTAssertEqual(WalkPath.lane(stop("bot-3", "left", 3, .bottom)), .bottom)
        XCTAssertEqual(WalkPath.lane(stop("??", "left", 8, nil)), .bottom,
                       "an unknown row falls back to the bottom, matching groupStops")
    }

    // MARK: Which hand

    /// Aisles run north–south. Facing into a top-row aisle you look north, so east is on your
    /// right; into a bottom-row aisle you look south and east is on your left. The shelf is on the
    /// side its face points away from — so the same `side` flips hands between the rows. This is
    /// the single most reversible thing in the file and the one a reader trusts blindly.
    func testWhichHand() {
        XCTAssertEqual(WalkPath.hand(row: .top, side: "left"), .right,
                       "top row, left face — the shelf is east of you, which is your right")
        XCTAssertEqual(WalkPath.hand(row: .top, side: "right"), .left)
        XCTAssertEqual(WalkPath.hand(row: .bottom, side: "left"), .left,
                       "bottom row — east is now your left")
        XCTAssertEqual(WalkPath.hand(row: .bottom, side: "right"), .right)
        XCTAssertEqual(WalkPath.hand(row: .bottom, side: "single"), .right,
                       "a half shelf faces east like any right face")
        XCTAssertNotEqual(WalkPath.hand(row: .top, side: "left"),
                          WalkPath.hand(row: .bottom, side: "left"),
                          "the hand flips between rows for the same face")
    }

    // MARK: Turning

    func testTurns() {
        XCTAssertEqual(WalkPath.turn(heading: 1, row: .top), .left)
        XCTAssertEqual(WalkPath.turn(heading: 1, row: .bottom), .right)
        XCTAssertEqual(WalkPath.turn(heading: -1, row: .top), .right)
        XCTAssertEqual(WalkPath.turn(heading: -1, row: .bottom), .left)
        XCTAssertEqual(WalkPath.turn(heading: 0, row: .top), .ahead,
                       "no movement means no turn to describe")
        XCTAssertEqual(WalkPath.turn(heading: 9, row: .top), WalkPath.turn(heading: 1, row: .top),
                       "magnitude does not matter, only sign")
    }

    func testAisleLabels() {
        XCTAssertEqual(WalkPath.aisleLabel(6.5), "the aisle between 6 and 7")
        XCTAssertEqual(WalkPath.aisleLabel(-0.5), "the west wall, before shelf 0")
        XCTAssertEqual(WalkPath.aisleLabel(16.5), "the east end, past shelf 16")
    }

    // MARK: Turn by turn

    func testSteps() {
        let (steps, exitShelves) = WalkPath.steps(
            stops: [stop("top-2", "left", 2, .top), stop("bot-11", "right", 11, .bottom)],
            entry: 6.5, exit: 13.5)
        XCTAssertEqual(steps.map(\.shelves), [5, 10], "distances count shelves passed")
        XCTAssertEqual(steps.map(\.heading), [-1, 1])
        XCTAssertEqual(steps[0].turn, .right, "walking west into the top row is a right turn")
        XCTAssertEqual(steps[0].hand, .right)
        XCTAssertEqual(steps[1].turn, .right, "walking east into the bottom row is a right turn")
        XCTAssertEqual(steps[1].hand, .right)
        XCTAssertEqual(exitShelves, 2)
        XCTAssertEqual(steps.map(\.n), [1, 2], "numbering is 1-based and matches the map badges")

        let (same, sameExit) = WalkPath.steps(
            stops: [stop("top-6", "right", 6, .top)], entry: 6.5, exit: 6.5)
        XCTAssertEqual(same[0].shelves, 0)
        XCTAssertEqual(same[0].turn, .ahead)
        XCTAssertEqual(sameExit, 0)
    }

    // MARK: Plan coordinates

    /// The map draws in the floor plan's own space, so a stop lands on the picture the app already
    /// shows. If these drift the walk is drawn over the wrong shelves.
    func testPlanCoordinates() {
        XCTAssertEqual(WalkPath.Plan.x(0), WalkPath.Plan.startX + WalkPath.Plan.slotW / 2)
        XCTAssertEqual(WalkPath.Plan.x(6.5), WalkPath.Plan.x(6) + WalkPath.Plan.slotW / 2,
                       "an aisle maps to the gap between two slots")
        XCTAssertEqual(WalkPath.Plan.x(6.5), (WalkPath.Plan.x(6) + WalkPath.Plan.x(7)) / 2)
        XCTAssertEqual(WalkPath.Plan.col(WalkPath.Plan.x(6.5)), 6.5, accuracy: 1e-9)

        let cy = WalkPath.Plan.y(.corridor)
        XCTAssertGreaterThan(cy, WalkPath.Plan.topY + WalkPath.Plan.topH)
        XCTAssertLessThan(cy, WalkPath.Plan.botY)
        XCTAssertGreaterThan(WalkPath.Plan.y(.top), WalkPath.Plan.topY)
        XCTAssertLessThan(WalkPath.Plan.y(.top), WalkPath.Plan.topY + WalkPath.Plan.topH)
    }

    // MARK: Doors

    /// A stairwell is not a point. Walking down the west stairwell puts you out on its far side, so
    /// entry and exit are different edges — a map that starts and ends every floor at one dot
    /// points you the wrong way half the time.
    func testDoors() {
        let down = WalkPath.Doors.door(for: .stairs(.west), going: .out)!
        let up = WalkPath.Doors.door(for: .stairs(.west), going: .in)!
        XCTAssertLessThan(down.x, up.x, "you walk down the west stairwell's west edge")
        XCTAssertEqual(down.y, up.y)

        let eDown = WalkPath.Doors.door(for: .stairs(.east), going: .out)!
        let eUp = WalkPath.Doors.door(for: .stairs(.east), going: .in)!
        XCTAssertEqual(eDown.x, eUp.x)
        XCTAssertLessThan(eDown.y, eUp.y, "down from the north edge, arriving at the south edge")
        XCTAssertEqual(eDown.via, .corridor, "the north edge opens straight onto the corridor")
        XCTAssertEqual(eUp.via, .lobby, "the south edge opens onto the lobby")

        XCTAssertNil(WalkPath.Doors.door(for: .none, going: .out),
                     "the last floor of a trip has no exit to draw")

        let lift = WalkPath.Doors.elevator
        XCTAssertEqual(lift.via, .lobby, "the elevator opens south")
    }

    /// The floor is walkable all the way round: both rows are islands and every aisle has two open
    /// ends. So a door costs how far along you walk plus how far in it is set, with no forced
    /// detour. An earlier model sealed the bottom row except for two slots, which made the
    /// south-facing doors far dearer than they are and picked the wrong stairwell.
    func testDoorCost() {
        let lift = WalkPath.Doors.elevator
        let esDown = WalkPath.Doors.eastDown

        XCTAssertLessThan(WalkPath.depth(esDown), 1,
                          "the east stairwell steps straight onto the corridor")
        XCTAssertGreaterThan(WalkPath.depth(lift), 3, "the elevator is a full row deeper in")

        XCTAssertEqual(WalkPath.cost(esDown, to: WalkPath.column(esDown)), WalkPath.depth(esDown),
                       accuracy: 1e-9,
                       "a door costs nothing extra to reach the column it is already at")
        XCTAssertGreaterThan(WalkPath.cost(lift, to: 16), WalkPath.cost(lift, to: 8),
                             "and costs more the further along you have to walk")
        XCTAssertEqual(WalkPath.cost(lift, to: WalkPath.column(lift) + 3),
                       WalkPath.cost(lift, to: WalkPath.column(lift) - 3), accuracy: 1e-9,
                       "cost is symmetric about the door")

        // Door columns are read off the drawing, so they have to land where the blocks are.
        XCTAssertGreaterThan(WalkPath.column(lift), 5)
        XCTAssertLessThan(WalkPath.column(lift), 8)
        XCTAssertGreaterThan(WalkPath.column(esDown), 12)
        XCTAssertLessThan(WalkPath.column(esDown), 14)
    }

}
