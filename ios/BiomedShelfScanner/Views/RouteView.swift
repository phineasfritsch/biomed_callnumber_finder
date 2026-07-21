import SwiftUI

/// The walk. A distinct mode — you've stopped scanning and started moving, so this is full-screen
/// with the camera off rather than another sheet detent.
struct RouteView: View {

    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss

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

                        // Every branch emits a Section. Mixing bare rows and Sections inside one
                        // List renders inconsistently — the bare row gets an implicit section of
                        // its own and the spacing goes wrong.
                        ForEach(Array(route.steps.enumerated()), id: \.offset) { _, step in
                            switch step {
                            case let .transit(t):
                                Section { TransitRow(transit: t) }
                            case let .floor(leg):
                                FloorSection(leg: leg, kind: store.current.kind)
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

    private var text: String {
        switch transit {
        case let .elevator(to, skipping) where skipping > 0:
            return "Take the elevator down to Level \(to) (skips ^[\(skipping) floor](inflect: true))."
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

    var body: some View {
        Section {
            // Keyed by Stop.id ("shelfID|side") — a double-sided shelf puts two stops at the same
            // column, so shelfID alone collides.
            ForEach(leg.stops) { stop in
                StopRow(stop: stop, level: leg.level, kind: kind)
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
                    HStack(spacing: 6) {
                        Text("Index \(stop.x, format: .number)")
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                        Text("·").foregroundStyle(.secondary)
                        Text(rowLabel).font(.subheadline).foregroundStyle(.secondary)
                        Text("·").foregroundStyle(.secondary)
                        Text(sideLabel).font(.subheadline).foregroundStyle(.secondary)
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
