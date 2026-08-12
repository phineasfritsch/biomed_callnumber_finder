import Foundation

/// Shelf lookup and trip routing. Ported from the web locator's `routeLocate` / `sweep` /
/// `buildRoute`.
///
/// Movement model (unchanged from the web app):
/// * Each stairwell descends **exactly one floor** — the quick move.
/// * The elevator handles going up, and any descent that skips floors.
/// * Two stairwells per floor, and an elevator. Each has doors on particular edges, and which
///   edge you come out of decides which way you set off — see `WalkPath.Doors`.
/// * Within a floor we sweep across the stacks once rather than backtracking.
/// * **More than five books is a truck trip**: the stairs come off the table and every floor
///   change is the elevator.
struct Router {

    // MARK: Geometry

    // MARK: Models

    struct Range: Decodable { let start: String; let end: String }

    struct Shelf {
        let id: String
        let index: Int
        let row: Row
        enum Row: String { case top, bottom }
        /// Top row precedes bottom row when two faces sit at the same column.
        var rowOrder: Int { row == .top ? 0 : 1 }

        /// Three shelves in the building are half-depth and right-side-only, so they carry one
        /// face rather than two. Named here rather than derived, because the exception is a fact
        /// about the building.
        var isHalf: Bool { id == "top-0" || id == "bot-0" || id == "bot-14" }
        var sides: [String] { isHalf ? ["single"] : ["left", "right"] }

        /// Colour groups carried over from the web locator so the map stays recognisable.
        enum Group { case green, orange, char, slate }
        var group: Group {
            if id == "top-0" { return .orange }
            if id == "bot-0" { return .slate }
            return row == .top ? .green : .char
        }
    }

    struct Hit {
        let level: Int
        let shelfID: String
        let side: String
        let range: Range
    }

    struct Stop: Identifiable {
        let shelfID: String
        let side: String
        let x: Double
        let row: Shelf.Row?
        let range: Range
        var callNumbers: [CallNumber]

        /// A double-sided shelf contributes two *distinct* stops at the same column, so `shelfID`
        /// alone is not unique within a floor — `top-5/right` and `top-5/left` routinely appear
        /// together. Identity must include the side.
        var id: String { "\(shelfID)|\(side)" }
    }

    enum Direction { case leftToRight, rightToLeft }
    enum Stairwell: String { case west, east }

    enum Transit {
        case elevator(to: Int, skipping: Int)
        case stairs(Stairwell, to: Int)
    }

    /// How a floor is entered and left. The route list only ever needed the *order* of the stops;
    /// a map needs the doors too, because the walk starts where you stepped off the stairs and a
    /// path drawn from the first shelf instead is a different, shorter, wrong route.
    enum EndPoint: Equatable {
        case elevator
        case stairs(Stairwell)
        /// The last floor of the trip: you stop here, so there is no exit to draw.
        case none

        var isStairs: Bool { if case .stairs = self { return true }; return false }

        var label: String {
            switch self {
            case .elevator:       return "elevator"
            case let .stairs(w):  return "\(w.rawValue) stairs"
            case .none:           return ""
            }
        }
    }

    struct FloorLeg {
        let level: Int
        let stops: [Stop]
        let direction: Direction
        /// The columns you come in at and leave from, read off the doors themselves — not the
        /// middle of the block they are cut into. See `WalkPath.column`.
        let entryX: Double
        let exitX: Double
        let entry: EndPoint
        let exit: EndPoint
    }

    enum Step {
        case transit(Transit)
        case floor(FloorLeg)
    }

    struct Route {
        let steps: [Step]
        /// Call numbers that parsed but fall outside every mapped range.
        let unlocated: [String]
        let bookCount: Int
        let stairDescents: Int
        /// Every ride between floors, whether it skipped floors or not.
        let elevatorMoves: Int
        /// More than five books: no stairs at all. See `buildRoute`.
        let isTruckTrip: Bool
        let floorCount: Int
    }

    // MARK: Shelf table

    /// Standard biomed grid. Mirrors the `SHELVES` table in the web app.
    static let shelves: [Shelf] = {
        var s: [Shelf] = [
            Shelf(id: "top-0", index: 0, row: .top),
            Shelf(id: "bot-0", index: 0, row: .bottom),
        ]
        s += (1...16).map { Shelf(id: "top-\($0)", index: $0, row: .top) }
        s += [1, 2, 3, 10, 11, 12, 15, 16].map { Shelf(id: "bot-\($0)", index: $0, row: .bottom) }
        s.append(Shelf(id: "bot-14", index: 14, row: .bottom))
        return s
    }()

    private static let shelfByID: [String: Shelf] =
        Dictionary(uniqueKeysWithValues: shelves.map { ($0.id, $0) })

    // MARK: State

    /// Keyed `"level|shelf-id|side"`, matching biomed-shelf-ranges.json.
    private let ranges: [String: Range]

    init(ranges: [String: Range]) {
        self.ranges = ranges.filter { !$0.value.start.isEmpty && !$0.value.end.isEmpty }
    }

    enum LoadError: LocalizedError {
        case missingResource(String)
        var errorDescription: String? {
            switch self {
            case let .missingResource(name):
                return "\(name).json is missing from the app bundle."
            }
        }
    }

    init(bundledRanges resource: String, bundle: Bundle = .main) throws {
        guard let url = bundle.url(forResource: resource, withExtension: "json") else {
            throw LoadError.missingResource(resource)
        }
        let raw = try JSONDecoder().decode([String: Range].self, from: Data(contentsOf: url))
        self.init(ranges: raw)
    }

    // MARK: Lookup

    /// The lowest-numbered floor whose mapped range contains `cn`, or nil.
    ///
    /// Scheme gating is load-bearing: the biomedical serials prefix (W1–W4) and NLM class W +
    /// number ("W 13") share the letter W but are different namespaces. They must never match
    /// across schemes.
    ///
    /// ## Why the tiebreak is not incidental
    ///
    /// **237 of 651 real endpoints match two faces on the same level.** These are range
    /// boundaries — one face's `end` is the next face's `start`, so a book sitting exactly on the
    /// seam is genuinely contained by both (`W1 DE244` → L5 bot-1/left *and* L5 top-1/left).
    ///
    /// The web app resolves this by accident: `.build_locator.py` emits keys via
    /// `sorted(d.keys())`, so JavaScript's insertion-ordered `for...in` always walks them
    /// lexicographically and `5|bot-1|left` reliably wins. Swift's `Dictionary` iteration order is
    /// *randomized per process launch*, so the naive `hits.min(by: level)` would send you to a
    /// different shelf on different launches for a third of the collection — and it would look
    /// like a flaky OCR bug, not an ordering bug.
    ///
    /// Sorting by (level, key) reproduces the web app's behaviour deterministically.
    ///
    /// ## Level 9 is excluded, and that is a bug fix, not a port
    ///
    /// Level 9 is Special Collections: a second, parallel sequence whose seventeen faces run
    /// `A` to `ZWZ 330` and so contain almost every call number in the building. Searching it
    /// alongside the general stacks and then taking the lowest-numbered floor sent **every**
    /// book whose real home was level 10 or 11 to level 9 — 98 of the 436 mapped faces, which
    /// is all of both floors. Scanning a spine gave you the right call number and the wrong
    /// building level, so it read as a flaky camera, not as a lookup bug.
    ///
    /// `search` below always excluded level 9, and so did the web app's catalog lookup; only
    /// the trip planner did not. The web app has been fixed in the same commit. Special
    /// Collections is reachable through its own section pill and nowhere else.
    func locate(_ cn: CallNumber) -> Hit? {
        var hits: [(key: String, hit: Hit)] = []
        for (key, range) in ranges {
            guard !key.hasPrefix("9|"),
                  let start = CallNumber.parse(range.start),
                  let end = CallNumber.parse(range.end),
                  start.scheme == cn.scheme
            else { continue }

            guard CallNumber.compare(cn, start) >= 0, CallNumber.compare(cn, end) <= 0 else { continue }

            let parts = key.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
            guard parts.count == 3, let level = Int(parts[0]) else { continue }
            hits.append((key, Hit(level: level, shelfID: parts[1], side: parts[2], range: range)))
        }
        return hits.min {
            $0.hit.level != $1.hit.level ? $0.hit.level < $1.hit.level : $0.key < $1.key
        }?.hit
    }

    /// The website's search box, ported exactly. NOT the same operation as `locate`, and the
    /// differences are deliberate:
    ///
    /// * Returns **every** matching face, level-ascending. Serial runs make this essential: a
    ///   range with `start == end` is one journal spanning many shelves, so a single call number
    ///   legitimately matches several faces and the human picks by volume/year on the spine.
    ///   Showing only the lowest face (what `locate` does for routing) reads as simply wrong for
    ///   serials — which is most of this collection.
    /// * **Excludes Level 9** (Special Collections). The website searches those only through its
    ///   section pill; the main search never returns them. (`locate` deliberately still includes
    ///   them, matching the web's `routeLocate` — routing and search disagree on this in the web
    ///   app, and we mirror both faithfully rather than "fixing" one to match the other.)
    func search(_ cn: CallNumber) -> [Hit] {
        var hits: [(key: String, hit: Hit)] = []
        for (key, range) in ranges {
            guard !key.hasPrefix("9|"),
                  let start = CallNumber.parse(range.start),
                  let end = CallNumber.parse(range.end),
                  start.scheme == cn.scheme,
                  CallNumber.compare(cn, start) >= 0, CallNumber.compare(cn, end) <= 0
            else { continue }

            let parts = key.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
            guard parts.count == 3, let level = Int(parts[0]) else { continue }
            hits.append((key, Hit(level: level, shelfID: parts[1], side: parts[2], range: range)))
        }
        return hits
            .sorted { $0.hit.level != $1.hit.level ? $0.hit.level < $1.hit.level : $0.key < $1.key }
            .map(\.hit)
    }

    /// Shelf geometry for display ("top row · index 5"), mirroring the web results.
    static func shelf(id: String) -> Shelf? { shelfByID[id] }

    /// Faces that have a mapped range on a level, keyed `"shelfID|side"`.
    ///
    /// The map draws the stacks from this rather than from a hard-coded per-level table: which
    /// shelves exist on a floor is already in the dataset, and a second copy of it would be a
    /// second thing to get wrong.
    func faces(onLevel level: Int) -> Set<String> {
        let prefix = "\(level)|"
        var out: Set<String> = []
        for key in ranges.keys where key.hasPrefix(prefix) {
            out.insert(String(key.dropFirst(prefix.count)))
        }
        return out
    }

    // MARK: Sweep

    /// 1-D sweep: cover span [L, R] starting at `s`, ending at `e`. Returns the cheaper direction.
    private static func sweep(_ L: Double, _ R: Double, _ s: Double, _ e: Double)
        -> (cost: Double, dir: Direction)
    {
        let a = abs(s - L) + (R - L) + abs(R - e)
        let b = abs(s - R) + (R - L) + abs(L - e)
        return a <= b ? (a, .leftToRight) : (b, .rightToLeft)
    }

    private func groupStops(_ items: [(cn: CallNumber, hit: Hit)]) -> [Stop] {
        var order: [String] = []
        var map: [String: Stop] = [:]
        for it in items {
            let key = "\(it.hit.shelfID)|\(it.hit.side)"
            if map[key] == nil {
                let shelf = Self.shelfByID[it.hit.shelfID]
                map[key] = Stop(
                    shelfID: it.hit.shelfID,
                    side: it.hit.side,
                    x: Double(shelf?.index ?? 8),   // 8 = mid-grid fallback for unknown shelf ids
                    row: shelf?.row,
                    range: it.hit.range,
                    callNumbers: []
                )
                order.append(key)
            }
            map[key]?.callNumbers.append(it.cn)
        }
        return order.compactMap { map[$0] }
    }

    // MARK: Route

    /// Build a top-down walk covering every locatable call number.
    ///
    /// Identical for fetch and shelve trips — you visit the same faces in the same order either
    /// way. Trip type only changes presentation.
    func buildRoute(_ callNumbers: [CallNumber]) -> Route {
        // Dedupe by normalized text, preserving first-seen order.
        var seen = Set<String>()
        let want = callNumbers.filter { seen.insert($0.raw.uppercased()).inserted }

        var located: [(cn: CallNumber, hit: Hit)] = []
        var unlocated: [String] = []
        for cn in want {
            if let hit = locate(cn) { located.append((cn, hit)) } else { unlocated.append(cn.raw) }
        }
        guard !located.isEmpty else {
            return Route(steps: [], unlocated: unlocated, bookCount: 0,
                         stairDescents: 0, elevatorMoves: 0, isTruckTrip: false, floorCount: 0)
        }

        var byLevel: [Int: [(cn: CallNumber, hit: Hit)]] = [:]
        for it in located { byLevel[it.hit.level, default: []].append(it) }
        let levels = byLevel.keys.sorted(by: >)   // top floor first

        /// **Over five books is a truck trip.** You are not carrying nine books down a stairwell,
        /// so past that point the stairs stop being an option and every floor change is the
        /// elevator. The threshold is a load, not a distance, which is why it overrides the
        /// routing arithmetic instead of being folded into it as a cost.
        let truck = located.count > 5

        var steps: [Step] = [.transit(.elevator(to: levels[0], skipping: 0))]
        var entryPoint = EndPoint.elevator
        var stairDescents = 0
        var elevatorMoves = 0

        for (i, level) in levels.enumerated() {
            let stops = groupStops(byLevel[level]!)
            let xs = stops.map(\.x)
            let L = xs.min()!, R = xs.max()!
            let entry = WalkPath.column(WalkPath.Doors.door(for: entryPoint, going: .in)!)

            var nextTransit: Transit?
            var exitPoint = EndPoint.none
            var nextPoint = EndPoint.elevator

            if i < levels.count - 1 {
                let next = levels[i + 1]
                let gap = level - next
                if gap == 1 && !truck {
                    // Which stairwell is cheaper is a question about doors, not columns. The west
                    // stairwell's landing sits behind the elevator block: reaching it means
                    // walking out to the gap at column 4 and back in, and you arrive downstairs on
                    // its far side. The east stairwell opens straight onto the corridor going
                    // down, but drops you into the south lobby coming out. Costing them as two
                    // bare x-positions gets this backwards on exactly the floors where it matters,
                    // so both legs are measured along the paths that will actually be drawn.
                    let nextStops = groupStops(byLevel[next]!)
                    let nc = nextStops.map(WalkPath.standX).reduce(0, +) / Double(nextStops.count)

                    func score(_ well: Stairwell) -> Double {
                        let out = WalkPath.Doors.door(for: .stairs(well), going: .out)!
                        let back = WalkPath.Doors.door(for: .stairs(well), going: .in)!
                        return Self.sweep(L, R, entry, WalkPath.column(out)).cost
                            + WalkPath.depth(out) + WalkPath.cost(back, to: nc)
                    }
                    let best: Stairwell = score(.west) <= score(.east) ? .west : .east
                    stairDescents += 1
                    nextTransit = .stairs(best, to: next)
                    exitPoint = .stairs(best)
                    nextPoint = .stairs(best)
                } else {
                    elevatorMoves += 1
                    nextTransit = .elevator(to: next, skipping: gap - 1)
                    exitPoint = .elevator
                    nextPoint = .elevator
                }
            }

            let exit = WalkPath.Doors.door(for: exitPoint, going: .out)
                .map(WalkPath.column) ?? entry
            let dir = Self.sweep(L, R, entry, exit).dir
            // Sort by column in sweep direction, then top row before bottom. The trailing index
            // tiebreak keeps this deterministic — Swift's sort is not stable, and the JS relied on
            // object insertion order for ties.
            let indexed = stops.enumerated()
            let sorted = indexed.sorted { a, b in
                if a.element.x != b.element.x {
                    return dir == .leftToRight ? a.element.x < b.element.x : a.element.x > b.element.x
                }
                let ra = a.element.row.map { $0 == .top ? 0 : 1 } ?? 1
                let rb = b.element.row.map { $0 == .top ? 0 : 1 } ?? 1
                if ra != rb { return ra < rb }
                return a.offset < b.offset
            }.map(\.element)

            steps.append(.floor(FloorLeg(level: level, stops: sorted, direction: dir,
                                         entryX: entry, exitX: exit,
                                         entry: entryPoint, exit: exitPoint)))
            if let t = nextTransit { steps.append(.transit(t)) }
            entryPoint = nextPoint
        }

        return Route(steps: steps, unlocated: unlocated, bookCount: located.count,
                     stairDescents: stairDescents, elevatorMoves: elevatorMoves,
                     isTruckTrip: truck, floorCount: levels.count)
    }
}

// MARK: - Summary copy

extension Router.Route {
    /// One-line plan summary, e.g. "Elevator to Level 8, then 2 stair descents and 1 elevator move."
    func summary(levels topLevel: Int) -> String {
        if floorCount <= 1 {
            return "All on Level \(topLevel). Take the elevator there."
        }
        if isTruckTrip {
            return "Over five books, so this is a truck trip: the elevator between every floor "
                 + "(\(elevatorMoves) move\(elevatorMoves == 1 ? "" : "s"))."
        }
        var s = "Elevator to Level \(topLevel), then \(stairDescents) stair descent"
            + (stairDescents == 1 ? "" : "s")
        if elevatorMoves > 0 {
            s += " and \(elevatorMoves) elevator move" + (elevatorMoves == 1 ? "" : "s")
        }
        return s + "."
    }
}
