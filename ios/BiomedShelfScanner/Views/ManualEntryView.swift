import SwiftUI

/// Type or fix a call number.
///
/// Two jobs. First, correcting a bad read — the review list is the last line of defense (§4), so
/// fixing has to be quick. Second, entering the books the grammar gate legitimately can't accept:
/// `ZWZ 330`, `Q 41 R81R8` and the handful of other real oddities (§3.3). Typed entries skip the
/// grammar deliberately — a human looking at the spine outranks a regex fitted to this collection.
struct ManualEntryView: View {

    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Bool

    let router: Router
    let existing: TripItem?
    let onCommit: (String) -> Void

    @State private var text: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("W1 NA388 no.66 1984", text: $text)
                        .font(Theme.callNumber())
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()          // same reason as usesLanguageCorrection = false
                        .focused($focused)
                        .submitLabel(.done)
                        .onSubmit(commit)
                        .frame(minHeight: 44)
                } header: {
                    Text("Call number")
                } footer: {
                    // Live resolution while typing — the same instant feedback the scanner gives.
                    liveStatus
                }

                if let item = existing, item.quantity > 1 {
                    Section("Copies") {
                        Text("×\(item.quantity)")
                            .font(.body.monospacedDigit())
                    }
                }
            }
            .paperScroll()
            .navigationTitle(existing == nil ? "Add call number" : "Edit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: commit)
                        .disabled(CallNumber.parse(text) == nil)
                }
            }
            .onAppear {
                text = existing?.text ?? ""
                focused = true
            }
        }
        .presentationDetents([.medium])
    }

    @ViewBuilder
    private var liveStatus: some View {
        if text.trimmingCharacters(in: .whitespaces).isEmpty {
            Text("Type it exactly as printed on the spine.")
        } else if let cn = CallNumber.parse(text), let hit = router.locate(cn) {
            // Serial runs match several faces; hiding that made the single answer read as
            // "wrong shelf". Route still targets the first face — same as the website.
            let matches = router.search(cn).count
            Label(
                matches > 1
                    ? "Level \(hit.level) · \(hit.shelfID) · \(hit.side). \(matches) shelves match; it is a serial run, so check the volume and year."
                    : "Level \(hit.level) · \(hit.shelfID) · \(hit.side)",
                systemImage: "checkmark.circle.fill"
            )
            .foregroundStyle(Theme.located)
        } else if CallNumber.parse(text) != nil {
            Label(
                "Not in the mapped ranges. It may be Reference on Floor 4, or outside the mapped stacks. Add it anyway if that is what the spine says.",
                systemImage: "exclamationmark.triangle.fill"
            )
            .foregroundStyle(Theme.unlocated)
        } else {
            Label("Not recognisable as a call number yet.", systemImage: "questionmark.circle")
                .foregroundStyle(Theme.inkSoft)
        }
    }

    private func commit() {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard CallNumber.parse(trimmed) != nil else { return }
        onCommit(trimmed)
        dismiss()
    }
}

/// Review what came off a request sheet before committing it.
///
/// A sheet scan is a bulk import — a dozen call numbers arriving at once, none of them looked at.
/// Committing that silently would undo the whole point of scan-time validation, so it gets a
/// checklist. Everything is pre-selected; the work is deselecting mistakes, not selecting hits.
struct SheetImportReview: View {

    @Environment(\.dismiss) private var dismiss

    let found: [(CallNumber, Router.Hit?)]
    let onCommit: ([(CallNumber, Router.Hit?)]) -> Void

    @State private var excluded: Set<String> = []

    var body: some View {
        NavigationStack {
            Group {
                if found.isEmpty {
                    ContentUnavailableView(
                        "No call numbers found",
                        systemImage: "doc.questionmark",
                        description: Text("Try again with the sheet flat and evenly lit.")
                    )
                } else {
                    List {
                        Section {
                            ForEach(found, id: \.0.raw) { cn, hit in
                                row(cn, hit)
                            }
                        } footer: {
                            Text("Tap to exclude anything that looks wrong.")
                        }
                    }
                }
            }
            .paperScroll()
            .navigationTitle("^[\(found.count) found](inflect: true)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add \(selected.count)") {
                        onCommit(selected)
                        dismiss()
                    }
                    .disabled(selected.isEmpty)
                }
            }
        }
    }

    private var selected: [(CallNumber, Router.Hit?)] {
        found.filter { !excluded.contains($0.0.raw) }
    }

    private func row(_ cn: CallNumber, _ hit: Router.Hit?) -> some View {
        let isIn = !excluded.contains(cn.raw)
        return HStack {
            Image(systemName: isIn ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isIn ? Theme.accent : .secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text(cn.raw)
                    .font(Theme.callNumber())
                    .fixedSize(horizontal: false, vertical: true)
                if let hit {
                    Label("L\(hit.level) · \(hit.shelfID) · \(hit.side)", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(Theme.located)
                } else {
                    Label("Not in mapped ranges", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(Theme.unlocated)
                }
            }
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .onTapGesture {
            if isIn { excluded.insert(cn.raw) } else { excluded.remove(cn.raw) }
        }
        .accessibilityAddTraits(isIn ? [.isSelected] : [])
    }
}

/// Past trips. Read-only — this is a record, not a workspace.
struct HistoryView: View {

    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if store.history.isEmpty {
                    ContentUnavailableView(
                        "No past trips",
                        systemImage: "clock",
                        description: Text("Finished trips are kept here.")
                    )
                } else {
                    List(store.history) { trip in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(trip.createdAt, format: .dateTime.month().day().hour().minute())
                                .font(.headline)
                            Text("\(trip.kind.title) · ^[\(trip.bookCount) book](inflect: true)")
                                .font(.caption)
                                .foregroundStyle(Theme.inkSoft)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            .paperScroll()
            .navigationTitle("Past trips")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
