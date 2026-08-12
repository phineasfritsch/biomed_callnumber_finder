import Foundation

/// Talks to the submit proxy. The only networking in the app.
///
/// **There is no direct-to-Google path, by design.** A client POST to a Google Form returns a
/// response the client cannot verify, so a success indicator built on it would be a lie. The
/// Worker reads Google's own confirmation string back before anything here calls a round
/// recorded — a green tick means the row exists, not that the request left the phone.
///
/// The Worker's CORS allowlist is not an obstacle: it keys off the `Origin` header, which a
/// native app does not send, and `worker/src/index.js` returns the base headers when there is no
/// origin. Nothing server-side needs changing for this app.
struct HeadcountClient {

    var baseURL = HeadcountConfig.workerURL
    var session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 20
        c.waitsForConnectivity = false      // fail fast; the outbox is the retry mechanism
        return URLSession(configuration: c)
    }()

    /// The three terminal states the UI knows how to act on, and nothing else. In particular
    /// there is no "probably fine": a 200 without Google's marker is a **failure**, and it is not
    /// retryable, because retrying something that may have succeeded is how a duplicate row gets
    /// written.
    enum Outcome: Equatable {
        /// Google's own confirmation was read back.
        case confirmed(code: String)
        /// Transient. Hold it in the outbox and retry with the same submissionId.
        case queue(code: String, message: String)
        /// Stop. Enter it by hand; the message says why.
        case failed(code: String, message: String)

        var code: String {
            switch self {
            case let .confirmed(c): return c
            case let .queue(c, _), let .failed(c, _): return c
            }
        }
    }

    private struct Response: Decodable {
        var ok: Bool?
        var code: String?
        var message: String?
        var verifiedMarker: Bool?
        var errors: [String]?
        var changes: [String]?
        var slotAlreadyFilled: Bool?
    }

    /// Submit one form's row.
    ///
    /// `submissionId` is generated once per Submit press and **reused by every retry forever**.
    /// That is what makes a retry over a succeeded-but-unacknowledged POST safe: the Worker keys
    /// its dedupe on it and replays the original answer rather than posting again.
    func submit(form: HeadcountConfig.Form,
                payload: [String: String],
                submissionId: String) async -> Outcome {
        var request = URLRequest(url: baseURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        let body: [String: Any] = [
            "submissionId": submissionId,
            "formId": form.formId,
            "schemaVersion": HeadcountConfig.schemaVersion,
            "payload": payload,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: body) else {
            return .failed(code: "encode-failed", message: "The round could not be encoded. This is a bug.")
        }
        request.httpBody = data

        do {
            let (responseData, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let decoded = try? JSONDecoder().decode(Response.self, from: responseData)
            return classify(status: status, body: decoded)
        } catch {
            // Never reached Google, or never reached the proxy. The id stays reusable.
            return .queue(code: "offline",
                          message: "No answer from the proxy. Held on this phone and retried.")
        }
    }

    private func classify(status: Int, body: Response?) -> Outcome {
        let code = body?.code ?? "http-\(status)"

        if status == 200, body?.ok == true, body?.verifiedMarker == true {
            return .confirmed(code: code)
        }
        // A 200 the proxy itself does not call ok is a failure, marker or not.
        if status == 429 || status == 503 || (500...599).contains(status) {
            return .queue(code: code, message: body?.message
                ?? "The proxy could not reach Google. Held on this phone and retried.")
        }

        let detail = [body?.message, body?.errors?.joined(separator: "; "),
                      body?.changes?.map { "• \($0)" }.joined(separator: "\n")]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "\n")

        return .failed(code: code, message: detail.isEmpty ? Self.explain(code) : detail)
    }

    /// The Worker's refusal codes, in words a person standing in a stairwell can act on.
    static func explain(_ code: String) -> String {
        switch code {
        case "schema-drift":
            return "The Google Form changed. Submitting now would write into the wrong columns."
        case "schema-version-mismatch":
            return "This app is pinned to an older copy of the form than the proxy is. Update the app before submitting."
        case "form-not-allowed":
            return "The proxy will not post to that form."
        case "payload-invalid":
            return "The round did not pass validation and was not sent."
        case "form-closed":
            return "The form is not accepting responses."
        case "form-missing":
            return "Google returned 404. The form was deleted or the id is wrong."
        case "no-marker":
            return "Google returned 200 without its confirmation. The row may not exist. Do not assume it landed."
        case "rate-limited":
            return "The proxy is rate limiting. Wait a moment and try again."
        default:
            return "The submission failed (\(code))."
        }
    }

    // MARK: Drift

    struct Drift {
        var changes: [String: [String]]
        var checkedAt: Date?
        var error: String?
    }

    private struct DriftResponse: Decodable {
        struct Form: Decodable {
            var changes: [String]?
            var checkedAt: String?
            var error: String?
        }
        var forms: [String: Form]?
    }

    /// Ask whether either Google Form has changed under us.
    ///
    /// A fetch failure is **not** drift and is not reported as clean either — it is its own
    /// state. Reporting it as drift blocks every submission on a network blip; reporting it as
    /// clean hides a real change.
    func fetchDrift() async -> Drift {
        let url = baseURL.appendingPathComponent("drift")
        do {
            let (data, response) = try await session.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                return Drift(changes: [:], checkedAt: nil, error: "the drift check is unavailable")
            }
            let decoded = try JSONDecoder().decode(DriftResponse.self, from: data)
            var changes: [String: [String]] = [:]
            var checkedAt: Date?
            var error: String?
            let iso = ISO8601DateFormatter()
            for (id, f) in decoded.forms ?? [:] {
                changes[id] = f.changes ?? []
                if let s = f.checkedAt, let d = iso.date(from: s) {
                    checkedAt = max(checkedAt ?? d, d)
                }
                if let e = f.error { error = e }
            }
            return Drift(changes: changes, checkedAt: checkedAt, error: error)
        } catch {
            return Drift(changes: [:], checkedAt: nil, error: "the drift check could not be reached")
        }
    }
}
