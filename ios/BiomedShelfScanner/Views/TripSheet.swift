import SwiftUI

/// The growing trip, in a draggable sheet over the live camera (the Maps/Shortcuts idiom).
///
/// At the peek detent this is a glanceable count and one button — everything you need mid-scan
/// without looking. Drag up to review. See DESIGN.md §2.
struct TripSheet: View {

    @Environment(TripStore.self) private var store

    let router: Router
    let onToggleDiagnostics: (Bool) -> Void

    @State private var editing: TripItem?
    @State private var showManualEntry = false
    @State private var showHistory = false
    @State private var showDiagnostics = false
    @State private var showRoute = false
    @State private var showSheetScanner = false
    @State private var pendingImport: [(CallNumber, Router.Hit?)] = []
    @State private var confirmClear = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    header
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        .listRowSeparator(.hidden)
                }

                if store.current.isEmpty {
                    Section { emptyState.listRowSeparator(.hidden) }
                } else {
                    Section {
                        ForEach(store.current.items) { item in
                            TripRow(item: item) { editing = item }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        store.remove(item)
                                    } label: {
                                        Label("Remove", systemImage: "trash")
                                    }
                                }
                        }
                    } header: {
                        Text("^[\(store.current.bookCount) book](inflect: true)")
                    }
                }
            }
            .listStyle(.plain)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button { showManualEntry = true } label: {
                            Label("Type a call number", systemImage: "keyboard")
                        }
                        Button { showSheetScanner = true } label: {
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
                        Image(systemName: "ellipsis.circle").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("More actions")
                }
            }
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
            .sheet(isPresented: $showHistory) {
                HistoryView()
            }
            .sheet(isPresented: $showDiagnostics) {
                DiagnosticsView(onToggle: onToggleDiagnostics)
            }
            .fullScreenCover(isPresented: $showRoute) {
                RouteView(route: store.route())
            }
            .fullScreenCover(isPresented: $showSheetScanner) {
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

    // MARK: Header

    private var header: some View {
        // Bindings are built by hand rather than via @Bindable: every mutation goes through a
        // TripStore method so it can persist, and $store.current.kind would bypass that.
        VStack(spacing: 12) {
            Picker("Trip type", selection: Binding(
                get: { store.current.kind },
                set: { store.setKind($0) }
            )) {
                ForEach(TripKind.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("^[\(store.current.bookCount) book](inflect: true)")
                        .font(.headline)
                        .monospacedDigit()
                    if store.current.bookCount > 0 {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Button { showRoute = true } label: {
                    Text("Plan route")
                        .frame(minHeight: 44)
                        .padding(.horizontal, 8)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .disabled(store.current.locatedCount == 0)
            }
        }
    }

    private var subtitle: String {
        let missing = store.current.bookCount - store.current.locatedCount
        if missing == 0 { return "All located" }
        return "\(store.current.locatedCount) located · \(missing) need attention"
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "barcode.viewfinder")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Point the camera at a spine label")
                .font(.headline)
            Text("Call numbers are added automatically — no need to tap. Keep your eyes on the books.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
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
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.text)
                    .font(Theme.callNumber(.body))
                    .fixedSize(horizontal: false, vertical: true)   // wrap, don't truncate

                HStack(spacing: 8) {
                    StatusChip(item: item)
                    if item.wasTyped {
                        Label("Typed", systemImage: "keyboard")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer(minLength: 0)

            if item.quantity > 1 {
                Text("×\(item.quantity)")
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.accent)
                    .accessibilityLabel("\(item.quantity) copies")
            }
        }
        .padding(.vertical, 4)
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
