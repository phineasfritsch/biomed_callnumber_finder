import SwiftUI

/// "Where does this go?" — the website's search box, as a screen.
///
/// Distinct from ManualEntryView on purpose: that adds a book to the trip; this answers a
/// question and adds nothing. Results mirror the web app exactly — every matching face,
/// level-ascending, with the serial-run hint when more than one matches. See `Router.search`
/// for why "every matching face" is the only correct behaviour here.
struct SearchView: View {

    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Bool

    let router: Router
    @State private var query = ""

    private var parsed: CallNumber? {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : CallNumber.parse(trimmed)
    }
    private var hits: [Router.Hit] { parsed.map(router.search) ?? [] }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("W1 JO600, QL737.C22, WM 13 D5537…", text: $query)
                        .font(Theme.callNumber())
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .focused($focused)
                        .frame(minHeight: 44)
                } footer: {
                    // The web app's footer, condensed: same forgiveness, same warning.
                    Text("Spaces and the Cutter dot are optional. QL737.C22, QL 737 C22 and W1 JO600 all work.")
                }

                if let cn = parsed {
                    if hits.isEmpty {
                        Section {
                            Label {
                                Text("No mapped shelf contains **\(cn.raw.uppercased())**. It may be on a level not yet mapped, in Reference (Floor 4), or just outside the mapped ranges.")
                            } icon: {
                                Image(systemName: "questionmark.circle")
                            }
                            .foregroundStyle(Theme.inkSoft)
                        }
                    } else {
                        Section {
                            ForEach(hits) { hit in
                                resultRow(hit)
                            }
                        } footer: {
                            if hits.count > 1 {
                                // Verbatim intent from the web app: serial runs share one call
                                // number across shelves; the spine's volume/year disambiguates.
                                Text("\(hits.count) shelves match. For a serial, the volume and year on the spine tell you which one.")
                            }
                        }
                    }
                }
            }
            .paperScroll()
            .navigationTitle("Find a shelf")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .onAppear { focused = true }
        }
    }

    private func resultRow(_ hit: Router.Hit) -> some View {
        let shelf = Router.shelf(id: hit.shelfID)
        let side = ["left": "Left", "right": "Right", "single": "Single (R)"][hit.side] ?? hit.side
        let place = shelf.map { "\($0.row.rawValue) row · index \($0.index)" } ?? "shelf \(hit.shelfID)"

        return VStack(alignment: .leading, spacing: 4) {
            Text("Level \(hit.level) · \(place) · \(side) side")
                .font(.subheadline.weight(.semibold))
            Text("\(hit.range.start) – \(hit.range.end)")
                .font(Theme.callNumber(12))
                .foregroundStyle(Theme.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 2)
    }
}

extension Router.Hit: Identifiable {
    public var id: String { "\(level)|\(shelfID)|\(side)" }
}
