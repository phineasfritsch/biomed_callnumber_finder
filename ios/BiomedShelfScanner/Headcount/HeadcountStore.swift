import Foundation
import Observation
import UIKit

/// Live round state, the outbox and the log.
///
/// Two stores, for the same reason the web app has two:
///
/// * **Live counts** go to `UserDefaults` and are written **synchronously on every tap** — not
///   debounced, not on background, not on terminate. Assume the process dies between any two
///   taps. A round is forty minutes of walking; losing it is losing the walk.
/// * **Outbox and log** go to a JSON file in Application Support. They are structured records
///   that outlive a round, and they are written at transition points rather than per tap.
///
/// The trip store next door debounces its writes by half a second, which is right for scanning —
/// a lost scan costs one re-scan. It is not right here, where a lost tap is a number nobody can
/// reconstruct.
@Observable
@MainActor
final class HeadcountStore {

    // MARK: Round shape

    /// Which forms this round writes to. Biomed always; the Hub when the walk includes it.
    private(set) var includeCollab = false
    private(set) var dayIndex: Int
    /// Slot index per form id. Snapped per form against that form's own list — near midnight the
    /// two can legitimately disagree about the calendar day, and the app says so rather than
    /// picking one.
    private(set) var slotIndex: [String: Int] = [:]
    private(set) var counts: [String: [String: Int]] = [:]
    /// Forms whose row Google has confirmed. Persisted, so a kill mid-round does not offer to
    /// submit a form that already landed.
    private(set) var done: Set<String> = []
    /// Where the walk got to. A phone killed on Level 7 reopens on Level 7.
    private(set) var walkIndex = 0

    /// Set when a live round was found on disk at launch. The user resumes or discards it —
    /// never a silent resume, because a silently resumed round is indistinguishable from a fresh
    /// one until the numbers are wrong.
    private(set) var resumable = false
    /// The device could not persist (quota, or storage full). Surfaced, because an app that
    /// cannot persist is an app that will lose a round.
    private(set) var persistenceFailed = false

    // MARK: Queue and log

    struct Queued: Codable, Identifiable, Hashable {
        var submissionId: String
        var formId: String
        var payload: [String: String]
        var queuedAt: Date
        var attempt: Int
        var lastError: String?
        var total: Int
        var id: String { submissionId }

        var isStale: Bool { Date().timeIntervalSince(queuedAt) > HeadcountConfig.staleQueue }
    }

    struct LogEntry: Codable, Identifiable, Hashable {
        var submissionId: String
        var at: Date
        var formId: String
        var day: String
        var time: String
        var total: Int
        var result: String
        var code: String
        var id: String { submissionId }
    }

    private(set) var outbox: [Queued] = []
    private(set) var log: [LogEntry] = []

    /// Named changes on the live Google Forms, per form id. Non-empty blocks submission.
    private(set) var drift: [String: [String]] = [:]
    private(set) var driftCheckedAt: Date?
    private(set) var driftError: String?

    // MARK: Derived

    var forms: [HeadcountConfig.Form] {
        includeCollab ? [HeadcountConfig.biomed, HeadcountConfig.collab] : [HeadcountConfig.biomed]
    }

    /// Forms still owed a row. A combined round can half-land; the confirmed one locks and only
    /// what is outstanding is offered again.
    var pendingForms: [HeadcountConfig.Form] { forms.filter { !done.contains($0.id) } }

    var stops: [HeadcountLogic.Stop] { HeadcountLogic.walkSequence(forms) }

    var isBlockedByDrift: Bool { forms.contains { !(drift[$0.id]?.isEmpty ?? true) } }

    func count(_ stop: HeadcountLogic.Stop) -> Int {
        counts[stop.form.id]?[stop.counter.entry] ?? 0
    }

    func total(_ form: HeadcountConfig.Form) -> Int {
        HeadcountLogic.total(form, counts: counts[form.id] ?? [:])
    }

    var grandTotal: Int { forms.reduce(0) { $0 + total($1) } }

    func isLocked(_ form: HeadcountConfig.Form) -> Bool { done.contains(form.id) }

    func slot(_ form: HeadcountConfig.Form) -> Int {
        slotIndex[form.id] ?? 0
    }

    /// The literal string this form will store, which is not always the label shown.
    func timeValue(_ form: HeadcountConfig.Form) -> String { form.times[slot(form)] }
    func timeLabel(_ form: HeadcountConfig.Form) -> String { form.timeLabels[slot(form)] }

    var day: String { HeadcountConfig.days[dayIndex] }

    // MARK: Init

    private let fileURL: URL
    private let defaults: UserDefaults
    private static let liveKey = "headcount.live.v2"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        self.fileURL = dir.appendingPathComponent("headcount.json")
        self.dayIndex = 0

        loadArchive()
        if loadLive() {
            resumable = true
        } else {
            snapToNow()
        }
    }

    // MARK: Round setup

    /// Snap day and per-form slot to the clock. Called on a fresh round and when the user asks
    /// for it — never silently over a round in progress.
    func snapToNow(_ now: Date = .now) {
        let lead = HeadcountLogic.snapSlot(now, form: HeadcountConfig.biomed)
        dayIndex = lead.dayIndex
        for f in HeadcountConfig.forms {
            slotIndex[f.id] = HeadcountLogic.snapSlot(now, form: f).index
        }
        saveLive()
    }

    /// True when the two forms' snapped slots land on different calendar days. Only Biomed has an
    /// 11:00 PM slot, so just after midnight they genuinely disagree — and the app says so
    /// instead of choosing.
    func daysDisagree(_ now: Date = .now) -> Bool {
        guard includeCollab else { return false }
        let a = HeadcountLogic.snapSlot(now, form: HeadcountConfig.biomed)
        let b = HeadcountLogic.snapSlot(now, form: HeadcountConfig.collab)
        return a.dayIndex != b.dayIndex
    }

    func setIncludeCollab(_ on: Bool) {
        includeCollab = on
        if counts[HeadcountConfig.collab.id] == nil {
            counts[HeadcountConfig.collab.id] = HeadcountLogic.emptyCounts(HeadcountConfig.collab)
        }
        clampWalkIndex()
        saveLive()
    }

    func setDay(_ index: Int) {
        dayIndex = (index + 7) % 7
        saveLive()
    }

    func setSlot(_ index: Int, for form: HeadcountConfig.Form) {
        slotIndex[form.id] = min(max(0, index), form.times.count - 1)
        saveLive()
    }

    // MARK: Counting

    private var lastTap: [String: Date] = [:]

    enum TapOutcome {
        case changed(Int)
        /// Clamped at 0 or 999, or the form is already recorded. The UI answers with a refusal
        /// rather than with silence — "nothing happened" must never be confusable with "you
        /// missed the button".
        case refused
        /// Two events from one physical tap.
        case debounced
    }

    @discardableResult
    func bump(_ stop: HeadcountLogic.Stop, by delta: Int, now: Date = .now) -> TapOutcome {
        guard !isLocked(stop.form) else { return .refused }

        if delta > 0, let last = lastTap[stop.id],
           now.timeIntervalSince(last) < HeadcountConfig.tapDebounce {
            return .debounced
        }
        lastTap[stop.id] = now

        let current = count(stop)
        let next = HeadcountLogic.clamp(current + delta)
        guard next != current else { return .refused }

        counts[stop.form.id, default: [:]][stop.counter.entry] = next
        saveLive()
        return .changed(next)
    }

    func reset(_ stop: HeadcountLogic.Stop) {
        guard !isLocked(stop.form) else { return }
        counts[stop.form.id, default: [:]][stop.counter.entry] = 0
        saveLive()
    }

    func setWalkIndex(_ i: Int) {
        walkIndex = min(max(0, i), max(0, stops.count - 1))
        saveLive()
    }

    private func clampWalkIndex() { walkIndex = min(walkIndex, max(0, stops.count - 1)) }

    // MARK: Round lifecycle

    func resume() { resumable = false }

    /// Explicit discard. The only way live counts are thrown away.
    func discard() {
        resumable = false
        counts = [:]
        for f in HeadcountConfig.forms { counts[f.id] = HeadcountLogic.emptyCounts(f) }
        done = []
        walkIndex = 0
        snapToNow()
    }

    /// Called when a form's row is confirmed by Google. Live state is cleared only once **every**
    /// form in the round has landed — a half-landed combined round keeps its numbers so the
    /// outstanding form can still be submitted.
    func markConfirmed(_ form: HeadcountConfig.Form) {
        done.insert(form.id)
        if forms.allSatisfy({ done.contains($0.id) }) {
            counts = [:]
            for f in HeadcountConfig.forms { counts[f.id] = HeadcountLogic.emptyCounts(f) }
            done = []
            walkIndex = 0
            snapToNow()
        } else {
            saveLive()
        }
    }

    // MARK: Outbox

    func enqueue(_ item: Queued) {
        outbox.removeAll { $0.submissionId == item.submissionId }
        outbox.append(item)
        outbox.sort { $0.queuedAt < $1.queuedAt }
        saveArchive()
    }

    func dequeue(_ submissionId: String) {
        outbox.removeAll { $0.submissionId == submissionId }
        saveArchive()
    }

    func noteAttempt(_ submissionId: String, error: String?) {
        guard let i = outbox.firstIndex(where: { $0.submissionId == submissionId }) else { return }
        outbox[i].attempt += 1
        outbox[i].lastError = error
        saveArchive()
    }

    /// Last 50 submissions, newest first.
    func record(_ entry: LogEntry) {
        log.removeAll { $0.submissionId == entry.submissionId }
        log.insert(entry, at: 0)
        if log.count > 50 { log.removeLast(log.count - 50) }
        saveArchive()
    }

    func setDrift(_ changes: [String: [String]], checkedAt: Date?, error: String?) {
        drift = changes
        driftCheckedAt = checkedAt
        driftError = error
    }

    // MARK: Persistence

    private struct Live: Codable {
        var schemaVersion: String
        var includeCollab: Bool
        var dayIndex: Int
        var slotIndex: [String: Int]
        var counts: [String: [String: Int]]
        var done: [String]
        var walkIndex: Int
    }

    private struct Archive: Codable {
        var outbox: [Queued]
        var log: [LogEntry]
    }

    /// Synchronous, on every tap. See the type comment.
    private func saveLive() {
        let live = Live(
            schemaVersion: HeadcountConfig.schemaVersion,
            includeCollab: includeCollab,
            dayIndex: dayIndex,
            slotIndex: slotIndex,
            counts: counts,
            done: Array(done),
            walkIndex: walkIndex
        )
        guard let data = try? JSONEncoder().encode(live) else { persistenceFailed = true; return }
        defaults.set(data, forKey: Self.liveKey)
        persistenceFailed = false
    }

    /// Returns true when a live round was restored.
    ///
    /// A record written against a different pinned schema is discarded rather than migrated: the
    /// counts are keyed by Google field id, and if those changed, a "restored" round would put
    /// yesterday's numbers in today's columns. A half-read count is worse than a discarded one.
    private func loadLive() -> Bool {
        for f in HeadcountConfig.forms where counts[f.id] == nil {
            counts[f.id] = HeadcountLogic.emptyCounts(f)
        }
        guard let data = defaults.data(forKey: Self.liveKey),
              let live = try? JSONDecoder().decode(Live.self, from: data),
              live.schemaVersion == HeadcountConfig.schemaVersion
        else { return false }

        includeCollab = live.includeCollab
        dayIndex = live.dayIndex
        slotIndex = live.slotIndex
        counts = live.counts
        done = Set(live.done)
        walkIndex = live.walkIndex
        for f in HeadcountConfig.forms where counts[f.id] == nil {
            counts[f.id] = HeadcountLogic.emptyCounts(f)
        }
        clampWalkIndex()

        // An all-zero round is not worth interrupting anyone about.
        return grandTotal > 0
    }

    private func saveArchive() {
        guard let data = try? JSONEncoder().encode(Archive(outbox: outbox, log: log)) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }

    private func loadArchive() {
        guard let data = try? Data(contentsOf: fileURL),
              let a = try? JSONDecoder().decode(Archive.self, from: data)
        else { return }
        outbox = a.outbox
        log = a.log
    }
}
