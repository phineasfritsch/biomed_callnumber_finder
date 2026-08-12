import SwiftUI

/// Capture a corpus of what Vision actually saw, then export it for off-device tuning.
///
/// This screen exists because the build loop is slow (cloud Mac, no USB device). Rather than
/// redeploying to test each grammar tweak, you capture reality once and iterate against it on any
/// machine with Node. See `ios/Tools/replay.js`.
struct DiagnosticsView: View {

    @Environment(\.dismiss) private var dismiss
    @State private var diagnostics = ScanDiagnostics.shared
    @State private var exportURLs: [URL]?
    @State private var exportError: String?
    @State private var reviewing: ScanDiagnostics.Record?

    /// Lets the parent flip the capture-queue flag without ScanDiagnostics knowing about the engine.
    let onToggle: (Bool) -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Toggle("Record what Vision sees", isOn: Binding(
                        get: { diagnostics.isRecording },
                        set: { diagnostics.isRecording = $0; onToggle($0) }
                    ))
                    .frame(minHeight: 44)
                } footer: {
                    Text("Captures the raw candidates behind every scan. Turn on, scan a shelf, then export and replay the file on your computer — no rebuild needed to try a fix.")
                }

                Section("Captured") {
                    Text(diagnostics.summary)
                        .font(.footnote)
                        .foregroundStyle(Theme.inkSoft)
                }

                if !diagnostics.records.isEmpty {
                    Section {
                        Button {
                            do { exportURLs = try diagnostics.export() }
                            catch { exportError = error.localizedDescription }
                        } label: {
                            Label("Export corpus", systemImage: "square.and.arrow.up")
                                .frame(minHeight: 44)
                        }
                        Button(role: .destructive) {
                            diagnostics.clear()
                        } label: {
                            Label("Clear", systemImage: "trash").frame(minHeight: 44)
                        }
                    } footer: {
                        Text("AirDrop or email the folder to yourself. It contains corpus.json plus a JPEG for each frame that failed.")
                    }

                    Section("Recent frames") {
                        // Newest first — the thing you just pointed at is what you want to see.
                        ForEach(diagnostics.records.reversed().prefix(60)) { r in
                            RecordRow(record: r).onTapGesture { reviewing = r }
                        }
                    }
                }
            }
            .paperScroll()
            .navigationTitle("Scan diagnostics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .sheet(item: $reviewing) { RecordDetail(record: $0) }
            .sheet(isPresented: .init(
                get: { exportURLs != nil },
                set: { if !$0 { exportURLs = nil } }
            )) {
                if let urls = exportURLs { ShareSheet(items: urls) }
            }
            .alert("Export failed", isPresented: .init(
                get: { exportError != nil }, set: { if !$0 { exportError = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(exportError ?? "")
            }
        }
    }
}

private struct RecordRow: View {
    let record: ScanDiagnostics.Record

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(color)
                .font(.caption)
            VStack(alignment: .leading, spacing: 2) {
                Text(record.callNumber ?? record.candidates.first?.text ?? "—")
                    .font(Theme.callNumber(12))
                    .lineLimit(1)
                Text(record.at, format: .dateTime.hour().minute().second())
                    .font(.caption2)
                    .foregroundStyle(Theme.inkFaint)
            }
            Spacer()
            if record.accepted {
                Image(systemName: "checkmark").font(.caption2).foregroundStyle(Theme.inkSoft)
            }
        }
    }

    private var symbol: String {
        switch record.outcome {
        case "located":   return "checkmark.circle.fill"
        case "unlocated": return "exclamationmark.triangle.fill"
        default:          return "questionmark.circle"
        }
    }
    private var color: Color {
        switch record.outcome {
        case "located":   return Theme.located
        case "unlocated": return Theme.unlocated
        default:          return .secondary
        }
    }
}

/// The raw candidates behind one frame.
///
/// This is the view that answers the only question that matters when a label won't scan: *did
/// Vision fail to read it, or did the pipeline throw away a good read?* The first is a camera
/// problem (lighting, ROI, distance), the second is a grammar problem. They look identical from
/// the outside and have nothing in common as fixes.
private struct RecordDetail: View {

    @Environment(\.dismiss) private var dismiss
    let record: ScanDiagnostics.Record

    var body: some View {
        NavigationStack {
            List {
                Section("Vision candidates, ranked") {
                    ForEach(Array(record.candidates.enumerated()), id: \.offset) { i, c in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.text)
                                .font(Theme.callNumber(12))
                                .fixedSize(horizontal: false, vertical: true)
                            Text("#\(i + 1) · confidence \(c.confidence, format: .number.precision(.fractionLength(2)))")
                                .font(.caption2)
                                .foregroundStyle(Theme.inkSoft)
                        }
                    }
                }

                Section("Extracted") {
                    if record.extracted.isEmpty {
                        Text("Nothing matched the call-number patterns.")
                            .font(.footnote).foregroundStyle(Theme.inkSoft)
                    } else {
                        ForEach(record.extracted, id: \.self) {
                            Text($0).font(Theme.callNumber(12))
                        }
                    }
                }

                Section("Outcome") {
                    LabeledContent("Result", value: record.outcome)
                    if let cn = record.callNumber { LabeledContent("Call number", value: cn) }
                    if let l = record.level, let s = record.shelfID, let side = record.side {
                        LabeledContent("Shelf", value: "L\(l) · \(s) · \(side)")
                    }
                    LabeledContent("Committed", value: record.accepted ? "yes" : "no")
                }
            }
            .paperScroll()
            .navigationTitle("Frame")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
