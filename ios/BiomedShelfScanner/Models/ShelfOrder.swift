import Foundation

/// Shelf reading: is this row of books in the right order, and does each one belong on this face?
///
/// Mirrored by `ios/Tools/shelforder.js`, which is the model the offline tests reason about.
/// Keep the two in lockstep — this is the one feature whose failures accuse a real book of being
/// in the wrong place, and a librarian sent to reshelve a correctly-shelved book learns to
/// distrust every red box after it.
///
/// ## Why this type exists rather than a few more methods on `CallNumber`
///
/// `CallNumber.compare` cannot order volumes, and a Biomed serials face is mostly one title with
/// many bound volumes. Measured against the shipping comparator:
///
/// ```
/// "W1 NA388 NO.9"  vs "W1 NA388 NO.10"  ->  1   (want -1)
/// "W1 NA388 NO.66" vs "W1 NA388 NO.7"   -> -1   (want  1)
/// "W1 NA388 V.9"   vs "W1 NA388 V.10"   ->  1   (want -1)
/// ```
///
/// Two causes, one per spelling. `NO.66` fails `CallNumber.cutterToken` (the dot), falls through
/// to the catch-all branch, and is compared as a **lexical string** — so `NO.10` sorts before
/// `NO.9`. And when OCR drops the dot, `NO66` *does* match, becomes a **decimal cutter** `0.66`,
/// and sorts before `NO7` = `0.7`. All three spellings a label can produce — `NO.66`, `NO66`,
/// `NO 66` — are wrong, and they are wrong differently.
///
/// Running a serials shelf through a longest-subsequence check with that comparator flags most of
/// the shelf. So trailers are parsed out here and compared as integers.
///
/// **`CallNumber` and `Router` are deliberately untouched.** Routing rests on that comparator and
/// it is golden-tested against 651 endpoints; exactly one of them (`W4C Z89P 2009`) even carries a
/// trailer, so there is nothing to gain there and a working router to lose.
enum ShelfOrder {

    // MARK: - Keys

    /// A trailing volume or year token — the part `CallNumber` cannot order.
    struct Trailer: Equatable {
        /// Only consulted when two spines carry different trailer kinds in the same position,
        /// which is a mixed-shelf fallback rather than a real ordering claim. It still has to be
        /// deterministic, because Swift and the JS twin must agree on every pair.
        enum Kind: Int, Equatable {
            case number = 0   // no.66
            case volume = 1   // v.3
            case part = 2     // pt.2
            case year = 3     // 1984
            case other = 4
        }

        let kind: Kind
        let value: Int
        let suffix: String
    }

    /// A call number split into the part `CallNumber` orders well and the part it does not.
    struct ShelfKey: Equatable {
        let base: CallNumber
        let trailers: [Trailer]
        let raw: String
    }

    private static let trailForm = try! NSRegularExpression(
        pattern: "^(NO\\.?\\d+[A-Z]?|(18|19|20)\\d{2}[A-Z]?|V\\.?\\d+|PT\\.?\\d+)$")
    private static let cutterDot = try! NSRegularExpression(pattern: "\\.(?=[A-Z])")
    private static let noForm = try! NSRegularExpression(pattern: "^NO\\.?(\\d+)([A-Z]?)$")
    private static let vForm = try! NSRegularExpression(pattern: "^V\\.?(\\d+)$")
    private static let ptForm = try! NSRegularExpression(pattern: "^PT\\.?(\\d+)$")
    private static let yearForm = try! NSRegularExpression(pattern: "^((18|19|20)\\d{2})([A-Z]?)$")

    private static func parseTrailer(_ t: String) -> Trailer {
        if let m = noForm.firstMatch(in: t, range: t.nsRange) {
            return Trailer(kind: .number, value: Int(m.group(1, in: t) ?? "") ?? 0,
                           suffix: m.group(2, in: t) ?? "")
        }
        if let m = vForm.firstMatch(in: t, range: t.nsRange) {
            return Trailer(kind: .volume, value: Int(m.group(1, in: t) ?? "") ?? 0, suffix: "")
        }
        if let m = ptForm.firstMatch(in: t, range: t.nsRange) {
            return Trailer(kind: .part, value: Int(m.group(1, in: t) ?? "") ?? 0, suffix: "")
        }
        if let m = yearForm.firstMatch(in: t, range: t.nsRange) {
            return Trailer(kind: .year, value: Int(m.group(1, in: t) ?? "") ?? 0,
                           suffix: m.group(3, in: t) ?? "")
        }
        return Trailer(kind: .other, value: 0, suffix: t)
    }

    /// Split a call number into an ordering base and its trailing volume/year tokens.
    ///
    /// Tokenizing matches `CallNumber.isWellFormed` exactly — uppercase, a dot before a letter
    /// becomes a space — so the grammar and the comparator cannot disagree about where a token
    /// starts.
    static func key(_ input: String) -> ShelfKey? {
        var s = input.uppercased().replacingOccurrences(of: "*", with: "")
        s = cutterDot.stringByReplacingMatches(in: s, range: s.nsRange, withTemplate: " ")
        // "NO 66" is the third spelling OCR produces and it arrives as two tokens. Rejoin it
        // before anything else looks at the list, using the grammar's own helper so the two
        // cannot disagree about what a token is.
        var toks = CallNumber.joinVolumeTokens(s.split(whereSeparator: \.isWhitespace).map(String.init))
        guard !toks.isEmpty else { return nil }

        // Trailers are a suffix run, never the whole call number, and — the part a token count
        // cannot express — never the *cutter*. `trailForm` cannot tell a volume from a cutter,
        // because nothing about the token says which it is: `V3315` and `NO52` are legal as
        // either, and only the position they sit in decides.
        //
        // The old floor of 2 read that position by counting, which is right for `W1 NA388` (a
        // one-token class) and wrong for every NLM number, whose class is two tokens. `WK 835
        // V3315` is a real range endpoint; its cutter was stripped and re-compared as the integer
        // 3315, which sorts after `V44` where the shelf puts .3315 before .44. A correctly shelved
        // row of them was reported as a volume break — the failure this type's header calls the
        // one that must never happen.
        //
        // Asking the grammar where the class ends gives the cutter its own token, and only what
        // follows the cutter can be a trailer.
        let cls = CallNumber.classTokenCount(toks)
        let floor = cls < 0 ? 2 : cls + 1                  // class + cutter, kept out of reach
        var trailers: [Trailer] = []
        while toks.count > floor, let last = toks.last,
              trailForm.firstMatch(in: last, range: last.nsRange) != nil {
            trailers.insert(parseTrailer(last), at: 0)
            toks.removeLast()
        }

        guard let base = CallNumber.parse(toks.joined(separator: " ")) else { return nil }
        return ShelfKey(base: base, trailers: trailers, raw: input)
    }

    // MARK: - Ordering

    private static func compare(_ a: Trailer?, _ b: Trailer?) -> Int {
        // A missing trailer sorts first: "W1 NA388" precedes "W1 NA388 no.66", matching
        // `CallNumber.compareSegment`.
        guard let a else { return b == nil ? 0 : -1 }
        guard let b else { return 1 }
        if a.kind != b.kind { return a.kind.rawValue < b.kind.rawValue ? -1 : 1 }
        if a.value != b.value { return a.value < b.value ? -1 : 1 }
        if a.suffix != b.suffix { return a.suffix < b.suffix ? -1 : 1 }
        return 0
    }

    /// -1 / 0 / 1, the shelf order of two keys.
    static func compare(_ a: ShelfKey, _ b: ShelfKey) -> Int {
        let c = CallNumber.compare(a.base, b.base)
        if c != 0 { return c }
        let n = max(a.trailers.count, b.trailers.count)
        for i in 0..<n {
            let t = compare(i < a.trailers.count ? a.trailers[i] : nil,
                            i < b.trailers.count ? b.trailers[i] : nil)
            if t != 0 { return t }
        }
        return 0
    }

    /// Whether two keys are the same serial run — same class, same cutter, trailers aside.
    static func sameRun(_ a: ShelfKey, _ b: ShelfKey) -> Bool {
        CallNumber.compare(a.base, b.base) == 0
    }

    /// Whether two keys carry the same *shape* of trailer, so comparing them means anything.
    /// Without this, `no.66` gets compared against a bare year and the answer is noise.
    static func sameTrailerShape(_ a: ShelfKey, _ b: ShelfKey) -> Bool {
        a.trailers.count == b.trailers.count
            && zip(a.trailers, b.trailers).allSatisfy { $0.kind == $1.kind }
    }

    /// Indices of one longest non-decreasing subsequence, by patience sorting. O(n log n).
    ///
    /// Non-*de*creasing rather than strictly increasing, because duplicate copies of a book sit
    /// side by side legitimately and must not read as a misfile.
    ///
    /// Why a subsequence rather than adjacent-pair comparison: pairwise mis-blames. In
    /// `A B F D E` the pair (F, D) is out of order, which accuses D exactly as loudly as it
    /// accuses F. The subsequence is `A B D E`, so the one book outside it — F — is the one that
    /// moved.
    static func longestNonDecreasing(_ keys: [ShelfKey]) -> Set<Int> {
        var tails: [Int] = []                                   // tails[l] = index of the smallest tail of a run of length l+1
        var prev = [Int](repeating: -1, count: keys.count)
        for i in keys.indices {
            var lo = 0, hi = tails.count
            while lo < hi {                                     // upper bound: first tail strictly greater than keys[i]
                let mid = (lo + hi) / 2
                if compare(keys[tails[mid]], keys[i]) <= 0 { lo = mid + 1 } else { hi = mid }
            }
            prev[i] = lo > 0 ? tails[lo - 1] : -1
            if lo < tails.count { tails[lo] = i } else { tails.append(i) }
        }
        var out: Set<Int> = []
        var k = tails.last ?? -1
        while k >= 0 { out.insert(k); k = prev[k] }
        return out
    }

    // MARK: - Verdicts

    /// One shelf face, as `Router` names them.
    struct Face: Equatable, Hashable {
        let level: Int
        let shelfID: String
        let side: String

        init(level: Int, shelfID: String, side: String) {
            self.level = level
            self.shelfID = shelfID
            self.side = side
        }

        init(_ hit: Router.Hit) {
            self.init(level: hit.level, shelfID: hit.shelfID, side: hit.side)
        }
    }

    /// One spine as the judge sees it. No geometry: grouping has already decided which tokens
    /// belong to which book and whether that decision was safe.
    struct Spine {
        let callNumber: String?
        /// False when a read could not be attributed to one physical book — a side-face label
        /// between two labelled spines. See `SpineGrouping`.
        let anchored: Bool
        /// True for the first and last column in frame, whose true neighbour is off-screen.
        let edge: Bool

        init(callNumber: String?, anchored: Bool = true, edge: Bool = false) {
            self.callNumber = callNumber
            self.anchored = anchored
            self.edge = edge
        }
    }

    enum Verdict: Equatable {
        case ok
        case outOfOrder(after: String, before: String)
        case wrongShelf(belongs: Face)
        case volumeBreak(after: String, before: String)
        /// No label, unreadable, or off-scheme. Excluded from judging rather than guessed at.
        case unknown
        /// Read, but not attributable to one physical book. Shown, counted, never accused.
        case unanchored

        var isMisfile: Bool {
            switch self {
            case .outOfOrder, .wrongShelf, .volumeBreak: return true
            case .ok, .unknown, .unanchored: return false
            }
        }
    }

    /// Two books cannot tell you which of them is the one that moved.
    static let minSpines = 3

    /// Per-spine verdicts for one frame. Pure: no camera, no Vision, no temporal state — stability
    /// is `SpineTracker`'s job, not this function's.
    ///
    /// - Parameters:
    ///   - spines: in shelf order (left to right, or top to bottom for a flat stack).
    ///   - expected: the face the reader is standing at, or nil to skip wrong-shelf checking.
    ///   - search: every face containing a call number. Pass `Router.search`; taken as a closure
    ///     so this stays testable without a dataset.
    static func judge(_ spines: [Spine],
                      expected: Face?,
                      search: ((CallNumber) -> [Face])? = nil) -> [Verdict] {
        var out = [Verdict](repeating: .ok, count: spines.count)
        var keys = [ShelfKey?](repeating: nil, count: spines.count)

        // 1. Who is even eligible to be judged.
        var readable: [Int] = []
        for i in spines.indices {
            let sp = spines[i]
            if !sp.anchored { out[i] = .unanchored; continue }
            guard let text = sp.callNumber,
                  let cn = CallNumber.parse(text), cn.isWellFormed,
                  let k = key(text)
            else { out[i] = .unknown; continue }
            keys[i] = k
            readable.append(i)
        }

        // 2. Cross-scheme comparison is meaningless — `Router` gates on it — so a lone NLM book on
        //    a W1 shelf is excluded rather than declared a misfile. The comparator has nothing to
        //    say about it, and saying nothing is the honest answer.
        if !readable.isEmpty {
            var tally: [Int: Int] = [:]
            for i in readable { tally[schemeRank(keys[i]!), default: 0] += 1 }
            let modal = tally.max { a, b in a.value != b.value ? a.value < b.value : a.key > b.key }!.key
            for i in readable.reversed() where schemeRank(keys[i]!) != modal {
                out[i] = .unknown
                keys[i] = nil
                readable.removeAll { $0 == i }
            }
        }

        // 3. Class (b), wrong shelf. Needs no neighbours and no ordering, so unlike the order
        //    verdicts it applies at the frame edges too — a half-cropped spine still knows what
        //    floor it is on.
        //
        //    `search`, not `locate`: `locate` returns only the lowest containing face, and 237 of
        //    651 endpoints sit on a seam contained by two faces (see `Router.locate` vs
        //    `Router.search`, Router.swift:178-189), so judging with it would flag whole serial
        //    runs as misfiled. An empty result is `.unknown`, never `.wrongShelf` — Reference and
        //    unmapped stacks exist and this app does not know about them.
        if let expected, let search {
            for i in readable {
                let faces = search(keys[i]!.base)
                guard let first = faces.first else { continue }
                if !faces.contains(expected) { out[i] = .wrongShelf(belongs: first) }
            }
        }

        // 4. Classes (a) and (c), order within the shelf.
        guard readable.count >= minSpines else { return out }
        let seq = readable.map { keys[$0]! }
        let lis = longestNonDecreasing(seq)

        for j in seq.indices where !lis.contains(j) {
            let i = readable[j]
            if case .wrongShelf = out[i] { continue }   // carry it away beats move it a slot

            // The true neighbour of the first or last readable book is off-frame, and a shelf
            // boundary is indistinguishable from a misfile. Same for a column at the edge of the
            // frame, which is also physically half-cropped.
            if j == 0 || j == seq.count - 1 { continue }
            if spines[i].edge { continue }

            // Anchored-interval test. `l` and `r` are the nearest books we have positive evidence
            // are in the right place; flag only if this one does not belong between them. This is
            // what stops `A B F D E` from accusing D as well as F.
            var l = j - 1; while l >= 0 && !lis.contains(l) { l -= 1 }
            var r = j + 1; while r < seq.count && !lis.contains(r) { r += 1 }
            guard l >= 0, r < seq.count else { continue }
            let left = seq[l], right = seq[r], me = seq[j]
            if compare(me, left) >= 0 && compare(me, right) <= 0 { continue }

            // A trailer *kind* mismatch inside one run is not evidence of anything. `Kind` is
            // ranked to keep the order total, not to claim that every `no.3` precedes every
            // `1984`, and within a run the spelling varies spine by spine for reasons that have
            // nothing to do with where the book sits: OCR resolves the volume line on one label
            // and only the year on its neighbour. Ranking those against each other put a
            // correctly shelved book outside the subsequence and then accused it — as
            // `.outOfOrder`, the verdict that says carry it away, because `sameTrailerShape`
            // failed and the softer `.volumeBreak` branch below was never reached. The guard
            // written to soften the message was escalating it.
            //
            // Scoped to one run on purpose: when the base differs the book really is from another
            // title, and that misfile is still flagged.
            if sameRun(me, left), sameRun(me, right),
               !(sameTrailerShape(me, left) && sameTrailerShape(me, right)) { continue }

            // (c) rather than (a) when the whole neighbourhood is one serial run and only the
            // volume sequence broke. Same detection, different message and different action: a
            // volume break means the book is on the right face in the wrong slot, not that it
            // should be carried away.
            let volume = !me.trailers.isEmpty
                && sameRun(me, left) && sameRun(me, right)
                && sameTrailerShape(me, left) && sameTrailerShape(me, right)
            out[i] = volume
                ? .volumeBreak(after: left.raw, before: right.raw)
                : .outOfOrder(after: left.raw, before: right.raw)
        }

        return out
    }

    private static func schemeRank(_ k: ShelfKey) -> Int {
        k.base.scheme == .w1 ? 0 : 1
    }

    // MARK: - Which shelf am I standing at

    struct FaceGuess: Equatable {
        let face: Face
        let agree: Int
        let of: Int
    }

    /// The face most of these books agree on, or nil.
    ///
    /// Asking the reader to pick a face before every shelf is a setup tax nobody pays twice, and
    /// the inference is the detector anyway: if seven books say L2 / top-5 / right and one says
    /// L4, the odd one out is the misfile. Each book votes once per face it could be on, so a book
    /// sitting on a seam does not out-vote a book that is only on one face.
    static func inferFace(_ callNumbers: [String?],
                          search: (CallNumber) -> [Face],
                          minSpines: Int = 3,
                          minAgreement: Double = 0.6) -> FaceGuess? {
        let readable = callNumbers.compactMap { text -> CallNumber? in
            guard let text, let cn = CallNumber.parse(text), cn.isWellFormed else { return nil }
            return cn
        }
        guard readable.count >= minSpines else { return nil }

        var tally: [Face: Int] = [:]
        for cn in readable {
            for f in search(cn) { tally[f, default: 0] += 1 }
        }
        guard let best = tally.max(by: { a, b in
            a.value != b.value ? a.value < b.value : sortsAfter(a.key, b.key)
        }) else { return nil }

        guard Double(best.value) / Double(readable.count) >= minAgreement else { return nil }
        return FaceGuess(face: best.key, agree: best.value, of: readable.count)
    }

    /// Ties broken by face key, so the same shelf always infers the same way. `Dictionary`
    /// iteration order is randomized per launch, and without this a two-way tie would pick a
    /// different face every time the app started.
    private static func sortsAfter(_ a: Face, _ b: Face) -> Bool {
        let ka = "\(a.level)|\(a.shelfID)|\(a.side)"
        let kb = "\(b.level)|\(b.shelfID)|\(b.side)"
        return ka > kb
    }
}

// MARK: - Regex ergonomics

private extension String {
    var nsRange: NSRange { NSRange(startIndex..., in: self) }
}

private extension NSTextCheckingResult {
    func group(_ i: Int, in s: String) -> String? {
        guard i < numberOfRanges, let r = Range(range(at: i), in: s) else { return nil }
        return String(s[r])
    }
}

private extension NSRegularExpression {
    func firstMatch(in s: String, range: NSRange) -> NSTextCheckingResult? {
        firstMatch(in: s, options: [], range: range)
    }
    func stringByReplacingMatches(in s: String, range: NSRange, withTemplate t: String) -> String {
        stringByReplacingMatches(in: s, options: [], range: range, withTemplate: t)
    }
}
