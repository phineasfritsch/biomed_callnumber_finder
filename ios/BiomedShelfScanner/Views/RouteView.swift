import SwiftUI

/// The walk. A distinct mode — you've stopped scanning and started moving, so this is full-screen
/// with the camera off rather than another sheet detent.
struct RouteView: View {

    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let route: Router.Route

    @State private var confirmFinish = false
    @State private var showSortSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if route.steps.isEmpty {
                    ContentUnavailableView(
                        "Nothing to route",
                        systemImage: "map",
                        description: Text(unlocatedBlurb)
                    )
                } else {
                    List {
                        Section { progressHeader.listRowSeparator(.hidden) }

                        if let leg = currentLeg { liveMapSection(leg) }

                        // Every branch emits a Section. Mixing bare rows and Sections inside one
                        // List renders inconsistently — the bare row gets an implicit section of
                        // its own and the spacing goes wrong.
                        ForEach(Array(route.steps.enumerated()), id: \.offset) { _, step in
                            switch step {
                            case let .transit(t):
                                Section { TransitRow(transit: t) }
                            case let .floor(leg):
                                FloorSection(leg: leg, kind: store.current.kind,
                                             current: currentStopKey)
                            }
                        }

                        if !route.unlocated.isEmpty { unlocatedSection }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        if store.current.kind == .shelve {
                            Button { showSortSheet = true } label: {
                                Label("Sort truck first", systemImage: "arrow.up.arrow.down")
                            }
                        }
                        Button { confirmFinish = true } label: {
                            Label("Finish trip", systemImage: "checkmark.circle")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Trip actions")
                }
            }
            .sheet(isPresented: $showSortSheet) {
                TruckSortView(route: route)
            }
            .confirmationDialog("Finish this trip?", isPresented: $confirmFinish, titleVisibility: .visible) {
                Button("Finish and clear") {
                    store.finish()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("The trip moves to your history and the list is cleared.")
            }
        }
    }

    private var title: String {
        let done = completedCount
        guard route.bookCount > 0 else { return "Route" }
        return "\(done) of \(route.bookCount)"
    }

    private var completedCount: Int {
        route.steps.reduce(0) { total, step in
            guard case let .floor(leg) = step else { return total }
            return total + leg.stops.reduce(0) { sum, stop in
                store.isStopComplete(key(leg.level, stop)) ? sum + stop.callNumbers.count : sum
            }
        }
    }

    // MARK: The live map

    /// Every floor of the walk, in order.
    private var legs: [Router.FloorLeg] {
        route.steps.compactMap { if case let .floor(l) = $0 { return l } else { return nil } }
    }

    /// The stop you are walking to now: the first one not ticked off, in route order. Everything
    /// on the map keys off this — which floor is shown, which badge wears the ring, how much of
    /// the line has gone grey — so checking a stop off is the only input the map needs.
    private var currentStopKey: String? {
        for leg in legs {
            for stop in leg.stops where !store.isStopComplete(key(leg.level, stop)) {
                return key(leg.level, stop)
            }
        }
        return nil
    }

    /// The floor that stop is on. When the walk is finished, stay on the last floor rather than
    /// blanking the map.
    private var currentLeg: Router.FloorLeg? {
        guard let now = currentStopKey else { return legs.last }
        return legs.first { leg in leg.stops.contains { key(leg.level, $0) == now } } ?? legs.first
    }

    @ViewBuilder
    private func liveMapSection(_ leg: Router.FloorLeg) -> some View {
        Section {
            WalkMapView(
                leg: leg,
                faces: store.router.faces(onLevel: leg.level),
                completed: store.current.completedStops,
                current: currentStopKey,
                onTap: { k in
                    withAnimation(reduceMotion ? nil : Theme.spring) { store.toggleStop(k) }
                }
            )
            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
        } header: {
            HStack {
                Text("Level \(leg.level)")
                Spacer()
                Text(mapCaption(leg)).foregroundStyle(.secondary)
            }
        } footer: {
            Text("Tap a numbered stop to tick it off. The map follows you to the next floor.")
        }
    }

    private func mapCaption(_ leg: Router.FloorLeg) -> String {
        let done = leg.stops.filter { store.isStopComplete(key(leg.level, $0)) }.count
        return "\(done) of \(leg.stops.count) stops done"
    }

    private var progressHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            ProgressView(value: Double(completedCount), total: Double(max(route.bookCount, 1)))
                .tint(Theme.accent)
            Text(route.summary(levels: topLevel))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var topLevel: Int {
        for step in route.steps {
            if case let .floor(leg) = step { return leg.level }
        }
        return 0
    }

    private var unlocatedBlurb: String {
        route.unlocated.isEmpty
            ? "Add some call numbers first."
            : "None of the scanned call numbers fall in the mapped ranges."
    }

    private var unlocatedSection: some View {
        Section {
            ForEach(route.unlocated, id: \.self) { cn in
                Text(cn)
                    .font(Theme.callNumber(.callout))
                    .fixedSize(horizontal: false, vertical: true)
            }
        } header: {
            Label("^[\(route.unlocated.count) not located](inflect: true)", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.unlocated)
        } footer: {
            Text("These may be shelved in Reference (Floor 4), sit outside the mapped ranges, or be mis-read. Fix them in the list and plan again.")
        }
    }

    fileprivate func key(_ level: Int, _ stop: Router.Stop) -> String {
        "\(level)|\(stop.shelfID)|\(stop.side)"
    }
}

/// "Take the west stairwell down one floor to Level 7."
struct TransitRow: View {
    let transit: Router.Transit

    var body: some View {
        Label {
            Text(text).font(.subheadline)
        } icon: {
            Image(systemName: symbol)
                .foregroundStyle(Theme.accent)
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }

    private var symbol: String {
        switch transit {
        case .elevator: return "arrow.up.arrow.down.square"
        case .stairs:   return "figure.stairs"
        }
    }

    // Plain String, so no `^[…](inflect:)` here — that markup only inflects inside a Text
    // LITERAL (LocalizedStringKey). Routed through a String first, it renders as raw markup;
    // this shipped as "skips ^[5 floor](inflect: true)" on device.
    private var text: String {
        switch transit {
        case let .elevator(to, skipping) where skipping > 0:
            return "Take the elevator down to Level \(to) (skips \(skipping) floor\(skipping == 1 ? "" : "s"))."
        case let .elevator(to, _):
            return "Take the elevator to Level \(to)."
        case let .stairs(well, to):
            return "Take the \(well.rawValue) stairwell down one floor to Level \(to)."
        }
    }
}

/// One floor of the walk: its stops in sweep order, each checkable.
struct FloorSection: View {

    @Environment(TripStore.self) private var store
    let leg: Router.FloorLeg
    let kind: TripKind
    let current: String?

    /// One instruction per stop, in the same order as the rows. Computed once for the floor rather
    /// than per row — the distance in each step is measured from the previous stop, so a row
    /// cannot work it out alone.
    private var steps: [WalkPath.Step] {
        WalkPath.steps(stops: leg.stops, entry: leg.entryX, exit: leg.exitX).steps
    }

    private var doorName: String {
        (WalkPath.Doors.door(for: leg.entry, going: .in)?.name ?? "lift")
            .replacingOccurrences(of: "stairwell", with: "stairs")
    }

    var body: some View {
        Section {
            // Keyed by Stop.id ("shelfID|side") — a double-sided shelf puts two stops at the same
            // column, so shelfID alone collides.
            ForEach(Array(leg.stops.enumerated()), id: \.element.id) { i, stop in
                StopRow(stop: stop, level: leg.level, kind: kind,
                        step: i < steps.count ? steps[i] : nil,
                        stopCount: leg.stops.count,
                        doorName: doorName,
                        isCurrent: current == "\(leg.level)|\(stop.shelfID)|\(stop.side)")
            }
        } header: {
            HStack {
                Text("Level \(leg.level)")
                Spacer()
                Label(
                    leg.direction == .leftToRight ? "Sweep left to right" : "Sweep right to left",
                    systemImage: leg.direction == .leftToRight ? "arrow.right" : "arrow.left"
                )
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
    }
}

struct StopRow: View {

    @Environment(TripStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let stop: Router.Stop
    let level: Int
    let kind: TripKind
    /// nil only if the step list and the stop list ever disagree in length, which they should not.
    let step: WalkPath.Step?
    /// Stops on this floor — the denominator of the order ramp, so the badge here is the same
    /// colour as the badge on the map.
    let stopCount: Int
    let doorName: String
    let isCurrent: Bool

    private var key: String { "\(level)|\(stop.shelfID)|\(stop.side)" }
    private var done: Bool { store.isStopComplete(key) }

    var body: some View {
        Button {
            withAnimation(reduceMotion ? nil : Theme.spring) { store.toggleStop(key) }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(done ? Theme.located : Color.secondary)

                VStack(alignment: .leading, spacing: 6) {
                    // One phrasing per stop. This used to print the location twice — a header
                    // reading "Index 9 · top · Right" and then a sentence saying the same thing in
                    // words underneath it.
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        if let step {
                            Text("\(step.n)")
                                .font(.caption.weight(.bold).monospacedDigit())
                                .foregroundStyle(.white)
                                .frame(width: 19, height: 19)
                                .background(Theme.order(step.n - 1, of: stopCount), in: Circle())
                                .accessibilityHidden(true)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            if let step {
                                Text(step.movement(fromDoor: step.n == 1, doorName: doorName))
                                    .font(.subheadline.weight(.semibold))
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(step.target)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            } else {
                                Text("Index \(stop.x, format: .number) · \(rowLabel) · \(sideLabel)")
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                            }
                        }
                    }

                    ForEach(stop.callNumbers, id: \.raw) { cn in
                        Text(cn.raw)
                            .font(Theme.callNumber(.callout))
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Text("\(stop.range.start) → \(stop.range.end)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .strikethrough(done, color: .secondary)
                .opacity(done ? 0.5 : 1)

                Spacer(minLength: 0)
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(isCurrent && !done ? Theme.accent.opacity(0.07) : nil)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(done ? [.isSelected] : [])
        .accessibilityHint(done ? "Double tap to mark not done" : "Double tap to mark \(kind.pastVerb.lowercased())")
    }

    private var rowLabel: String {
        switch stop.row {
        case .top:    return "top"
        case .bottom: return "bottom"
        case nil:     return "—"
        }
    }

    private var sideLabel: String {
        ["left": "Left", "right": "Right", "single": "Single (R)"][stop.side] ?? stop.side
    }
}

/// Shelving order for the truck itself.
///
/// Experienced staff already sort a cart into call-number order before walking it — it turns the
/// trip into a single pass instead of hunting the truck at every stop. The app knows the order,
/// so it should just hand it over rather than make them derive it again.
struct TruckSortView: View {

    @Environment(\.dismiss) private var dismiss
    let route: Router.Route

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(Array(ordered.enumerated()), id: \.offset) { i, entry in
                        HStack(spacing: 12) {
                            Text("\(i + 1)")
                                .font(.caption.weight(.semibold).monospacedDigit())
                                .foregroundStyle(.secondary)
                                .frame(minWidth: 24, alignment: .trailing)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.cn)
                                    .font(Theme.callNumber(.callout))
                                    .fixedSize(horizontal: false, vertical: true)
                                Text("L\(entry.level) · \(entry.shelf)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                } footer: {
                    Text("Put the books on the truck in this order, then walk the route without backtracking.")
                }
            }
            .navigationTitle("Sort the truck")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    private var ordered: [(cn: String, level: Int, shelf: String)] {
        route.steps.flatMap { step -> [(String, Int, String)] in
            guard case let .floor(leg) = step else { return [] }
            return leg.stops.flatMap { stop in
                stop.callNumbers.map { ($0.raw, leg.level, stop.shelfID) }
            }
        }
    }
}
