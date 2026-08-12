import SwiftUI

/// The floor you are standing on, with the walk marked on it.
///
/// The web app prints one map per floor and you read them in order. On a phone in the stacks that
/// is the wrong shape: you are on one floor at a time, one stop at a time, with one hand free. So
/// this shows a single floor — the one the next unfinished stop is on — and it moves with you.
/// Checking a stop off greys it and advances the ring to the next one; finishing a floor switches
/// the map to the next floor on its own. The list underneath is the same route in full, for when
/// you want to see what is coming.
///
/// **There is no drawn route.** There was, and it did not survive contact with the building: an
/// aisle is a twelve-point gap, a sweep doubles back along the corridor it came down, and every
/// device for keeping those legs apart — offset tracks, rounded corners, arrowheads — added ink to
/// a picture that was already too busy to read. What the line was carrying is order, and order
/// fits in the two things already on the map: the face you are going to, tinted, and a numbered
/// badge in the aisle you read it from. Colour gives the shape of the walk at a glance, the number
/// settles any ambiguity, and neither can overlap anything, because neither is a line.
///
/// Geometry comes from `WalkPath`, which is shared with the web app, so the two mark the same
/// route from the same data. Nothing about the building is decided here.
struct WalkMapView: View {

    let leg: Router.FloorLeg
    /// Faces with a mapped range on this level — the stacks to draw behind the walk.
    let faces: Set<String>
    /// Stop keys already done, `"level|shelfID|side"`.
    let completed: Set<String>
    /// The stop you are walking to now.
    let current: String?
    let onTap: (String) -> Void

    var body: some View {
        GeometryReader { geo in
            Canvas { ctx, size in draw(ctx, size) }
                .contentShape(Rectangle())
                .onTapGesture(coordinateSpace: .local) { p in
                    if let hit = badge(near: p, scale: geo.size.width / WalkPath.Plan.width) {
                        onTap(hit.key)
                    }
                }
        }
        .aspectRatio(WalkPath.Plan.width / WalkPath.Plan.height, contentMode: .fit)
        .accessibilityElement()
        .accessibilityLabel(mapDescription)
    }

    // MARK: Stops

    private struct Badge {
        let key: String
        let n: Int
        /// Plan coordinates.
        let at: CGPoint
    }

    private var stopCount: Int { leg.stops.count }

    private func key(_ stop: Router.Stop) -> String { "\(leg.level)|\(stop.shelfID)|\(stop.side)" }

    /// Badges sit in the aisle you stand in, beside the face they belong to. Two faces read from
    /// one aisle are one place to stand, so their badges would land on each other — they are spread
    /// along the aisle instead of stacked.
    private var badges: [Badge] {
        var seen: [String: Int] = [:]
        var out: [Badge] = []
        for (i, stop) in leg.stops.enumerated() {
            let lane = WalkPath.lane(stop)
            let x = WalkPath.Plan.x(WalkPath.standX(stop))
            let slot = "\(x)|\(lane.rawValue)"
            let k = seen[slot] ?? 0
            seen[slot] = k + 1
            let nudge = k == 0 ? 0 : Double((k % 2 == 1 ? 1 : -1) * ((k + 1) / 2)) * 26
            out.append(Badge(key: key(stop), n: i + 1,
                             at: CGPoint(x: x, y: WalkPath.Plan.y(lane) + nudge)))
        }
        return out
    }

    /// The tap arrives in view points; badges are in plan coordinates. The view is aspect-fitted to
    /// the plan, so one scale factor converts either way. A badge is 23pt across at scale 1 and much
    /// smaller on a phone, so the target is the nearest badge within a fingertip rather than the
    /// circle itself.
    private func badge(near p: CGPoint, scale s: Double) -> Badge? {
        badges
            .min { hypot($0.at.x * s - p.x, $0.at.y * s - p.y)
                 < hypot($1.at.x * s - p.x, $1.at.y * s - p.y) }
            .flatMap { hypot($0.at.x * s - p.x, $0.at.y * s - p.y) <= 26 ? $0 : nil }
    }

    // MARK: Drawing

    private func draw(_ ctx: GraphicsContext, _ size: CGSize) {
        let s = size.width / WalkPath.Plan.width

        func rect(_ x: Double, _ y: Double, _ w: Double, _ h: Double) -> CGRect {
            CGRect(x: x * s, y: y * s, width: w * s, height: h * s)
        }

        let visited = Dictionary(
            leg.stops.enumerated().map { ("\($0.element.shelfID)|\($0.element.side)", $0.offset) },
            uniquingKeysWith: { first, _ in first })

        // ── Stacks. Faces you are not visiting keep their shelf-group colour at soft strength, so
        //    the floor still reads as the floor. ──
        for shelf in Router.shelves {
            let present = shelf.sides.contains { faces.contains("\(shelf.id)|\($0)") }
            guard present else { continue }
            let cx = WalkPath.Plan.x(Double(shelf.index))
            let y = shelf.row == .top ? WalkPath.Plan.topY : WalkPath.Plan.botY
            let h = shelf.row == .top ? WalkPath.Plan.topH : WalkPath.Plan.botH
            let w: Double = shelf.isHalf ? 18 : 14

            for side in shelf.sides {
                let k = "\(shelf.id)|\(side)"
                guard faces.contains(k) else { continue }
                let x = shelf.isHalf ? cx : (side == "left" ? cx - w : cx)
                let colour = visited[k].map { Theme.order($0, of: stopCount) }
                    ?? Theme.shelfGroup(shelf.group, soft: true)
                ctx.fill(Path(rect(x, y, w, h)), with: .color(colour))
            }
            let outline = shelf.isHalf ? rect(cx, y, w, h) : rect(cx - w, y, w * 2, h)
            ctx.stroke(Path(roundedRect: outline, cornerRadius: 3 * s),
                       with: .color(Theme.line), lineWidth: 0.8 * s)
        }

        // ── Architecture ──
        let eLeft = WalkPath.Plan.slotLeft(5)
        let eW = WalkPath.Plan.slotLeft(9) - eLeft
        let stairsH = (WalkPath.Plan.botH * 0.38).rounded()
        block(ctx, rect(eLeft + 18, WalkPath.Plan.botY, eW - 36, stairsH), "STAIRS",
              Theme.ShelfGroup.orange, s)
        block(ctx, rect(eLeft, WalkPath.Plan.botY + stairsH + 2, eW, WalkPath.Plan.botH - stairsH - 2),
              "ELEVATOR", Theme.accent, s)
        let s2Left = WalkPath.Plan.slotLeft(13)
        let s2W = WalkPath.Plan.startX + 14 * WalkPath.Plan.slotW + WalkPath.Plan.slotW / 2 - 2 - s2Left
        block(ctx, rect(s2Left, WalkPath.Plan.botY, s2W, WalkPath.Plan.botH), "STAIRS",
              Theme.ShelfGroup.orange, s)

        // ── Where you come in and where you leave ──
        //
        // A stairwell is not a point: you walk down the west one from its west edge and arrive on
        // the floor below at its east edge, so the same descent starts you facing the other way.
        // On a truck trip both doors are the one elevator door, and two captions on one point
        // interleave into gibberish — say it once instead.
        guard let inDoor = WalkPath.Doors.door(for: leg.entry, going: .in) else { return }
        let outDoor = WalkPath.Doors.door(for: leg.exit, going: .out)
        let sameDoor = outDoor.map { $0 == inDoor } ?? false
        cap(ctx, inDoor, sameDoor ? "START / EXIT" : "START", s)
        if let out = outDoor, !sameDoor { cap(ctx, out, "EXIT", s) }

        // ── Stops ──
        for b in badges {
            let done = completed.contains(b.key)
            let isNow = b.key == current
            let colour = done ? Theme.inkFaint : Theme.order(b.n - 1, of: stopCount)
            let c = CGPoint(x: b.at.x * s, y: b.at.y * s)
            if isNow {
                ctx.stroke(Path(ellipseIn: CGRect(x: c.x - 17 * s, y: c.y - 17 * s,
                                                  width: 34 * s, height: 34 * s)),
                           with: .color(colour), lineWidth: 2.5 * s)
            }
            let disc = CGRect(x: c.x - 11.5 * s, y: c.y - 11.5 * s, width: 23 * s, height: 23 * s)
            ctx.fill(Path(ellipseIn: disc), with: .color(colour))
            ctx.stroke(Path(ellipseIn: disc), with: .color(Theme.card), lineWidth: 2.2 * s)
            let label = done
                ? Text(Image(systemName: "checkmark"))
                : Text("\(b.n)").font(.custom(Theme.FontName.monoSemi, size: 12 * s))
            ctx.draw(label.foregroundStyle(Theme.paper), at: c)
        }
    }

    private func block(_ ctx: GraphicsContext, _ r: CGRect, _ label: String,
                       _ colour: Color, _ s: Double)
    {
        ctx.fill(Path(roundedRect: r, cornerRadius: 4 * s), with: .color(colour))
        ctx.draw(Text(label).font(.custom(Theme.FontName.monoMedium, size: 9 * s)).foregroundStyle(Theme.paper),
                 at: CGPoint(x: r.midX, y: r.midY))
    }

    /// The caption goes wherever the open floor is, which is the direction the door faces. Placed
    /// above by habit it lands inside the orange stairs block, orange on orange, and disappears.
    private func cap(_ ctx: GraphicsContext, _ door: WalkPath.Door, _ label: String, _ s: Double) {
        let colour: Color = door.name.contains("stair") ? Theme.ShelfGroup.orange : Theme.accent
        let c = CGPoint(x: door.x * s, y: door.y * s)
        let disc = CGRect(x: c.x - 7.5 * s, y: c.y - 7.5 * s, width: 15 * s, height: 15 * s)
        ctx.fill(Path(ellipseIn: disc), with: .color(Theme.card))
        ctx.stroke(Path(ellipseIn: disc), with: .color(colour), lineWidth: 3 * s)

        let text = Text(label).font(.custom(Theme.FontName.monoSemi, size: 9 * s)).foregroundStyle(colour)
        switch door.via {
        case .lobby:    ctx.draw(text, at: CGPoint(x: c.x + 12 * s, y: c.y + 14 * s), anchor: .leading)
        case .corridor: ctx.draw(text, at: CGPoint(x: c.x, y: c.y - 15 * s), anchor: .center)
        case .west:     ctx.draw(text, at: CGPoint(x: c.x - 2 * s, y: c.y - 15 * s), anchor: .trailing)
        case .east:     ctx.draw(text, at: CGPoint(x: c.x + 2 * s, y: c.y - 15 * s), anchor: .leading)
        }
    }

    private var mapDescription: String {
        let done = leg.stops.filter { completed.contains(key($0)) }.count
        return "Level \(leg.level) floor map. \(done) of \(leg.stops.count) stops done."
    }
}
