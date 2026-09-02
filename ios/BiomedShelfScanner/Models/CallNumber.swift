import Foundation

/// A parsed call number, comparable in shelf order.
///
/// Ported from the web locator's `parseCN` / `cmpSeg` / `cmpCN`. The ordering rules are subtle and
/// worth stating explicitly:
///
/// * **Cutter numbers sort as decimals.** `NA388` is `.388` and `NA1991` is `.1991`, so
///   `NA388 > NA1991`. This is standard Cutter notation and the single easiest thing to get wrong
///   in a port — a naive integer compare inverts these.
/// * **The biomedical serials prefix is opaque.** `W1`, `W2`, `W3`, `W4C` are kept whole so they
///   can never collide with NLM class `W` + number (e.g. `W 13` on floor 10), which is a
///   different classification namespace that happens to share the letter.
struct CallNumber: Equatable {
    let raw: String
    let segments: [Segment]

    enum Segment: Equatable {
        case alpha(String)
        case num(Double)
        case cutter(alpha: String, num: Double, suffix: String)

        /// Rank must match the JS type ordering, which compared the tag characters
        /// `"A"` < `"C"` < `"N"` lexically. Preserved here so ports stay bug-compatible.
        var rank: Int {
            switch self {
            case .alpha:  return 0
            case .cutter: return 1
            case .num:    return 2
            }
        }
    }

    enum Scheme {
        case w1   // biomedical serials prefix (W1–W4), floors 1–7
        case nlm  // everything else
    }

    var scheme: Scheme {
        Self.w1PrefixLeading.firstMatch(in: raw, range: raw.nsRange) != nil ? .w1 : .nlm
    }

    // MARK: - Parsing

    private static let w1PrefixLeading = try! NSRegularExpression(
        pattern: "^\\s*W[1-4]([A-Z]|\\b)", options: [.caseInsensitive])
    private static let w1PrefixWhole = try! NSRegularExpression(pattern: "^W[1-4][A-Z]{0,2}$")
    private static let cutterDot = try! NSRegularExpression(pattern: "\\.(?=[A-Z])")
    private static let classHead = try! NSRegularExpression(pattern: "^([A-Z]+)(\\d+\\.?\\d*)?(.*)$")
    private static let cutterToken = try! NSRegularExpression(pattern: "^([A-Z]+)(\\d*)([A-Z]*)$")
    private static let bareNumber = try! NSRegularExpression(pattern: "^\\d+\\.?\\d*$")

    init?(_ input: String) {
        var s = input.uppercased().replacingOccurrences(of: "*", with: "")
        // ".C22" -> " C22" (cutter dot). Leaves "102.8" alone — the lookahead requires a letter.
        s = Self.cutterDot.stringByReplacingMatches(
            in: s, range: s.nsRange, withTemplate: " ")

        let toks = s.split(whereSeparator: \.isWhitespace).map(String.init)
        guard let head = toks.first else { return nil }

        var classAlpha: String
        var classNum: Double = 0
        var rest = Array(toks.dropFirst())

        if Self.w1PrefixWhole.firstMatch(in: head, range: head.nsRange) != nil {
            classAlpha = head
        } else if let m = Self.classHead.firstMatch(in: head, range: head.nsRange) {
            classAlpha = m.group(1, in: head) ?? head
            if let n = m.group(2, in: head), let v = Double(n) { classNum = v }
            // Leftover jammed cutter, e.g. "QL737C22" -> "C22"
            if let leftover = m.group(3, in: head), !leftover.isEmpty { rest.insert(leftover, at: 0) }
            // Class number may instead be the next standalone token (NLM: "QL 737 C22")
            if classNum == 0, let next = rest.first,
               Self.bareNumber.firstMatch(in: next, range: next.nsRange) != nil,
               let v = Double(next) {
                classNum = v
                rest.removeFirst()
            }
        } else {
            classAlpha = head
        }

        var out: [Segment] = [.alpha(classAlpha), .num(classNum)]
        for t in rest {
            if let m = Self.cutterToken.firstMatch(in: t, range: t.nsRange) {
                let a = m.group(1, in: t) ?? t
                let digits = m.group(2, in: t) ?? ""
                // Decimal Cutter: "388" -> 0.388, so .388 > .1991 as required.
                let n = digits.isEmpty ? 0 : (Double("0." + digits) ?? 0)
                out.append(.cutter(alpha: a, num: n, suffix: m.group(3, in: t) ?? ""))
            } else {
                out.append(.cutter(alpha: t, num: 0, suffix: ""))
            }
        }

        self.raw = input
        self.segments = out
    }

    /// Convenience for call sites that read better as `CallNumber.parse(_:)`.
    static func parse(_ s: String) -> CallNumber? { CallNumber(s) }

    // MARK: - Well-formedness

    // A cutter is letters + digits + at most a 2-letter suffix: NA388, NE286DB, CA756TA.
    // Crucially it may NOT re-enter digits after the suffix — that's what rejects the OCR
    // misread "NA3B8" (NA + 3 + B + 8).
    //
    // `[1-9]\d*` rather than `\d+`: the digit run may not start with 0. Measured — 0 of the 906
    // range endpoints have one — and load-bearing, because "O" and "0" are indistinguishable on
    // these spine labels. Without it "W1 J0506" is well-formed, locates, and sends you to a
    // shelf the book is not on; with it the read is rejected and
    // `CallNumberRecognizer.restoringConfusableO` gets to offer "W1 JO506" instead. `JO` is a
    // 49-endpoint cutter block covering most of a floor, so this was not a rare failure.
    private static let cutterForm = try! NSRegularExpression(pattern: "^[A-Z]{1,3}[1-9]\\d*[A-Z]{0,2}$")
    // The NLM "A1" serial form is the only genuine jammed double cutter in this collection
    // (A1C7, A1C8, A1Q2). Whitelisted narrowly rather than by a general rule, because a general
    // "letters-digits-letters-digits" rule would also admit NA3B8.
    private static let a1Form = try! NSRegularExpression(pattern: "^A1[A-Z][1-9]\\d*[A-Z]{0,2}$")
    private static let trailForm = try! NSRegularExpression(
        pattern: "^(NO\\.?\\d+[A-Z]?|(18|19|20)\\d{2}[A-Z]?|V\\.?\\d+|PT\\.?\\d+)$")
    private static let classAlphaOnly = try! NSRegularExpression(pattern: "^[A-Z]{1,3}$")
    private static let classJammed = try! NSRegularExpression(pattern: "^[A-Z]{1,3}\\d+(\\.\\d+)?$")
    private static let bareClassNum = try! NSRegularExpression(pattern: "^\\d+(\\.\\d+)?$")
    private static let volumePrefix = try! NSRegularExpression(pattern: "^(NO|V|PT)\\.?$")
    private static let volumeDigits = try! NSRegularExpression(pattern: "^\\d+[A-Z]?$")

    /// Rejoin a volume token OCR handed over split: `["NO", "66"] -> ["NO66"]`.
    ///
    /// Not a hypothetical spelling. The extraction pattern allows the space, so
    /// `W1 NA388 NO 66` really does arrive, and every spelling of a volume token has to reach the
    /// comparator as one shape. `ShelfOrder.key` used to carry its own copy of this and
    /// `isWellFormed` had none, so the split spelling was a shape the comparator normalized and
    /// the grammar rejected — which made `ShelfOrder.judge` call an entire serials face unreadable.
    static func joinVolumeTokens(_ toks: [String]) -> [String] {
        var out: [String] = []
        var i = 0
        while i < toks.count {
            if volumePrefix.firstMatch(in: toks[i], range: toks[i].nsRange) != nil,
               i + 1 < toks.count,
               volumeDigits.firstMatch(in: toks[i + 1], range: toks[i + 1].nsRange) != nil {
                out.append(toks[i].replacingOccurrences(of: ".", with: "") + toks[i + 1])
                i += 2
            } else {
                out.append(toks[i])
                i += 1
            }
        }
        return out
    }

    /// How many leading tokens the class number occupies: `W1` -> 1, `WM 13` -> 2, `QL737` -> 1,
    /// and -1 when the head is not a class number at all.
    ///
    /// The three branches are `isWellFormed`'s own, so one place decides where the class ends and
    /// the cutter begins. `ShelfOrder.key` needs the same answer: it may strip trailers but never
    /// the cutter, and counting tokens could not tell the two apart.
    static func classTokenCount(_ toks: [String]) -> Int {
        guard let head = toks.first else { return -1 }
        if w1PrefixWhole.firstMatch(in: head, range: head.nsRange) != nil { return 1 }
        if classAlphaOnly.firstMatch(in: head, range: head.nsRange) != nil,
           toks.count > 1,
           bareClassNum.firstMatch(in: toks[1], range: toks[1].nsRange) != nil { return 2 }
        if classJammed.firstMatch(in: head, range: head.nsRange) != nil { return 1 }
        return -1
    }

    /// Whether the raw text obeys real call-number notation.
    ///
    /// **This is the validity gate — not `Router.locate`.** Shelf ranges are broad intervals, so
    /// nearly any string falls inside *some* range: `W1 ZZZ999` "locates" happily. Range
    /// containment tells you where a call number goes; it tells you nothing about whether the OCR
    /// read is real. Measured against the live dataset, this grammar accepts 644 of 651 real
    /// endpoints while rejecting the misreads that matter — including `WI NA388`, where a 1→I slip
    /// flips the scheme and would otherwise route you to the wrong floor entirely.
    ///
    /// It also rejects a cutter whose digits start with 0 (`W1 J0506`), which is how the O/0
    /// confusion is stopped from routing silently — see `cutterForm`.
    ///
    /// Known limits, both acceptable:
    /// * 7 genuinely odd real endpoints fail (`A`, `ZWZ 330`, `Q 41 R81R8`, `WX 27 GF7 P3R5D`,
    ///   `WC 160 G7.78T`, `BF 789 D4 6456s`). Those books need manual entry.
    /// * `NA38B` passes and is indistinguishable from a real cutter. Harmless in practice — the
    ///   digits are close enough that it lands on the same shelf face as `NA388`.
    var isWellFormed: Bool {
        let s = raw.uppercased()
            .replacingOccurrences(of: "\\.(?=[A-Z])", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        let toks = Self.joinVolumeTokens(s.split(whereSeparator: \.isWhitespace).map(String.init))

        func isCutter(_ t: String) -> Bool {
            Self.cutterForm.firstMatch(in: t, range: t.nsRange) != nil
                || Self.a1Form.firstMatch(in: t, range: t.nsRange) != nil
        }
        func isTrailer(_ t: String) -> Bool {
            Self.trailForm.firstMatch(in: t, range: t.nsRange) != nil
        }

        let cls = Self.classTokenCount(toks)                                // -1 rejects "WI NA388"
        guard cls >= 0 else { return false }
        let rest = Array(toks.dropFirst(cls))

        guard let first = rest.first, isCutter(first) else { return false }
        return rest.dropFirst().allSatisfy { isCutter($0) || isTrailer($0) }
    }
}

// MARK: - Ordering

extension CallNumber: Comparable {
    static func < (a: CallNumber, b: CallNumber) -> Bool { compare(a, b) < 0 }

    static func compare(_ a: CallNumber, _ b: CallNumber) -> Int {
        let n = max(a.segments.count, b.segments.count)
        for i in 0..<n {
            let x = i < a.segments.count ? a.segments[i] : nil
            let y = i < b.segments.count ? b.segments[i] : nil
            let c = compareSegment(x, y)
            if c != 0 { return c }
        }
        return 0
    }

    /// A missing segment sorts first — "W1 NA388" precedes "W1 NA388 no.66".
    private static func compareSegment(_ a: Segment?, _ b: Segment?) -> Int {
        guard let a else { return b == nil ? 0 : -1 }
        guard let b else { return 1 }
        if a.rank != b.rank { return a.rank < b.rank ? -1 : 1 }

        switch (a, b) {
        case let (.alpha(x), .alpha(y)):
            return x == y ? 0 : (x < y ? -1 : 1)
        case let (.num(x), .num(y)):
            return x == y ? 0 : (x < y ? -1 : 1)
        case let (.cutter(xa, xn, xs), .cutter(ya, yn, ys)):
            if xa != ya { return xa < ya ? -1 : 1 }
            if xn != yn { return xn < yn ? -1 : 1 }
            if xs != ys { return xs < ys ? -1 : 1 }
            return 0
        default:
            return 0  // unreachable: equal ranks imply equal cases
        }
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
