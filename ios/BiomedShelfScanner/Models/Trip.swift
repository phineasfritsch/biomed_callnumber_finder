import Foundation
import Observation

/// One book (or several copies of one book) on a trip.
struct TripItem: Identifiable, Codable, Equatable {
    var id = UUID()
    /// Normalized, uppercase. This is the identity used for dedupe.
    var text: String
    /// Multiple copies of the same title genuinely happen on a returns truck. Re-scanning bumps
    /// this rather than being silently swallowed.
    var quantity: Int = 1
    /// Whether this came from OCR or was typed. Typed entries skip the grammar gate, which is how
    /// the 7 odd real endpoints (`ZWZ 330`, `Q 41 R81R8`, …) get onto a trip at all.
    var wasTyped: Bool = false
    /// Set at scan time so the row can show a location chip immediately. Recomputed on route build.
    var level: Int?
    var shelfID: String?
    var side: String?
    /// Last time this row was written by a scan. Gates prefix-merging: an upgrade from the SAME
    /// physical book arrives within a couple of seconds; anything later is presumed to be a
    /// different book that happens to share the base (journals shelve as runs of the same title).
    /// Optional so trips persisted before this field existed still decode; nil reads as "long ago".
    var updatedAt: Date? = nil

    var isLocated: Bool { level != nil }

    /// e.g. "L2 · top-5 · right"
    var locationLabel: String? {
        guard let level, let shelfID, let side else { return nil }
        let sideName = ["left": "left", "right": "right", "single": "single"][side] ?? side
        return "L\(level) · \(shelfID) · \(sideName)"
    }
}

enum TripKind: String, Codable, CaseIterable, Identifiable {
    case fetch, shelve
    var id: String { rawValue }

    var title: String { self == .fetch ? "Fetch" : "Shelve" }
    /// The route is identical either way — only the language changes. See DESIGN.md §2.
    var verb: String { self == .fetch ? "Collect" : "Shelve" }
    var pastVerb: String { self == .fetch ? "Collected" : "Shelved" }
}

struct Trip: Identifiable, Codable, Equatable {
    var id = UUID()
    var createdAt = Date()
    var kind: TripKind = .shelve
    var items: [TripItem] = []
    /// Route stops already completed, keyed "level|shelfID|side". Survives force-quit — a 40-book
    /// walk takes 20 minutes and *will* be interrupted.
    var completedStops: Set<String> = []

    var bookCount: Int { items.reduce(0) { $0 + $1.quantity } }
    var locatedCount: Int { items.filter(\.isLocated).reduce(0) { $0 + $1.quantity } }
    var isEmpty: Bool { items.isEmpty }
}

/// Current trip + history, persisted to disk.
///
/// Deliberately a plain Codable file rather than SwiftData. The dataset is tiny and single-user,
/// so SwiftData's real strengths (queries, relationships, migration) buy nothing here, while its
/// failure modes are subtle. A ~40-line store that is obviously correct beats a framework that
/// might not be — especially given this code was written without a compiler to check it against.
@Observable
final class TripStore {

    private(set) var current = Trip()
    private(set) var history: [Trip] = []

    /// Not private: the walk map has to ask which faces exist on a floor to draw it.
    let router: Router
    private let fileURL: URL
    private var saveTask: Task<Void, Never>?

    init(router: Router) {
        self.router = router
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        self.fileURL = dir.appendingPathComponent("trips.json")
        load()
    }

    // MARK: Mutating the current trip

    enum AddOutcome {
        /// New book, new row.
        case added
        /// Same book, better read — an earlier partial ("W1 NA388") was upgraded to the fuller
        /// text ("W1 NA388 NO.66 1984"). No new row.
        case merged
        /// Already on the trip, nothing changed.
        case alreadyPresent
    }

    /// Add a scanned or typed call number.
    ///
    /// Exact-text re-scan is always a no-op (exact duplicate copies are rare here; real second
    /// copies go through the quantity stepper).
    ///
    /// **Token-prefix merging is gated by `mergeWindow`, and that gate is load-bearing.** The
    /// merge exists for one case only: the SAME physical book read twice at different
    /// completeness (`W1 NA388`, then `W1 NA388 NO.66 1984` once the volume lines assemble). But
    /// prefix-relatedness does NOT imply same book — journals shelve as runs, so the *next* book
    /// on the shelf is usually the same title with a different volume, and its full read is a
    /// perfectly valid extension of the previous book's partial read. Unconditional merging
    /// therefore silently destroys books:
    ///
    ///   scan A (no.66) → partial row "W1 NA388"
    ///   scan B (no.71) → "W1 NA388 NO.71 1989" extends it → row becomes B → **A is gone**
    ///   (reverse order drops B instead, via the prefix no-op)
    ///
    /// A same-book upgrade can only arrive within a couple of seconds of the partial (the voter's
    /// cadence). So: pass a short `mergeWindow` in sweep mode, where upgrades genuinely happen —
    /// prefix rules then apply only against rows written within that window. Pass nil in
    /// single-shot mode — the engine disarms after each accept, an upgrade can never follow, so
    /// prefix-merging there is pure cross-book hazard with zero benefit. Manual entry and sheet
    /// import also pass nil. Outside the window, a prefix-related read is presumed to be a
    /// different volume and gets its own row; an occasional partial row to tidy in review beats a
    /// silently missing book.
    @discardableResult
    func add(_ cn: CallNumber, hit: Router.Hit?, typed: Bool = false,
             mergeWindow: TimeInterval? = nil) -> AddOutcome {
        let key = cn.raw.uppercased()
        let newTokens = key.split(separator: " ")
        let now = Date()

        for (i, item) in current.items.enumerated() {
            let oldTokens = item.text.split(separator: " ")
            if oldTokens.elementsEqual(newTokens) { return .alreadyPresent }

            guard let window = mergeWindow,
                  let touched = item.updatedAt,
                  now.timeIntervalSince(touched) <= window
            else { continue }

            if newTokens.starts(with: oldTokens) {
                current.items[i].text = key
                current.items[i].level = hit?.level
                current.items[i].shelfID = hit?.shelfID
                current.items[i].side = hit?.side
                current.items[i].updatedAt = now
                save()
                return .merged
            }
            if oldTokens.starts(with: newTokens) {
                current.items[i].updatedAt = now   // same book still in frame; keep window open
                return .alreadyPresent
            }
        }

        current.items.append(TripItem(
            text: key,
            wasTyped: typed,
            level: hit?.level,
            shelfID: hit?.shelfID,
            side: hit?.side,
            updatedAt: now
        ))
        save()
        return .added
    }

    func remove(_ item: TripItem) {
        current.items.removeAll { $0.id == item.id }
        save()
    }

    func setQuantity(_ q: Int, for item: TripItem) {
        guard let i = current.items.firstIndex(where: { $0.id == item.id }) else { return }
        if q <= 0 { current.items.remove(at: i) } else { current.items[i].quantity = q }
        save()
    }

    /// Re-resolve after an edit — the whole point of manual entry is fixing a bad read.
    func updateText(_ text: String, for item: TripItem) {
        guard let i = current.items.firstIndex(where: { $0.id == item.id }),
              let cn = CallNumber.parse(text)
        else { return }
        let hit = router.locate(cn)
        current.items[i].text = cn.raw.uppercased()
        current.items[i].level = hit?.level
        current.items[i].shelfID = hit?.shelfID
        current.items[i].side = hit?.side
        current.items[i].wasTyped = true
        save()
    }

    func setKind(_ kind: TripKind) {
        current.kind = kind
        save()
    }

    // MARK: Route progress

    func isStopComplete(_ key: String) -> Bool { current.completedStops.contains(key) }

    func toggleStop(_ key: String) {
        if current.completedStops.contains(key) {
            current.completedStops.remove(key)
        } else {
            current.completedStops.insert(key)
        }
        save()
    }

    // MARK: Lifecycle

    func finish() {
        guard !current.isEmpty else { return }
        history.insert(current, at: 0)
        if history.count > 50 { history.removeLast(history.count - 50) }
        current = Trip(kind: current.kind)
        save()
    }

    func clear() {
        current = Trip(kind: current.kind)
        save()
    }

    func route() -> Router.Route {
        // Expand quantities: two copies of one title are two books to shelve, but they live on the
        // same face, so the route groups them naturally.
        let cns = current.items.compactMap { CallNumber.parse($0.text) }
        return router.buildRoute(cns)
    }

    // MARK: Persistence

    private struct Payload: Codable { var current: Trip; var history: [Trip] }

    /// Debounced — scanning fires this on every accept and we don't want 40 disk writes in a
    /// minute. 0.5s is well under the time it takes to walk away with an unsaved trip.
    private func save() {
        saveTask?.cancel()
        let payload = Payload(current: current, history: history)
        let url = fileURL
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            guard let data = try? JSONEncoder().encode(payload) else { return }
            try? data.write(to: url, options: .atomic)
        }
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let payload = try? JSONDecoder().decode(Payload.self, from: data)
        else { return }
        current = payload.current
        history = payload.history
    }
}
