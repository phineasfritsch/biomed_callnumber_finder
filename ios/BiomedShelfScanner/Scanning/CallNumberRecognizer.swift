import Foundation

/// Turns raw OCR candidate strings into a resolved call number.
///
/// This is the heart of the scanner and it is **pure logic** — no Vision, no camera. It can be
/// unit-tested on any machine and mocked while building the UI.
///
/// ## Why this works: constrained decoding
///
/// We are not doing open-ended transcription. Vision returns *ranked* candidates and has no idea
/// what a call number is; we do. So we walk the ranked list and take the best candidate that obeys
/// real call-number notation and lands on a real shelf. If Vision's top read is `W1 NA3B8` but its
/// third is `W1 NA388`, the grammar rejects the first and we get the truth for free.
///
/// ## The trap: "it locates" is NOT a validity check
///
/// Shelf ranges are broad intervals, so almost any string falls inside *some* range —
/// `W1 ZZZ999` resolves happily to L1 top-14. Worse, `W1 NA3B8` resolves to a *different, wrong
/// shelf* than `W1 NA388`, and `WI NA388` (a 1→I slip) flips scheme and lands on Level 9. Gating
/// on range containment alone would confidently walk you to the wrong floor.
///
/// `CallNumber.isWellFormed` is the real gate. Containment only says *where* a call number goes.
struct CallNumberRecognizer {

    let router: Router

    /// Vision's own confidence floor for a candidate. Below this we don't even consider it.
    var minConfidence: Float = 0.4

    enum Result {
        /// Well-formed and inside a mapped range. The only case safe to auto-accept.
        case located(CallNumber, Router.Hit)
        /// Well-formed but outside every mapped range — Reference (Floor 4), or unmapped stacks.
        /// Surfaced to the human rather than silently dropped.
        case unlocated(CallNumber)
    }

    // MARK: Extraction

    private static let callNumberPatterns: [NSRegularExpression] = {
        // Optional volume ("no.66") and year, so stacked labels assemble fully.
        let vol = "(?:\\s+NO\\.?\\s?\\d+[A-Z]?)?(?:\\s+(?:18|19|20)\\d{2}[A-Z]?)?"

        // `(?![A-Z0-9])` is load-bearing, not defensive tidiness.
        //
        // Without it these patterns match a *prefix* and stop mid-token: `W1 NA3B8` yields
        // `W1 NA3B`, silently dropping the trailing 8. That laundered a corrupt read into a
        // well-formed one, so `isWellFormed` never saw the corruption and the grammar gate — the
        // whole defense (§3.3) — was bypassed by its own input stage. Anchoring the match forces
        // `NA3B8` to fail extraction entirely, which is what lets the next-ranked candidate win.
        //
        // The A1 alternative is required because `W1 A1C7` is real and is genuinely
        // letters-digits-letters-digits; the general form has to stay closed or `NA3B8` gets back in.
        return [
            // W1 serials: "W1 NA388 no.66 1984", "W1 A1C7", "W1 CA756TA"
            "\\bW[1-4][A-Z]{0,2}\\s*(?:A1[A-Z]\\d{1,4}|[A-Z]{1,3}\\s?\\d{1,4})[A-Z]{0,2}(?![A-Z0-9])" + vol,
            // NLM / LC: "WM 13 D5537", "QL737.C22". `[\s.]+` so the dot-separated LC form is
            // reachable at all — the web app's equivalent pattern required whitespace and so
            // never actually matched "QL737.C22" despite claiming to.
            "\\b[A-Z]{1,3}\\s?\\d{1,4}(?:\\.\\d+)?[\\s.]+\\.?[A-Z]{1,3}\\d{1,5}[A-Z]{0,2}(?![A-Z0-9])" + vol,
        ].map { try! NSRegularExpression(pattern: $0) }
    }()

    /// Pull every call-number-shaped substring out of an OCR line.
    ///
    /// Spine labels are stacked one token per line ("W1 / NA388 / no.66 / 1984"), so newlines
    /// collapse to spaces before matching — otherwise the volume and year get orphaned.
    /// "Biomed" is the collection prefix, not part of the call number.
    static func extract(from text: String) -> [String] {
        var s = text.uppercased()
        s = s.replacingOccurrences(of: "\\bBIOMED\\b", with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: "[|=_]+", with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: "[^A-Z0-9. ]", with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        s = " " + s.trimmingCharacters(in: .whitespaces) + " "

        // Deduped: the W1 and NLM patterns both match a string like "W1 NA388", and callers that
        // iterate every hit (the request-sheet importer) would otherwise see it twice.
        var out: [String] = []
        var seen = Set<String>()
        let range = NSRange(s.startIndex..., in: s)
        for rx in callNumberPatterns {
            rx.enumerateMatches(in: s, range: range) { m, _, _ in
                guard let m, let r = Range(m.range, in: s) else { return }
                let hit = String(s[r])
                    .trimmingCharacters(in: .whitespaces)
                    .replacingOccurrences(of: "[ .]+$", with: "", options: .regularExpression)
                if !hit.isEmpty, seen.insert(hit).inserted { out.append(hit) }
            }
        }
        return out
    }

    // MARK: Resolution

    /// Resolve ranked OCR candidates into a single answer.
    ///
    /// Pass `observation.topCandidates(5)` here — **not** just the top candidate. Walking the
    /// ranked list and taking the first *well-formed* read is what makes this better than plain
    /// OCR, and it costs nothing.
    ///
    /// Returns nil when no candidate is a plausible call number at all (a book title, a shelf
    /// label, a stray number) — the overwhelmingly common case, since most of what the camera
    /// sees is not a call number.
    func resolve(candidates: [(text: String, confidence: Float)]) -> Result? {
        for candidate in candidates where candidate.confidence >= minConfidence {
            for text in Self.extract(from: candidate.text) {
                guard let cn = CallNumber.parse(text), cn.isWellFormed else { continue }
                if let hit = router.locate(cn) { return .located(cn, hit) }
                return .unlocated(cn)
            }
        }
        return nil
    }

    /// Convenience for callers that don't carry confidence (tests, mocks).
    func resolve(candidates: [String]) -> Result? {
        resolve(candidates: candidates.map { ($0, 1.0) })
    }
}

// MARK: - On character repair (deliberately absent)
//
// An earlier design substituted confusable glyphs (O↔0, B↔8, S↔5 …) and accepted a variant if it
// landed in a shelf range. Measuring it against the live dataset killed the idea twice over:
//
//  1. It never fires when it matters. `W1 NA3B8` *already* locates — at the wrong shelf — so a
//     repair pass gated on "nothing located" is never even reached. The misread is silently
//     accepted with full confidence.
//  2. It cannot be made safe. Range containment doesn't discriminate: `W1 ZZZ999` locates too. A
//     repair loop scored on containment is just a machine for inventing plausible wrong shelves.
//
// The grammar gate (`CallNumber.isWellFormed`) solves the real problem instead — it rejects the
// malformed read so Vision's next-ranked candidate gets its turn. Anything the grammar cannot
// resolve belongs in front of a human, not in a substitution search.

// MARK: - Stability voting

/// Requires the same read across several consecutive frames before accepting it.
///
/// A single frame is never trustworthy — auto-accepting per-frame produces a flickering mess of
/// half-reads. Requiring agreement is what makes hands-free capture feel solid instead of jumpy.
final class StabilityVoter {

    private var votes: [String: Int] = [:]
    private var lastAccepted: [String: Date] = [:]

    /// Frames that must agree before we accept. 3 ≈ 0.3s at 10fps — fast enough to feel instant,
    /// slow enough to reject noise.
    var requiredVotes = 3

    /// Suppresses re-reads of the same physical book while it's still in frame. Scanning a
    /// *second copy* is handled upstream by the quantity stepper, not here.
    var cooldown: TimeInterval = 2.0

    func consider(_ key: String, now: Date = .now) -> Bool {
        if let last = lastAccepted[key], now.timeIntervalSince(last) < cooldown {
            return false
        }
        votes[key, default: 0] += 1
        guard votes[key]! >= requiredVotes else { return false }
        votes.removeAll()
        lastAccepted[key] = now
        return true
    }

    /// Call when the frame yields nothing — decays stale votes so a half-seen label from a
    /// previous book can't accumulate across a camera move.
    func miss() {
        votes.removeAll()
    }

    func reset() {
        votes.removeAll()
        lastAccepted.removeAll()
    }
}
