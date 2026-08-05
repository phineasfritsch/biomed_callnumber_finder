import CoreGraphics
import Foundation

/// Where the walk physically goes.
///
/// `Router` produces the *order* of the faces. It never produced a *place*: "index 6 · top ·
/// right" is a coordinate in the dataset, not somewhere you can stand. This turns an ordered list
/// of stops into a path — which door you come through, which aisle you stand in, which way you
/// turn into it, and which hand the shelf is on.
///
/// ## Ported, not reinvented
///
/// This is a transcription of the `walk-core` block and the door geometry in
/// `.build_locator.py` (shipped inside `index.html`), which `Tools/walk.test.js` exercises.
/// `Tests/WalkPathTests.swift` asserts the same facts against this file. A change here needs the
/// matching change there, or the two apps will draw different routes from the same data — worse
/// than either being wrong alone, because staff will trust whichever they looked at last.
///
/// ## Two coordinate systems, kept apart
///
/// * **Column units** — the same 0...16 index the shelf ids already use. Standing positions and
///   the turn-by-turn are in column units and hold no pixels, so they compare to the web app
///   directly.
/// * **Plan coordinates** — `Plan` is the floor plan's own 720-wide drawing space, the one the web
///   app's SVG uses. Doors live here, because a door is an edge of a drawn block, not a column.
///
/// ## You do not stand at the column, you stand beside it
///
/// A full shelf is two faces back to back: the `left` face's readable surface points west, the
/// `right` face's points east, and you cannot read a face from inside the shelf. So a stop sits in
/// the aisle at `index - 0.5` for a left face and `index + 0.5` for a right one. Half shelves are
/// right-side-only and take the same `+0.5`.
///
/// Two consequences the naive model gets wrong: one column is often two different places to
/// stand, and one aisle usually serves two faces — the right face of shelf 6 and the left face of
/// shelf 7 are the same spot, and the path must not walk out and back in between them.
enum WalkPath {

    // MARK: Lanes

    /// Aisles run north–south and are dead ends; the corridor between the two rows runs east–west
    /// and is the only way between them. A stop is placed in its row's lane, in the aisle it is
    /// read from.
    enum Lane: String { case top, corridor, bottom }

    // MARK: Geometry

    /// The aisle you stand in to read this face, in column units. Always a half-integer.
    static func standX(_ stop: Router.Stop) -> Double {
        stop.side == "left" ? stop.x - 0.5 : stop.x + 0.5
    }

    static func lane(_ stop: Router.Stop) -> Lane {
        stop.row == .top ? .top : .bottom
    }

    enum Hand: String { case left, right }

    /// Which hand the shelf is on once you have turned into the aisle.
    ///
    /// Facing into a top-row aisle you look north, so east is on your right; into a bottom-row
    /// aisle you look south and east is on your left. The shelf is on the side its face points
    /// *away* from, so the same `side` swaps hands between the rows.
    ///
    /// This is the most reversible line in the file and the one a reader will trust without
    /// checking. Getting it backwards is worse than saying nothing: they turn to a shelf of
    /// unrelated call numbers and conclude the map is broken.
    static func hand(row: Router.Shelf.Row?, side: String) -> Hand {
        let top = (row ?? .bottom) == .top
        return side == "left" ? (top ? .right : .left) : (top ? .left : .right)
    }

    enum Turn: String { case left, right, ahead }

    /// Which way you pivot off the corridor. `heading` is east(+)/west(−).
    static func turn(heading: Double, row: Router.Shelf.Row?) -> Turn {
        guard heading != 0 else { return .ahead }
        let top = (row ?? .bottom) == .top
        return heading > 0 ? (top ? .left : .right) : (top ? .right : .left)
    }

    static func aisleLabel(_ sx: Double) -> String {
        let a = Int(floor(sx)), b = a + 1
        if a < 0 { return "the west wall, before shelf 0" }
        if b > 16 { return "the east end, past shelf 16" }
        return "the aisle between \(a) and \(b)"
    }

    /// The same name with the words taken out, for a line that has to fit everything about one
    /// stop.
    static func aisleShort(_ sx: Double) -> String {
        let a = Int(floor(sx)), b = a + 1
        if a < 0 { return "west wall" }
        if b > 16 { return "east end" }
        return "aisle \(a)·\(b)"
    }

    // MARK: The path in words

    struct Step: Identifiable {
        /// 1-based, and the same number as the map badge.
        let n: Int
        let stopIndex: Int
        /// +1 east, −1 west, 0 you are already in this aisle.
        let heading: Int
        /// Shelves passed along the corridor — the unit painted on the floor in front of you.
        /// Stop to stop this is whole, because every standing position is a half-integer; the
        /// first move is measured from a door and can land on a half, so it is worded differently.
        let shelves: Double
        let x: Double
        let aisle: String
        let turn: Turn
        let hand: Hand
        let row: Router.Shelf.Row?
        let side: String
        let index: Double

        var id: Int { n }
    }

    static func steps(stops: [Router.Stop], entry: Double, exit: Double)
        -> (steps: [Step], exitShelves: Double)
    {
        var from = entry
        var out: [Step] = []
        for (i, st) in stops.enumerated() {
            let sx = standX(st), delta = sx - from
            out.append(Step(
                n: i + 1,
                stopIndex: i,
                heading: delta > 0 ? 1 : (delta < 0 ? -1 : 0),
                shelves: abs(delta),
                x: sx,
                aisle: aisleLabel(sx),
                turn: turn(heading: delta, row: st.row),
                hand: hand(row: st.row, side: st.side),
                row: st.row,
                side: st.side,
                index: st.x
            ))
            from = sx
        }
        return (out, abs(exit - from))
    }

    // MARK: Plan coordinates and doors

    /// The floor plan's drawing space, identical to the web app's SVG viewBox so the two are the
    /// same picture at different sizes.
    enum Plan {
        static let width: Double = 720
        static let startX: Double = 20
        static let slotW: Double = 40
        static let topY: Double = 46
        static let topH: Double = 140
        static let botY: Double = 232
        static let botH: Double = 140
        /// Room under the bottom row for the caption of a door on a south edge.
        static var height: Double { botY + botH + 30 }

        /// Column units → plan x. A half-integer lands exactly between two slots, which is where
        /// the aisle is.
        static func x(_ col: Double) -> Double { startX + col * slotW + slotW / 2 }
        static func col(_ x: Double) -> Double { (x - startX - slotW / 2) / slotW }

        static func y(_ lane: Lane) -> Double {
            switch lane {
            case .top:      return topY + topH * 0.52
            case .corridor: return (topY + topH + botY) / 2
            case .bottom:   return botY + botH * 0.48
            }
        }

        /// Left edge of a slot.
        static func slotLeft(_ i: Double) -> Double { startX + i * slotW }

    }

    /// How a door reaches the corridor between the two rows.
    enum Via { case corridor, west, east, lobby }

    /// A door is an edge of a block, not a point in the middle of one — and which edge decides
    /// which way you set off. Descending the west stairwell puts you out on its far side, so the
    /// same descent that ended "at the stairs" starts you facing the other way downstairs.
    struct Door: Equatable {
        let x: Double
        let y: Double
        let via: Via
        let name: String

        var point: CGPoint { CGPoint(x: x, y: y) }
    }

    /// * **Elevator** — door in the middle of the south edge, opening into the lobby.
    /// * **West stairwell** (behind the elevator) — down from its west edge, arriving on the floor
    ///   below at its east edge.
    /// * **East stairwell** — down from its north edge, which is on the corridor; arriving on the
    ///   floor below at its south edge, which is on the lobby.
    enum Doors {
        private static let eLeft = Plan.slotLeft(5)
        private static let eW = Plan.slotLeft(9) - Plan.slotLeft(5)
        private static let stairsH = (Plan.botH * 0.38).rounded()
        private static let inset: Double = 18
        private static var wsY: Double { Plan.botY + stairsH / 2 }
        private static var esX: Double {
            (Plan.slotLeft(13) + (Plan.startX + 14 * Plan.slotW + Plan.slotW / 2 - 2)) / 2
        }

        static var elevator: Door {
            Door(x: eLeft + eW / 2, y: Plan.botY + Plan.botH, via: .lobby, name: "elevator")
        }
        /// West stairwell, walking down.
        static var westDown: Door {
            Door(x: eLeft + inset, y: wsY, via: .west, name: "west stairwell")
        }
        /// West stairwell, arriving from the floor above.
        static var westUp: Door {
            Door(x: eLeft + eW - inset, y: wsY, via: .east, name: "west stairwell")
        }
        static var eastDown: Door {
            Door(x: esX, y: Plan.botY, via: .corridor, name: "east stairwell")
        }
        static var eastUp: Door {
            Door(x: esX, y: Plan.botY + Plan.botH, via: .lobby, name: "east stairwell")
        }

        /// `going` is the direction of travel through this door on *this* floor: `.out` is the one
        /// you leave by, `.in` the one you arrived through.
        enum Direction { case `in`, out }

        static func door(for end: Router.EndPoint, going: Direction) -> Door? {
            switch end {
            case .elevator:        return elevator
            case .stairs(.west):   return going == .out ? westDown : westUp
            case .stairs(.east):   return going == .out ? eastDown : eastUp
            case .none:            return nil
            }
        }
    }

    /// **The floor is walkable all the way round.** Both rows are islands: there is open floor
    /// north of the top row, south of the bottom row and at both ends, and every aisle is a
    /// passage with two open ends rather than a dead end. An earlier model sealed the bottom row
    /// except for the gaps either side of the elevator block, which made a south-facing door
    /// expensive to leave and sent the routing to the wrong stairwell.
    ///
    /// So there are no forced detours: reaching a column from a door costs how far along you have
    /// to walk, plus how far in from the corridor the door is set.

    /// Which column you stand at when you come through a door.
    static func column(_ door: Door) -> Double { Plan.col(door.x) }

    /// How far the door is set back from the corridor the stops are reached from, in columns, so
    /// it adds to a distance measured along that corridor. The elevator is a full row's depth in;
    /// the east stairwell's north door is already on it.
    static func depth(_ door: Door) -> Double { abs(door.y - Plan.y(.corridor)) / Plan.slotW }

    /// What it costs to get between a door and a column of the stacks.
    static func cost(_ door: Door, to col: Double) -> Double {
        abs(column(door) - col) + depth(door)
    }

}

// MARK: - Sentences

extension WalkPath.Step {

    /// "1 shelf west → aisle 9·10, turn right"
    ///
    /// Everything about a stop used to be printed twice — once as an instruction and again as a
    /// location line saying the same thing in other words. One phrasing, kept short enough that
    /// the move and the target sit on one row together.
    ///
    /// `fromDoor` is the first step of a floor, measured from a door rather than from another
    /// aisle: it can land on half a shelf, so it gives a direction instead of a count.
    func movement(fromDoor: Bool, doorName: String) -> String {
        let move: String
        if shelves == 0 {
            move = "Same aisle"
        } else if fromDoor || shelves != shelves.rounded() {
            move = "\(heading > 0 ? "East" : "West") from \(doorName)"
        } else {
            move = "\(Int(shelves)) \(shelves == 1 ? "shelf" : "shelves") \(heading > 0 ? "east" : "west")"
        }
        let short = WalkPath.aisleShort(x)
        return turn == .ahead ? "\(move) · \(short)" : "\(move) · \(short), turn \(turn.rawValue)"
    }

    /// "11L bottom · on your left". Anything the reader already has is left out — the transit row
    /// above named the door, and "row" and "face" and "shelf" are the only kinds of thing these
    /// numbers could be.
    var target: String {
        let rowName = row.map { $0 == .top ? "top" : "bottom" } ?? "—"
        let faceLetter = side == "left" ? "L" : "R"
        return "\(Int(index))\(faceLetter) \(rowName) · on your \(hand.rawValue)"
    }

    var symbol: String {
        switch heading {
        case 1:  return "arrow.right"
        case -1: return "arrow.left"
        default: return "arrow.turn.down.right"
        }
    }
}
