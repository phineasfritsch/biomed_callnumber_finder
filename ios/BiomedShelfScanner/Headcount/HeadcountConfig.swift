import Foundation

/// Pinned form schema. **Every string in this file is reproduced byte for byte** from
/// `better_headcount/js/config.js`, which in turn was extracted from `FB_PUBLIC_LOAD_DATA_` on
/// the live Google Forms.
///
/// NEVER trim, normalize, title-case, regex-rewrite or reformat an option string. NEVER derive
/// one form's time list from the other's. NEVER build a time label from a `Date`. Snapping picks
/// an INDEX; the string sent is the array element at that index.
///
/// The Collab list is deliberately inconsistent ("8 AM" has a space, "10AM" does not). That is
/// what the form contains. Fixing it here silently corrupts the sheet.
///
/// **This file is a second copy of a schema, which is exactly what the drift check exists to
/// avoid.** The web client and the Worker share one `config.js` on purpose — "a second copy of
/// the field map is a second thing to forget to update". A native app cannot import a JS module,
/// so the copy is unavoidable; what is avoidable is nobody noticing when it drifts.
/// `node ios/Tools/headcount.parity.test.js` compares this file against `js/config.js` field by
/// field and string by string. Run it before every release. If `schemaVersion` here and in the
/// Worker disagree, the proxy rejects the submission with `schema-version-mismatch` rather than
/// writing into the wrong columns — so the failure is loud either way, but the test is how you
/// find out before a walk instead of at the end of one.
enum HeadcountConfig {

    static let schemaVersion = "2026-08-06.1"

    /// Where the client posts. The Worker is the only thing that can tell success from failure —
    /// a direct POST to Google from a client returns a response you cannot verify — so there is
    /// no direct-to-Google fallback path on purpose.
    ///
    /// The Worker's CORS allowlist does not apply here: it keys off the `Origin` header, and a
    /// native app sends none (`if (!origin) return base` in `worker/src/index.js`). Nothing needs
    /// changing server-side for this app to submit.
    static let workerURL = URL(string: "https://biocount-proxy.phineas-fritsch.workers.dev")!

    static let days = [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ]

    static let timeZone = TimeZone(identifier: "America/Los_Angeles")!

    /// Counters clamp here. 999 is not a real occupancy, it is a stuck-key alarm.
    static let countMax = 999
    /// Two increments from one target closer together than this are one physical tap.
    static let tapDebounce: TimeInterval = 0.040
    /// A queued item older than this stops being a footnote and becomes a warning.
    static let staleQueue: TimeInterval = 12 * 60 * 60
    /// Anything timestamped before this means the device clock is wrong.
    static let buildEpoch = Date(timeIntervalSince1970: 1_785_542_400)   // 2026-08-01T00:00:00Z

    // MARK: Forms

    struct Counter: Identifiable, Hashable {
        /// The Google Form field id. This is the only thing that decides which column a number
        /// lands in.
        let entry: String
        /// What the walker reads.
        let label: String
        /// What the Google Form calls the question, when that differs. It is this name — not the
        /// display label — that appears in the confirm read-back, the manual-entry dump and the
        /// schema fingerprint, because those have to match the real form and the sheet column.
        var formTitle: String?

        var id: String { entry }
        var reportedName: String { formTitle ?? label }
    }

    struct Form: Identifiable, Hashable {
        let id: String
        let label: String
        let short: String
        let formId: String
        let action: URL
        let viewform: URL
        let dayEntry: String
        let timeEntry: String
        let times: [String]
        /// Minutes from midnight for each index above. Kept parallel to the literal list rather
        /// than parsed out of it, so a parser bug cannot reshape the vocabulary. The index is the
        /// only thing the two arrays share.
        let timeMinutes: [Int]
        /// Display only. Never sent, never validated against, never part of the fingerprint.
        let timeLabels: [String]
        let countersLabel: String
        let countersHint: String
        /// Where this form's counters sit in the physical walk of the *lead* form.
        var walkAfter: String?
        let counters: [Counter]

        var days: [String] { HeadcountConfig.days }
    }

    static let biomed = Form(
        id: "biomed",
        label: "Biomedical Library",
        short: "Biomed",
        formId: "1FAIpQLSdQsGaxvT8Jm7fmgowkZc4efpmG4IcJ-RmxPIo92dXIAU8DEw",
        action: URL(string: "https://docs.google.com/forms/d/e/1FAIpQLSdQsGaxvT8Jm7fmgowkZc4efpmG4IcJ-RmxPIo92dXIAU8DEw/formResponse")!,
        viewform: URL(string: "https://docs.google.com/forms/d/e/1FAIpQLSdQsGaxvT8Jm7fmgowkZc4efpmG4IcJ-RmxPIo92dXIAU8DEw/viewform")!,
        dayEntry: "entry.630997439",
        timeEntry: "entry.97344441",
        times: [
            "7:45 AM", "8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM",
            "4:00 PM", "6:00 PM", "8:00 PM", "10:00 PM", "11:00 PM",
        ],
        timeMinutes: [465, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1380],
        timeLabels: [
            "7:45 AM", "8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM",
            "4:00 PM", "6:00 PM", "8:00 PM", "10:00 PM", "11:00 PM",
        ],
        countersLabel: "Floors",
        countersHint: "top down, walking order",
        walkAfter: nil,
        // Physical walking order, top floor down. Display order is not cosmetic; it is the route.
        counters: [
            Counter(entry: "entry.1631294403", label: "Stacks Level 11"),
            Counter(entry: "entry.794053318",  label: "Stacks Level 10"),
            Counter(entry: "entry.836521796",  label: "Stacks Level 9"),
            Counter(entry: "entry.327481283",  label: "Stacks Level 8"),
            Counter(entry: "entry.923390647",  label: "Graduate Reading Room"),
            Counter(entry: "entry.1406974975", label: "Stacks Level 7"),
            Counter(entry: "entry.209218120",  label: "Stacks Level 6"),
            Counter(entry: "entry.131170740",  label: "Stacks Level 5"),
            Counter(entry: "entry.1115969783", label: "Main Reading Room"),
            Counter(entry: "entry.1912412155", label: "Stacks Level 1-3"),
        ]
    )

    static let collab = Form(
        id: "collab",
        label: "Collab Hub",
        short: "Collab",
        formId: "1FAIpQLSc4NJ7LkB4Gmh0wdy_xBS2VJZG-9R_dO2f4_GbcZZOkllSu5A",
        action: URL(string: "https://docs.google.com/forms/d/e/1FAIpQLSc4NJ7LkB4Gmh0wdy_xBS2VJZG-9R_dO2f4_GbcZZOkllSu5A/formResponse")!,
        viewform: URL(string: "https://docs.google.com/forms/d/e/1FAIpQLSc4NJ7LkB4Gmh0wdy_xBS2VJZG-9R_dO2f4_GbcZZOkllSu5A/viewform")!,
        dayEntry: "entry.1915113027",
        timeEntry: "entry.321042358",
        // Deliberately inconsistent. This is what the form contains.
        times: ["8 AM", "10AM", "12PM", "2PM", "4PM", "6PM", "8PM", "10PM"],
        timeMinutes: [480, 600, 720, 840, 960, 1080, 1200, 1320],
        // The two forms write times differently. Showing both conventions in one round reads as a
        // bug, so the picker shows one house format for both. Where a label hides the literal, the
        // confirm sheet prints the literal too — that read-back is the last chance a human has to
        // catch a wrong value.
        timeLabels: [
            "8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM",
            "4:00 PM", "6:00 PM", "8:00 PM", "10:00 PM",
        ],
        countersLabel: "Count",
        countersHint: "one number for the room",
        // The Hub is reached off Stacks Level 6, so on a combined round it is counted there —
        // not tacked onto the end of the list. The route is the order.
        walkAfter: "entry.209218120",
        counters: [
            Counter(entry: "entry.2094341890", label: "Collab Hub", formTitle: "Headcount Number"),
        ]
    )

    static let forms: [Form] = [biomed, collab]

    static func form(id: String) -> Form? { forms.first { $0.id == id } }
}
