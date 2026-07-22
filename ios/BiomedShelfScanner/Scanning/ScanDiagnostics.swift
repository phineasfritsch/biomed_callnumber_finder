import Foundation
import UIKit

/// Records what Vision actually saw, so recognition can be tuned **off-device**.
///
/// ## Why this exists
///
/// The build loop for this project is slow — a cloud Mac can't accept a USB-connected iPhone, so
/// every change is archive → upload → wait → install, on the order of ten minutes. Tuning the
/// grammar or the extraction regex against that loop would be miserable and you'd give up before
/// it was right.
///
/// So: capture once, tune many times. One scanning session in the stacks records every raw Vision
/// candidate; export the JSON; replay it against `ios/Tools/replay.js` on any machine. The
/// recognizer is pure logic (`extract → parse → isWellFormed → locate`), so a replay is exact, not
/// approximate. Dozens of tuning iterations, zero deploys.
///
/// This is off by default and gated behind a settings toggle: it holds frames in memory and is a
/// developer tool, not a feature.
@Observable
@MainActor
final class ScanDiagnostics {

    static let shared = ScanDiagnostics()

    /// Persisted so a capture session survives an app restart mid-shelf.
    var isRecording: Bool {
        didSet { UserDefaults.standard.set(isRecording, forKey: Self.key) }
    }
    private static let key = "diagnostics.recording"

    /// Ring buffer. 500 records ≈ a long session and stays well under a megabyte of JSON.
    private(set) var records: [Record] = []
    private let limit = 500

    /// Frames worth looking at with human eyes — the ones where Vision returned nothing, or
    /// returned something the pipeline rejected. If a label fails, the raw text tells you whether
    /// the problem is *Vision not reading it* (a camera/ROI/lighting problem) or *the pipeline
    /// rejecting a good read* (a grammar problem). Those need completely different fixes and are
    /// indistinguishable from the JSON alone.
    private(set) var failureFrames: [UUID: Data] = [:]
    private let frameLimit = 40

    private init() {
        isRecording = UserDefaults.standard.bool(forKey: Self.key)
    }

    struct Candidate: Codable {
        let text: String
        let confidence: Float
    }

    struct Record: Codable, Identifiable {
        let id: UUID
        let at: Date
        /// Verbatim `topCandidates(5)` — the ground truth for replay.
        let candidates: [Candidate]
        /// What `CallNumberRecognizer.extract` pulled out.
        let extracted: [String]
        /// "located" | "unlocated" | "none"
        let outcome: String
        let callNumber: String?
        let level: Int?
        let shelfID: String?
        let side: String?
        /// True once the stability voter committed this read to the trip.
        var accepted: Bool
        /// Set by hand during review — the correct answer, if the app got it wrong. Replay uses
        /// this to score. Left nil for records that were right.
        var expected: String?
        let hasFrame: Bool
    }

    func record(
        candidates: [(text: String, confidence: Float)],
        extracted: [String],
        result: CallNumberRecognizer.Result?,
        accepted: Bool,
        frame: Data?
    ) {
        guard isRecording else { return }

        let id = UUID()
        let outcome: String
        var cn: String?
        var level: Int?
        var shelf: String?
        var side: String?

        switch result {
        case let .located(c, hit):
            outcome = "located"; cn = c.raw; level = hit.level; shelf = hit.shelfID; side = hit.side
        case let .unlocated(c):
            outcome = "unlocated"; cn = c.raw
        case nil:
            outcome = "none"
        }

        if let frame, failureFrames.count < frameLimit, outcome != "located" {
            failureFrames[id] = frame
        }

        records.append(Record(
            id: id, at: .now,
            candidates: candidates.map { Candidate(text: $0.text, confidence: $0.confidence) },
            extracted: extracted,
            outcome: outcome,
            callNumber: cn, level: level, shelfID: shelf, side: side,
            accepted: accepted,
            expected: nil,
            hasFrame: failureFrames[id] != nil
        ))

        if records.count > limit { records.removeFirst(records.count - limit) }
    }

    func clear() {
        records.removeAll()
        failureFrames.removeAll()
    }

    // MARK: Export

    /// Writes `scan-corpus-<date>.json` plus any failure frames into a folder in the temp
    /// directory, and returns the URLs to hand to a share sheet.
    ///
    /// AirDrop it to yourself, or mail it — either way it lands on a machine with a text editor
    /// and Node, which is all the replay tool needs.
    func export() throws -> [URL] {
        let stamp = ISO8601DateFormatter().string(from: .now)
            .replacingOccurrences(of: ":", with: "-")
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("scan-corpus-\(stamp)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let json = try encoder.encode(records)
        let jsonURL = dir.appendingPathComponent("corpus.json")
        try json.write(to: jsonURL)

        var urls = [jsonURL]
        for (id, data) in failureFrames {
            let url = dir.appendingPathComponent("\(id.uuidString).jpg")
            try? data.write(to: url)
            urls.append(url)
        }
        return urls
    }

    var summary: String {
        guard !records.isEmpty else { return "Nothing recorded yet." }
        let located = records.filter { $0.outcome == "located" }.count
        let unlocated = records.filter { $0.outcome == "unlocated" }.count
        let none = records.filter { $0.outcome == "none" }.count
        return "\(records.count) frames · \(located) located · \(unlocated) unlocated · \(none) no match"
    }
}
