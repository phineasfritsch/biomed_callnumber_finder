import Foundation
import Observation

/// Drives one Submit press to a terminal state, per form.
///
/// Split from the view because the rules here are the ones that must not be re-derived by
/// whoever next edits a layout:
///
/// * **One `submissionId` per press, reused by every retry forever.** It is generated when the
///   press happens, not when the request goes out, and a queued round carries it until it lands.
///   This is the whole of the idempotency story — the Worker keys its dedupe on it and replays
///   the original answer rather than posting a second row.
/// * **Single-flight.** A second press while one is in the air is ignored, not queued.
/// * **Per form, never merged.** A combined round is two payloads, two ids, two results. A form
///   whose row has landed is excluded from any further submit in that round.
/// * **Validate before dispatch, every time.** The Worker validates too and does not trust this
///   client; this client should not be the reason it has to.
@Observable
@MainActor
final class HeadcountSubmitter {

    enum Phase: Equatable {
        case idle
        case checking
        case sending(formId: String)
        case done
    }

    struct Result: Identifiable, Equatable {
        let formId: String
        let outcome: HeadcountClient.Outcome
        let submissionId: String
        var id: String { formId }
    }

    private(set) var phase: Phase = .idle
    private(set) var results: [Result] = []
    /// Set when the round could not even be attempted — a bad clock, drift, or a payload that
    /// failed validation. Blocking, and named.
    private(set) var blocker: String?

    private var client = HeadcountClient()
    private var inFlight = false

    var isBusy: Bool { phase != .idle && phase != .done }

    func reset() {
        phase = .idle
        results = []
        blocker = nil
    }

    /// Refresh the drift status. Cheap, and worth doing when the screen opens: a blocked round
    /// should be visible before the walk, not at the end of it.
    func refreshDrift(into store: HeadcountStore) async {
        let d = await client.fetchDrift()
        store.setDrift(d.changes, checkedAt: d.checkedAt, error: d.error)
    }

    /// Submit every form in the round that has not already landed.
    func submit(store: HeadcountStore) async {
        guard !inFlight else { return }
        inFlight = true
        defer { inFlight = false }

        reset()
        phase = .checking

        let clock = HeadcountLogic.clockPlausible()
        guard clock.ok else {
            blocker = clock.reason == "before-build"
                ? "This phone's clock is set before this app was built. Every round is filed by day and time, so fix the date before you count."
                : "This phone's clock is years ahead. Fix the date before you count."
            phase = .done
            return
        }

        // Re-check drift at the moment of submission, not only when the screen opened. A form can
        // change during a forty-minute walk.
        await refreshDrift(into: store)
        if store.isBlockedByDrift {
            let changes = store.forms.flatMap { store.drift[$0.id] ?? [] }
            blocker = "The Google Form changed. Submitting now would write into the wrong "
                + "columns.\n\n" + changes.map { "• \($0)" }.joined(separator: "\n")
            phase = .done
            return
        }

        let day = store.day
        for form in store.pendingForms {
            let payload = HeadcountLogic.buildPayload(
                form,
                day: day,
                time: store.timeValue(form),
                counts: store.counts[form.id] ?? [:]
            )
            let check = HeadcountLogic.validate(form, payload: payload)
            guard check.ok else {
                blocker = "\(form.label): the round did not pass validation and was not sent.\n"
                    + check.errors.map { "• \($0)" }.joined(separator: "\n")
                phase = .done
                return
            }

            let submissionId = UUID().uuidString.lowercased()
            phase = .sending(formId: form.id)
            let outcome = await client.submit(form: form, payload: payload, submissionId: submissionId)
            results.append(Result(formId: form.id, outcome: outcome, submissionId: submissionId))

            let total = HeadcountLogic.total(form, counts: store.counts[form.id] ?? [:])
            store.record(HeadcountStore.LogEntry(
                submissionId: submissionId,
                at: .now,
                formId: form.id,
                day: day,
                time: store.timeValue(form),
                total: total,
                result: label(outcome),
                code: outcome.code
            ))

            switch outcome {
            case .confirmed:
                store.dequeue(submissionId)
                store.markConfirmed(form)
            case .queue:
                store.enqueue(HeadcountStore.Queued(
                    submissionId: submissionId, formId: form.id, payload: payload,
                    queuedAt: .now, attempt: 0, lastError: nil, total: total
                ))
            case .failed:
                break   // never retried automatically; the human enters it by hand
            }
        }
        phase = .done
    }

    /// Retry everything held on the phone. Called when the screen opens and when the user asks.
    ///
    /// Each item keeps its original `submissionId`, so an item that actually succeeded on a
    /// previous attempt comes back as the Worker's replayed answer rather than as a second row.
    func sweepOutbox(store: HeadcountStore) async {
        guard !inFlight else { return }
        inFlight = true
        defer { inFlight = false }

        for item in store.outbox {
            guard let form = HeadcountConfig.form(id: item.formId) else {
                store.dequeue(item.submissionId)
                continue
            }
            let outcome = await client.submit(
                form: form, payload: item.payload, submissionId: item.submissionId)
            switch outcome {
            case .confirmed:
                store.dequeue(item.submissionId)
                store.record(HeadcountStore.LogEntry(
                    submissionId: item.submissionId, at: .now, formId: form.id,
                    day: item.payload[form.dayEntry] ?? "",
                    time: item.payload[form.timeEntry] ?? "",
                    total: item.total, result: "Confirmed", code: outcome.code))
            case let .queue(_, message):
                store.noteAttempt(item.submissionId, error: message)
            case let .failed(code, message):
                // A hard refusal does not belong in a retry loop. It moves to the log with its
                // reason, and the queue stops pretending it will fix itself.
                store.dequeue(item.submissionId)
                store.record(HeadcountStore.LogEntry(
                    submissionId: item.submissionId, at: .now, formId: form.id,
                    day: item.payload[form.dayEntry] ?? "",
                    time: item.payload[form.timeEntry] ?? "",
                    total: item.total, result: "Failed. \(message)", code: code))
            }
        }
    }

    private func label(_ outcome: HeadcountClient.Outcome) -> String {
        switch outcome {
        case .confirmed:        return "Confirmed"
        case .queue:            return "Queued"
        case let .failed(_, m): return "Failed. \(m)"
        }
    }
}
