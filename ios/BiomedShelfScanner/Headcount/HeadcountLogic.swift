import Foundation

/// Pure logic. No UI, no storage, no networking.
///
/// Ported from `better_headcount/js/logic.js`, which is unit-tested in `tests/logic.test.js` and
/// is also what the Worker validates with. Everything in here is testable on any machine, and
/// `HeadcountLogicTests` checks it against golden vectors generated from that JavaScript — this
/// is the half that can be wrong silently, and "it looked right" is not a test.
enum HeadcountLogic {

    // MARK: Clock

    /// Device local time is not trusted. A phone left on Eastern time would misfile a whole round
    /// and nothing downstream would show it, so every calculation is done in an explicit zone.
    struct ZonedParts: Equatable {
        let weekday: String
        let dayIndex: Int
        let year: Int, month: Int, day: Int
        let hour: Int, minute: Int
        /// Minutes from midnight.
        let minutes: Int
        let dateKey: String
    }

    static func zonedParts(_ instant: Date, zone: TimeZone = HeadcountConfig.timeZone) -> ZonedParts {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute, .weekday], from: instant)
        let year = c.year ?? 0, month = c.month ?? 1, day = c.day ?? 1
        let hour = c.hour ?? 0, minute = c.minute ?? 0
        // Calendar.weekday is 1 = Sunday; DAYS is Monday-first, matching the Google Form's own
        // option order. Mapping through the option list rather than arithmetic on a locale.
        let sundayFirst = (c.weekday ?? 1) - 1
        let dayIndex = (sundayFirst + 6) % 7
        return ZonedParts(
            weekday: HeadcountConfig.days[dayIndex],
            dayIndex: dayIndex,
            year: year, month: month, day: day,
            hour: hour, minute: minute,
            minutes: hour * 60 + minute,
            dateKey: String(format: "%04d-%02d-%02d", year, month, day)
        )
    }

    /// Circular minute distance. Positive means the slot is ahead of now.
    private static func circularDelta(from: Int, to: Int) -> Int {
        var d = to - from
        if d > 720 { d -= 1440 }
        if d < -720 { d += 1440 }
        return d
    }

    struct Slot: Equatable {
        let index: Int
        /// The literal string this form stores. Always `form.times[index]`.
        let value: String
        /// Positive = the round is running late.
        let minutesLate: Int
        /// The nearest slot was on the other side of midnight.
        let wrapped: Bool
        let dayShift: Int
        let dayIndex: Int
        let dayValue: String
        let parts: ZonedParts
    }

    /// Nearest slot in **this form's** list. Per-mode by construction: the caller passes the
    /// form, and the lists are never shared or merged.
    ///
    /// Wrap is allowed — 00:20 belongs to the 11:00 PM round, not the 7:45 AM one — but it is
    /// reported, because a wrapped slot means the day of week is yesterday's and that is exactly
    /// the mistake worth surfacing rather than silently applying.
    static func snapSlot(_ instant: Date, form: HeadcountConfig.Form,
                         zone: TimeZone = HeadcountConfig.timeZone) -> Slot {
        let parts = zonedParts(instant, zone: zone)
        var best = 0, bestAbs = Int.max, bestDelta = 0
        for (i, m) in form.timeMinutes.enumerated() {
            let d = circularDelta(from: parts.minutes, to: m)
            if abs(d) < bestAbs { bestAbs = abs(d); best = i; bestDelta = d }
        }
        let wall = parts.minutes + bestDelta
        let dayShift = wall < 0 ? -1 : (wall >= 1440 ? 1 : 0)
        let dayIndex = (parts.dayIndex + dayShift + 7) % 7
        return Slot(
            index: best,
            value: form.times[best],
            minutesLate: -bestDelta,
            wrapped: dayShift != 0,
            dayShift: dayShift,
            dayIndex: dayIndex,
            dayValue: HeadcountConfig.days[dayIndex],
            parts: parts
        )
    }

    /// Device clock sanity. Warn, never silently correct.
    static func clockPlausible(_ instant: Date = .now) -> (ok: Bool, reason: String?) {
        if instant < HeadcountConfig.buildEpoch { return (false, "before-build") }
        if instant > HeadcountConfig.buildEpoch.addingTimeInterval(5 * 365 * 24 * 3600) {
            return (false, "far-future")
        }
        return (true, nil)
    }

    // MARK: Counts

    static func clamp(_ n: Int) -> Int {
        if n < 0 { return 0 }
        if n > HeadcountConfig.countMax { return HeadcountConfig.countMax }
        return n
    }

    static func emptyCounts(_ form: HeadcountConfig.Form) -> [String: Int] {
        Dictionary(uniqueKeysWithValues: form.counters.map { ($0.entry, 0) })
    }

    static func total(_ form: HeadcountConfig.Form, counts: [String: Int]) -> Int {
        form.counters.reduce(0) { $0 + clamp(counts[$1.entry] ?? 0) }
    }

    // MARK: The walk

    struct Stop: Identifiable, Hashable {
        let form: HeadcountConfig.Form
        let counter: HeadcountConfig.Counter
        var id: String { "\(form.id)|\(counter.entry)" }
    }

    /// The physical walking order across every form in the round.
    ///
    /// The first form lays down the route. Any other form is spliced in at its `walkAfter` stop —
    /// the Hub is reached off Stacks Level 6, so on a combined round it is counted there rather
    /// than appended to the end. A form with no `walkAfter`, or one whose anchor is missing, goes
    /// on the end rather than being dropped: a counter that vanishes from the route is a blank
    /// cell in the sheet.
    static func walkSequence(_ forms: [HeadcountConfig.Form]) -> [Stop] {
        guard let lead = forms.first else { return [] }
        var seq = lead.counters.map { Stop(form: lead, counter: $0) }
        for f in forms.dropFirst() {
            let stops = f.counters.map { Stop(form: f, counter: $0) }
            let at = f.walkAfter.flatMap { anchor in
                seq.firstIndex { $0.counter.entry == anchor }
            }
            if let at { seq.insert(contentsOf: stops, at: at + 1) } else { seq.append(contentsOf: stops) }
        }
        return seq
    }

    // MARK: Payload

    /// Exact entry key set for a form. Nothing more, nothing fewer.
    static func expectedKeys(_ form: HeadcountConfig.Form) -> [String] {
        [form.dayEntry, form.timeEntry] + form.counters.map(\.entry)
    }

    static func buildPayload(_ form: HeadcountConfig.Form,
                             day: String, time: String, counts: [String: Int]) -> [String: String] {
        var p: [String: String] = [form.dayEntry: day, form.timeEntry: time]
        for c in form.counters { p[c.entry] = String(clamp(counts[c.entry] ?? 0)) }
        return p
    }

    /// The last gate before dispatch. Every field on both forms is optional to Google, so a
    /// dropped key lands as a blank cell and is never noticed. A partial payload is never a
    /// convenience here; it is a permanent hole in the data.
    static func validate(_ form: HeadcountConfig.Form, payload: [String: String]) -> (ok: Bool, errors: [String]) {
        var errors: [String] = []
        let want = expectedKeys(form)

        for k in want where payload[k] == nil { errors.append("missing field \(k)") }
        for k in payload.keys.sorted() where !want.contains(k) { errors.append("unexpected field \(k)") }

        if let day = payload[form.dayEntry], !form.days.contains(day) {
            errors.append("day \"\(day)\" is not an option on this form")
        }
        if let time = payload[form.timeEntry], !form.times.contains(time) {
            errors.append("time \"\(time)\" is not an option on this form")
        }
        for c in form.counters {
            guard let raw = payload[c.entry] else { continue }
            guard !raw.isEmpty, raw.allSatisfy(\.isNumber), let n = Int(raw) else {
                errors.append("\(c.reportedName): \"\(raw)\" is not a non-negative integer")
                continue
            }
            if n > HeadcountConfig.countMax {
                errors.append("\(c.reportedName): \(n) exceeds \(HeadcountConfig.countMax)")
            }
        }
        return (errors.isEmpty, errors)
    }

    /// Human-readable dump, for typing a failed round into the form by hand.
    ///
    /// Field names exactly as the Google Form shows them, because this text exists to be read
    /// next to that form.
    static func payloadDump(_ form: HeadcountConfig.Form,
                            payload: [String: String], submissionId: String) -> String {
        func row(_ name: String, _ value: String?) -> String {
            name.padding(toLength: max(24, name.count), withPad: " ", startingAt: 0) + " " + (value ?? "")
        }
        var lines = [
            "form: \(form.label) (\(form.formId))",
            "submissionId: \(submissionId)",
            "viewform: \(form.viewform.absoluteString)",
            "",
            row("Day of the Week", payload[form.dayEntry]),
            row("Time", payload[form.timeEntry]),
        ]
        for c in form.counters { lines.append(row(c.reportedName, payload[c.entry])) }
        return lines.joined(separator: "\n")
    }

    /// Canonical, order-stable description of everything this client is pinned to.
    ///
    /// Uses the form's own question title, not the display label: renaming a stop in this UI must
    /// never read as the Google Form drifting.
    static func schemaFingerprint(_ form: HeadcountConfig.Form) -> String {
        let counters = form.counters
            .map { "[\(json($0.entry)),\(json($0.reportedName))]" }
            .joined(separator: ",")
        return "{\"formId\":\(json(form.formId)),"
            + "\"dayEntry\":\(json(form.dayEntry)),"
            + "\"timeEntry\":\(json(form.timeEntry)),"
            + "\"days\":[\(form.days.map(json).joined(separator: ","))],"
            + "\"times\":[\(form.times.map(json).joined(separator: ","))],"
            + "\"counters\":[\(counters)]}"
    }

    /// Minimal JSON string escaping, matching `JSON.stringify` for the characters these fields
    /// can contain. Hand-rolled because `JSONEncoder` does not promise key order and the
    /// fingerprint has to be byte-identical to the JavaScript's.
    private static func json(_ s: String) -> String {
        var out = "\""
        for ch in s.unicodeScalars {
            switch ch {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            default:
                if ch.value < 0x20 { out += String(format: "\\u%04x", ch.value) }
                else { out.unicodeScalars.append(ch) }
            }
        }
        return out + "\""
    }

    // MARK: Queue

    enum QueueState: String, Codable {
        case pending, sending, confirmed, failed
    }

    /// Legal transitions only. An illegal one returns nil rather than letting the state drift.
    static func queueTransition(_ state: QueueState, _ event: String) -> QueueState? {
        switch (state, event) {
        case (.pending, "send"):    return .sending
        case (.pending, "fail"):    return .failed
        case (.sending, "ok"):      return .confirmed
        case (.sending, "retry"):   return .pending
        case (.sending, "fail"):    return .failed
        case (.failed, "retry"):    return .pending
        default:                    return nil
        }
    }

    /// Exponential backoff with jitter, capped. `attempt` is 0-based.
    static func backoff(attempt: Int, random: () -> Double = { Double.random(in: 0..<1) }) -> TimeInterval {
        let base = min(30.0 * pow(2, Double(attempt)), 15 * 60)
        return (base * (0.7 + random() * 0.6)).rounded()
    }

    // MARK: Formatting

    static func formatAge(_ seconds: TimeInterval) -> String {
        if seconds < 60 { return "\(max(0, Int(seconds.rounded())))s" }
        if seconds < 3600 { return "\(Int((seconds / 60).rounded())) min" }
        let h = seconds / 3600
        if h < 48 { return h < 10 ? String(format: "%.1f hr", h) : "\(Int(h.rounded())) hr" }
        return "\(Int((h / 24).rounded())) days"
    }

    static func csv(_ rows: [[String: String]]) -> String {
        let cols = ["at", "form", "day", "time", "total", "result", "code", "submissionId"]
        func esc(_ v: String?) -> String {
            let s = v ?? ""
            guard s.contains(where: { $0 == "\"" || $0 == "," || $0 == "\n" }) else { return s }
            return "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return ([cols.joined(separator: ",")]
            + rows.map { r in cols.map { esc(r[$0]) }.joined(separator: ",") })
            .joined(separator: "\n")
    }
}
