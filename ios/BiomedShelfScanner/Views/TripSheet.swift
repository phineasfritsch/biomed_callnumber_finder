import SwiftUI

/// The growing trip, in a draggable sheet over the live camera (the Maps/Shortcuts idiom).
///
/// At the peek detent this is a glanceable count and one button — everything you need mid-scan
/// without looking. Drag up to review. See DESIGN.md §2.
struct TripSheet: View {

    @Environment(TripStore.self) private var store

    let router: Router
    let onToggleDiagnostics: (Bool) -> Void
    /// The camera is a battery and thermal cost with nothing to show for it while a full-screen
    /// mode is up. Route, request-sheet capture and headcount all cover the preview completely.
    let onPresentFullScreen: () -> Void
    let onDismissFullScreen: () -> Void
    /// Reports this sheet's top edge in global (screen) coordinates, so `ScanView` can lay the
    /// shutter and the scan band out against where the sheet **is** rather than against the
    /// detent height it asked for. Those are not the same number.
    let onTopEdgeChanged: (CGFloat) -> Void

    @State private var editing: TripItem?
    @State private var showManualEntry = false
    @State private var showSearch = false
    @State private var showHistory = false
    @State private var showDiagnostics = false
    @State private var showRoute = false
    @State private var showHeadcount = false
    @State private var showSheetScanner = false
    @State private var pendingImport: [(CallNumber, Router.Hit?)] = []
    @State private var confirmClear = false

    var body: some View {
        NavigationStack {
            ZStack {
                PaperBackground()
                list
            }
            // Reports on every drag frame, which is what lets the shutter get out of the way as
            // the sheet comes up rather than after it has arrived.
            .background {
                GeometryReader { g in
                    Color.clear
                        .onAppear { onTopEdgeChanged(g.frame(in: .global).minY) }
                        .onChange(of: g.frame(in: .global).minY) { _, y in onTopEdgeChanged(y) }
                }
            }
            .toolbarBackground(Theme.paper, for: .navigationBar)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .tint(Theme.ink)
            .sheet(item: $editing) { item in
                ManualEntryView(router: router, existing: item) { text in
                    store.updateText(text, for: item)
                }
            }
            .sheet(isPresented: $showManualEntry) {
                ManualEntryView(router: router, existing: nil) { text in
                    guard let cn = CallNumber.parse(text) else { return }
                    store.add(cn, hit: router.locate(cn), typed: true)
                }
            }
            .sheet(isPresented: $showSearch) { SearchView(router: router) }
            .sheet(isPresented: $showHistory) { HistoryView() }
            .sheet(isPresented: $showDiagnostics) { DiagnosticsView(onToggle: onToggleDiagnostics) }
            .fullScreenCover(isPresented: $showRoute, onDismiss: onDismissFullScreen) {
                RouteView(route: store.route())
            }
            .fullScreenCover(isPresented: $showHeadcount, onDismiss: onDismissFullScreen) {
                HeadcountView()
            }
            .fullScreenCover(isPresented: $showSheetScanner, onDismiss: onDismissFullScreen) {
                DocumentScanner(
                    router: router,
                    onFinish: { pendingImport = $0; showSheetScanner = false },
                    onCancel: { showSheetScanner = false }
                )
                .ignoresSafeArea()
            }
            .sheet(isPresented: .init(
                get: { !pendingImport.isEmpty },
                set: { if !$0 { pendingImport = [] } }
            )) {
                SheetImportReview(found: pendingImport) { chosen in
                    for (cn, hit) in chosen { store.add(cn, hit: hit) }
                    pendingImport = []
                }
            }
            .confirmationDialog("Clear this trip?", isPresented: $confirmClear, titleVisibility: .visible) {
                Button("Clear \(store.current.bookCount) books", role: .destructive) { store.clear() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This removes every scanned call number. It can't be undone.")
            }
        }
    }

    private var list: some View {
        List {
            Section {
                header
                    .listRowInsets(EdgeInsets(top: 8, leading: 14, bottom: 8, trailing: 14))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
            }

            if store.current.isEmpty {
                Section {
                    emptyState
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                }
            } else {
                Section {
                    ForEach(store.current.items) { item in
                        TripRow(item: item) { editing = item }
                            .listRowInsets(EdgeInsets(top: 4, leading: 14, bottom: 4, trailing: 14))
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    store.remove(item)
                                } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                            }
                    }
                } header: {
                    MicroLabel(text: "\(store.current.bookCount) "
                        + (store.current.bookCount == 1 ? "book" : "books"))
                        .padding(.leading, 2)
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .environment(\.defaultMinListRowHeight, 0)
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Menu {
                Button { showSearch = true } label: {
                    Label("Find a shelf", systemImage: "magnifyingglass")
                }
                Button { showManualEntry = true } label: {
                    Label("Type a call number", systemImage: "keyboard")
                }
                Button { showSheetScanner = true; onPresentFullScreen() } label: {
                    Label("Scan a request sheet", systemImage: "doc.viewfinder")
                }
                Divider()
                Button { showHistory = true } label: {
                    Label("Past trips", systemImage: "clock.arrow.circlepath")
                }
                Button { showDiagnostics = true } label: {
                    Label("Scan diagnostics", systemImage: "stethoscope")
                }
                if !store.current.isEmpty {
                    Divider()
                    // Destructive action, visually and spatially separated.
                    Button(role: .destructive) { confirmClear = true } label: {
                        Label("Clear trip", systemImage: "trash")
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(Theme.ink)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("More actions")
        }

        // Headcount is the other job this phone does on a shift, and it is on a two-hour clock —
        // it does not belong buried in an overflow menu behind the job you happen to be doing
        // now. One tap, and the scanner keeps the root position it was designed around.
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                showHeadcount = true
                onPresentFullScreen()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "person.2.fill").font(.system(size: 12, weight: .semibold))
                    Text("Headcount").font(Theme.mono(12, relativeTo: .footnote, weight: .semibold))
                }
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 10)
                .frame(height: 44)
            }
            .accessibilityLabel("Headcount")
            .accessibilityHint("Opens the headcount round for this walk.")
        }
    }

    // MARK: Header

    private var header: some View {
        // Bindings are built by hand rather than via @Bindable: every mutation goes through a
        // TripStore method so it can persist, and $store.current.kind would bypass that.
        VStack(alignment: .leading, spacing: 12) {
            Picker("Trip type", selection: Binding(
                get: { store.current.kind },
                set: { store.setKind($0) }
            )) {
                ForEach(TripKind.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)

            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(store.current.bookCount)")
                        .font(Theme.display(26, relativeTo: .title))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                    Text(subtitle)
                        .font(Theme.mono(11, relativeTo: .caption))
                        .foregroundStyle(Theme.inkSoft)
                }
                Spacer(minLength: 0)
                Button("Plan route") { showRoute = true; onPresentFullScreen() }
                    .buttonStyle(.shelf)
                    .disabled(store.current.locatedCount == 0)
            }
        }
        .card()
    }

    private var subtitle: String {
        guard store.current.bookCount > 0 else { return "nothing scanned yet" }
        let missing = store.current.bookCount - store.current.locatedCount
        if missing == 0 { return "all located" }
        return "\(store.current.locatedCount) located · \(missing) need attention"
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "barcode.viewfinder")
                .font(.system(size: 26))
                .foregroundStyle(Theme.inkFaint)
            Text("Point the camera at a spine label")
                .font(Theme.display(17))
                .foregroundStyle(Theme.ink)
            Text("One press per book. Keep your eyes on the shelf rather than the screen, and the phone will tell you what it got.")
                .font(Theme.mono(12, relativeTo: .footnote))
                .foregroundStyle(Theme.inkSoft)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .padding(.horizontal, 14)
    }
}

/// One book in the list.
///
/// Monospaced and wrapping, never truncated — a truncated call number is a wrong call number,
/// and this list is where a bad OCR read gets caught.
struct TripRow: View {

    @Environment(TripStore.self) private var store
    let item: TripItem
    let onEdit: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(item.text)
                    .font(Theme.callNumber())
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)   // wrap, don't truncate

                HStack(spacing: 6) {
                    StatusChip(item: item, onSoftGround: true)
                    if item.wasTyped {
                        Chip(text: "typed", tone: .info, symbol: "keyboard", onSoftGround: true)
                    }
                }
            }

            Spacer(minLength: 0)

            if item.quantity > 1 {
                Text("×\(item.quantity)")
                    .font(Theme.mono(14, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.accent)
                    .accessibilityLabel("\(item.quantity) copies")
            }
        }
        // Rows carry the same green-soft "this is a hit" / orange-soft "look at this" grounds the
        // website uses, so a row's state reads before you get as far as the chip. The chip is
        // still there — colour is never the only carrier.
        .padding(12)
        .background(
            item.isLocated ? Theme.greenSoft : Theme.orangeSoft,
            in: RoundedRectangle(cornerRadius: Theme.radius)
        )
        .overlay {
            RoundedRectangle(cornerRadius: Theme.radius)
                .strokeBorder(item.isLocated ? Theme.green.opacity(0.28) : Theme.orange.opacity(0.3),
                              lineWidth: 1)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onEdit)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Double tap to edit or change quantity")
        .contextMenu {
            Button { onEdit() } label: { Label("Edit", systemImage: "pencil") }
            Button {
                store.setQuantity(item.quantity + 1, for: item)
            } label: {
                Label("Add a copy", systemImage: "plus")
            }
            if item.quantity > 1 {
                Button {
                    store.setQuantity(item.quantity - 1, for: item)
                } label: {
                    Label("Remove a copy", systemImage: "minus")
                }
            }
            Divider()
            Button(role: .destructive) { store.remove(item) } label: {
                Label("Remove", systemImage: "trash")
            }
        }
    }
}
