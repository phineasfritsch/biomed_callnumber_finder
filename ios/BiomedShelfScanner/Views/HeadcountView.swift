import SwiftUI

/// The round: pick where and when, walk it, submit once.
///
/// Reading order is the walking order — context, then anything blocking, then the round (day and
/// slot, folded), then **Start walking**, then the review list in route order, then a deliberate
/// gap, then submit, then the terminal state, then the queue and the log.
///
/// That gap is not decoration. Counters and the destructive action must not be adjacent, and a
/// thumb travelling down ten floors must not land on Submit.
struct HeadcountView: View {

    @Environment(HeadcountStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var submitter = HeadcountSubmitter()
    @State private var feedback = HeadcountFeedback()
    @State private var showWalk = false
    @State private var showConfirm = false
    @State private var roundOpen = false
    @State private var roundTouched = false
    @State private var confirmDiscard = false
    @State private var confirmReset: HeadcountLogic.Stop?

    var body: some View {
        NavigationStack {
            ZStack {
                PaperBackground()
                content
            }
            .navigationTitle("Headcount")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        feedback.isSoundOn.toggle()
                        feedback.fire(.press)
                    } label: {
                        Image(systemName: feedback.isSoundOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel(feedback.isSoundOn ? "Mute the tones" : "Unmute the tones")
                }
            }
            .fullScreenCover(isPresented: $showWalk) {
                HeadcountWalkView(feedback: feedback)
            }
            .sheet(isPresented: $showConfirm) {
                HeadcountConfirmSheet(submitter: submitter) {
                    Task { await submitter.submit(store: store) }
                }
            }
        }
        .task {
            feedback.prepare()
            await submitter.refreshDrift(into: store)
            await submitter.sweepOutbox(store: store)
        }
        .confirmationDialog("An unfinished round is saved on this phone.",
                            isPresented: .init(get: { store.resumable }, set: { if !$0 { store.resume() } }),
                            titleVisibility: .visible) {
            Button("Resume it") { store.resume() }
            Button("Discard and start fresh", role: .destructive) { store.discard() }
        } message: {
            Text("\(store.grandTotal) counted so far. Resuming keeps every number and the stop you were on.")
        }
        .confirmationDialog("Reset this round?", isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button("Reset every counter", role: .destructive) { store.discard(); feedback.fire(.refused) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This clears all \(store.grandTotal) counted. It can't be undone.")
        }
        .confirmationDialog("Reset this counter?", isPresented: .init(
            get: { confirmReset != nil }, set: { if !$0 { confirmReset = nil } }
        ), titleVisibility: .visible) {
            Button("Set to zero", role: .destructive) {
                if let stop = confirmReset { store.reset(stop); feedback.fire(.refused) }
                confirmReset = nil
            }
            Button("Cancel", role: .cancel) { confirmReset = nil }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                whereAmI
                blockingBanner
                roundPanel
                startWalking
                counterList
                // 34pt of nothing. Counters and Submit must not be adjacent — see the type
                // comment. This is the same gap the web app leaves.
                Color.clear.frame(height: 34)
                submitBlock
                if !store.outbox.isEmpty { queuePanel }
                if !store.log.isEmpty { logPanel }
            }
            .padding(14)
        }
        .scrollDismissesKeyboard(.immediately)
    }

    // MARK: Context

    private var whereAmI: some View {
        VStack(alignment: .leading, spacing: 10) {
            MicroLabel(text: "counting")
            Text(store.includeCollab ? "Biomed + Collab Hub" : "Biomedical Library")
                .font(Theme.display(22, relativeTo: .title2))
                .foregroundStyle(Theme.ink)

            Toggle(isOn: Binding(
                get: { store.includeCollab },
                set: { store.setIncludeCollab($0); feedback.fire(.press) }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Include the Collab Hub")
                        .font(Theme.mono(13, weight: .medium))
                    Text("one Submit, two rows, two sheets — never merged")
                        .font(Theme.mono(11, relativeTo: .caption))
                        .foregroundStyle(Theme.inkSoft)
                }
            }
            .tint(Theme.green)
            .disabled(store.isLocked(HeadcountConfig.collab))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    // MARK: Blocking

    /// At most one banner: the most blocking thing wins, because a stack of warnings is a
    /// stack nobody reads.
    @ViewBuilder
    private var blockingBanner: some View {
        let clock = HeadcountLogic.clockPlausible()
        if store.isBlockedByDrift {
            banner(
                title: "The Google Form changed",
                body: "Submitting now would write into the wrong columns. Enter this round by "
                    + "hand and tell whoever maintains the form.",
                detail: store.forms.flatMap { store.drift[$0.id] ?? [] }
            )
        } else if !clock.ok {
            banner(
                title: "This phone's clock is wrong",
                body: "Every round is filed by day and time. Fix the date in Settings before counting.",
                detail: []
            )
        } else if store.persistenceFailed {
            banner(
                title: "This phone cannot save the round",
                body: "Storage is full or restricted. Finish and submit without closing the app — "
                    + "a count that cannot be saved will be lost if the app is killed.",
                detail: []
            )
        } else if store.daysDisagree() {
            banner(
                title: "The two forms disagree about the day",
                body: "Only Biomed has an 11:00 PM slot, so just after midnight the snapped slots "
                    + "fall on different days. Check the day and slot below before submitting.",
                detail: []
            )
        } else {
            EmptyView()
        }
    }

    private func banner(title: String, body: String, detail: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.accent)
                Text(title)
                    .font(Theme.display(17))
                    .foregroundStyle(Theme.accent)
            }
            Text(body)
                .font(Theme.mono(12, relativeTo: .footnote))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(detail, id: \.self) { d in
                Text("• \(d)")
                    .font(Theme.mono(11, relativeTo: .caption))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.orangeSoft, in: RoundedRectangle(cornerRadius: Theme.radius))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.radius)
                .strokeBorder(Theme.accent.opacity(0.35), lineWidth: 1)
        }
    }

    // MARK: The round

    /// Folded by default, because its head *is* the read-out — nothing worth checking is hidden.
    /// It opens itself when the snap is not trustworthy, and once opened or closed by hand it
    /// stops opening itself.
    private var shouldOpenItself: Bool {
        !roundTouched && (store.daysDisagree() || !HeadcountLogic.clockPlausible().ok)
    }

    private var roundPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                roundTouched = true
                withAnimation(Theme.spring) { roundOpen.toggle() }
                feedback.fire(.press)
            } label: {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 3) {
                        MicroLabel(text: "round")
                        Text(roundSummary)
                            .font(Theme.mono(13, weight: .medium))
                            .foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 8)
                    Chip(text: shouldOpenItself ? "check" : "change",
                         tone: shouldOpenItself ? .no : .neutral)
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if roundOpen || shouldOpenItself {
                Divider().overlay(Theme.line)

                MicroLabel(text: "day")
                dayPicker

                ForEach(store.forms) { form in
                    MicroLabel(text: store.forms.count > 1 ? "\(form.short) time" : "time")
                    slotGrid(form)
                }
            }
        }
        .card()
    }

    private var roundSummary: String {
        let times = store.forms
            .map { store.forms.count > 1 ? "\($0.short) \(store.timeLabel($0))" : store.timeLabel($0) }
            .joined(separator: " · ")
        return "\(store.day) · \(times)"
    }

    private var dayPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Array(HeadcountConfig.days.enumerated()), id: \.offset) { i, d in
                    let on = i == store.dayIndex
                    Button {
                        store.setDay(i)
                        feedback.fire(.press)
                    } label: {
                        Text(d.prefix(3))
                            .font(Theme.mono(12, weight: on ? .semibold : .regular))
                            .foregroundStyle(on ? Theme.paper : Theme.ink)
                            .frame(minWidth: 48, minHeight: 44)
                            .background(on ? Theme.ink : Theme.paper2, in: Capsule())
                    }
                    .accessibilityLabel(d)
                    .accessibilityAddTraits(on ? [.isSelected] : [])
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func slotGrid(_ form: HeadcountConfig.Form) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 76), spacing: 6)], spacing: 6) {
            ForEach(Array(form.timeLabels.enumerated()), id: \.offset) { i, label in
                let on = i == store.slot(form)
                Button {
                    store.setSlot(i, for: form)
                    feedback.fire(.press)
                } label: {
                    Text(label)
                        .font(Theme.mono(12, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? Theme.paper : Theme.ink)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(on ? Theme.ink : Theme.paper2,
                                    in: RoundedRectangle(cornerRadius: 8))
                }
                .disabled(store.isLocked(form))
                .accessibilityAddTraits(on ? [.isSelected] : [])
            }
        }
    }

    // MARK: Walk

    private var startWalking: some View {
        Button {
            showWalk = true
            feedback.fire(.next)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "figure.walk")
                Text("Start walking")
            }
        }
        .buttonStyle(.shelfWide)
        .disabled(store.pendingForms.isEmpty)
    }

    // MARK: Counters

    private var counterList: some View {
        VStack(alignment: .leading, spacing: 8) {
            MicroLabel(text: "the walk, in order")
            ForEach(store.stops) { stop in
                counterRow(stop)
            }
            totals
        }
    }

    private func counterRow(_ stop: HeadcountLogic.Stop) -> some View {
        let value = store.count(stop)
        let locked = store.isLocked(stop.form)
        return HStack(spacing: 10) {
            // Rows carry the stop name and nothing else. A second line saying which sheet it
            // feeds said the same thing ten times over and buried the one row that differs;
            // which sheet each row feeds is stated once in the totals underneath.
            Text(stop.counter.label)
                .font(Theme.mono(13, weight: .medium))
                .foregroundStyle(locked ? Theme.inkFaint : Theme.ink)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 4)

            Button {
                answer(store.bump(stop, by: -1), positive: false)
            } label: {
                Image(systemName: "minus")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 48, height: 48)
                    .foregroundStyle(Theme.ink)
                    .background(Theme.paper2, in: RoundedRectangle(cornerRadius: 10))
            }
            .accessibilityLabel("One fewer at \(stop.counter.label)")

            Text("\(value)")
                .font(Theme.mono(20, relativeTo: .title3, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Theme.ink)
                .frame(minWidth: 44)

            Button {
                answer(store.bump(stop, by: 1), positive: true)
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 17, weight: .bold))
                    .frame(width: 64, height: 56)
                    .foregroundStyle(Theme.paper)
                    .background(Theme.ink, in: RoundedRectangle(cornerRadius: 10))
            }
            .accessibilityLabel("One more at \(stop.counter.label)")
        }
        .padding(10)
        // Touched rows tint green-soft — the same "this is a hit" signal Shelfmark uses for a
        // found call number, so at a glance you can see which floors you have already done.
        .background(value > 0 ? Theme.greenSoft : Theme.card,
                    in: RoundedRectangle(cornerRadius: Theme.radius))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.radius).strokeBorder(Theme.line, lineWidth: 1)
        }
        .opacity(locked ? 0.55 : 1)
        // A long press resets one counter, so iOS must not answer it with a selection handle.
        .onLongPressGesture(minimumDuration: 0.6) {
            guard !locked else { return feedback.fire(.refused) }
            confirmReset = stop
        }
        .accessibilityElement(children: .contain)
        .accessibilityValue("\(value)")
    }

    private func answer(_ outcome: HeadcountStore.TapOutcome, positive: Bool) {
        switch outcome {
        case .changed:   feedback.fire(positive ? .add : .subtract)
        case .refused:   feedback.fire(.refused)
        case .debounced: break
        }
    }

    private var totals: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(store.forms) { form in
                HStack {
                    Text(form.label)
                        .font(Theme.mono(12))
                        .foregroundStyle(Theme.inkSoft)
                    if store.isLocked(form) { Chip(text: "recorded", tone: .ok) }
                    Spacer()
                    Text("\(store.total(form))")
                        .font(Theme.mono(14, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                }
            }
            if store.forms.count > 1 {
                Divider().overlay(Theme.line)
                HStack {
                    // Outside both, so it cannot be mistaken for either form's number.
                    Text("Everyone in the building")
                        .font(Theme.mono(12, weight: .medium))
                        .foregroundStyle(Theme.ink)
                    Spacer()
                    Text("\(store.grandTotal)")
                        .font(Theme.display(22, relativeTo: .title2))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                }
            }
        }
        .card()
    }

    // MARK: Submit

    private var submitBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                feedback.fire(.press)
                submitter.reset()
                showConfirm = true
            } label: {
                if submitter.isBusy {
                    HStack(spacing: 8) { ProgressView().tint(Theme.paper); Text("Submitting…") }
                } else {
                    Text(submitLabel)
                }
            }
            .buttonStyle(.shelfWide)
            .disabled(submitter.isBusy || store.pendingForms.isEmpty || store.isBlockedByDrift)

            if store.pendingForms.isEmpty {
                Text("Every form in this round has been recorded.")
                    .font(Theme.mono(11, relativeTo: .caption))
                    .foregroundStyle(Theme.inkSoft)
            }

            Button("Reset every counter") { confirmDiscard = true }
                .buttonStyle(.shelfGhostWide)
                .disabled(store.grandTotal == 0)
        }
    }

    private var submitLabel: String {
        let pending = store.pendingForms
        if pending.count == store.forms.count {
            return pending.count > 1 ? "Submit both rows" : "Submit"
        }
        return "Submit the remaining \(pending.map(\.short).joined(separator: " + ")) row"
    }

    // MARK: Queue and log

    private var queuePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                MicroLabel(text: "held on this phone")
                Spacer()
                Button("Retry now") { Task { await submitter.sweepOutbox(store: store) } }
                    .font(Theme.mono(12, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .frame(minHeight: 44)
            }
            ForEach(store.outbox) { item in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(HeadcountConfig.form(id: item.formId)?.label ?? item.formId)
                            .font(Theme.mono(12, weight: .medium))
                        Spacer()
                        Chip(text: item.isStale ? "stale" : "queued",
                             tone: item.isStale ? .no : .neutral)
                    }
                    Text("\(item.total) counted · queued "
                        + HeadcountLogic.formatAge(Date().timeIntervalSince(item.queuedAt)) + " ago"
                        + (item.attempt > 0 ? " · \(item.attempt) tries" : ""))
                        .font(Theme.mono(11, relativeTo: .caption))
                        .foregroundStyle(Theme.inkSoft)
                    if let e = item.lastError {
                        Text(e)
                            .font(Theme.mono(11, relativeTo: .caption))
                            .foregroundStyle(Theme.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    // The whole point of a queue you can see: if it never clears, the numbers are
                    // still here and can be typed into the form by hand.
                    Button("Copy it for manual entry") {
                        guard let form = HeadcountConfig.form(id: item.formId) else { return }
                        UIPasteboard.general.string = HeadcountLogic.payloadDump(
                            form, payload: item.payload, submissionId: item.submissionId)
                        feedback.fire(.press)
                    }
                    .font(Theme.mono(12, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(minHeight: 44)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .card()
            }
        }
    }

    private var logPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                MicroLabel(text: "last \(store.log.count) submissions")
                Spacer()
                Button("Copy CSV") {
                    UIPasteboard.general.string = HeadcountLogic.csv(store.log.map { e in
                        [
                            "at": ISO8601DateFormatter().string(from: e.at),
                            "form": e.formId, "day": e.day, "time": e.time,
                            "total": "\(e.total)", "result": e.result, "code": e.code,
                            "submissionId": e.submissionId,
                        ]
                    })
                    feedback.fire(.press)
                }
                .font(Theme.mono(12, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(minHeight: 44)
            }
            ForEach(store.log.prefix(12)) { e in
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(e.day) · \(e.time)")
                            .font(Theme.mono(12, weight: .medium))
                            .foregroundStyle(Theme.ink)
                        Text("\(HeadcountConfig.form(id: e.formId)?.short ?? e.formId) · \(e.total) counted")
                            .font(Theme.mono(11, relativeTo: .caption))
                            .foregroundStyle(Theme.inkSoft)
                    }
                    Spacer(minLength: 6)
                    Chip(text: e.result.hasPrefix("Confirmed") ? "recorded"
                            : e.result.hasPrefix("Queued") ? "queued" : "failed",
                         tone: e.result.hasPrefix("Confirmed") ? .ok
                            : e.result.hasPrefix("Queued") ? .neutral : .no)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .card(padding: 10)
            }
        }
    }
}

/// The read-back. The last chance a human has to catch a wrong value, so it shows what Google
/// will actually store — including the literal where it differs from the label on the picker.
struct HeadcountConfirmSheet: View {

    @Environment(HeadcountStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let submitter: HeadcountSubmitter
    let onSubmit: () -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                PaperBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if let blocker = submitter.blocker {
                            Text(blocker)
                                .font(Theme.mono(12, relativeTo: .footnote))
                                .foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .background(Theme.orangeSoft, in: RoundedRectangle(cornerRadius: Theme.radius))
                        }

                        if !submitter.results.isEmpty {
                            let landed = submitter.results.filter {
                                if case .confirmed = $0.outcome { return true } else { return false }
                            }.count
                            MicroLabel(text: "\(landed) of \(submitter.results.count) rows recorded")
                        }

                        ForEach(store.forms) { form in
                            formSection(form)
                        }

                        if submitter.phase == .idle {
                            Button("Send it") { onSubmit() }
                                .buttonStyle(.shelfWide)
                        } else if submitter.isBusy {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Waiting for Google's confirmation…")
                                    .font(Theme.mono(12))
                                    .foregroundStyle(Theme.inkSoft)
                            }
                            .frame(maxWidth: .infinity, minHeight: 48)
                        } else {
                            Button("Done") { dismiss() }
                                .buttonStyle(.shelfWide)
                        }
                    }
                    .padding(14)
                }
            }
            .navigationTitle("Check before sending")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back") { dismiss() }.disabled(submitter.isBusy)
                }
            }
        }
        .presentationDetents([.large])
    }

    @ViewBuilder
    private func formSection(_ form: HeadcountConfig.Form) -> some View {
        let result = submitter.results.first { $0.formId == form.id }
        let locked = store.isLocked(form)

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(form.label)
                    .font(Theme.display(17))
                    .foregroundStyle(locked ? Theme.good : Theme.ink)
                Spacer()
                if let result { outcomeChip(result.outcome) }
                else if locked { Chip(text: "recorded", tone: .ok) }
            }

            row("Day of the Week", store.day)
            // Where the picker's house format hides the form's own literal, print both. This
            // read-back is the last chance to catch a wrong value, so it shows what Google stores.
            row("Time", store.timeLabel(form) == store.timeValue(form)
                ? store.timeValue(form)
                : "\(store.timeLabel(form))  (sent as \"\(store.timeValue(form))\")")

            Divider().overlay(Theme.line)

            ForEach(form.counters) { counter in
                // The form's own question title, not the display label — this has to match the
                // sheet column a human would be looking at.
                row(counter.reportedName, "\(store.counts[form.id]?[counter.entry] ?? 0)")
            }

            HStack {
                Text("Total").font(Theme.mono(12, weight: .semibold)).foregroundStyle(Theme.ink)
                Spacer()
                Text("\(store.total(form))")
                    .font(Theme.mono(14, weight: .semibold))
                    .monospacedDigit()
            }

            if let result, case let .failed(_, message) = result.outcome {
                Text(message)
                    .font(Theme.mono(11, relativeTo: .caption))
                    .foregroundStyle(Theme.accent)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Copy it for manual entry") {
                    let payload = HeadcountLogic.buildPayload(
                        form, day: store.day, time: store.timeValue(form),
                        counts: store.counts[form.id] ?? [:])
                    UIPasteboard.general.string = HeadcountLogic.payloadDump(
                        form, payload: payload, submissionId: result.submissionId)
                }
                .font(Theme.mono(12, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(minHeight: 44)
            }
            if let result, case let .queue(_, message) = result.outcome {
                Text(message)
                    .font(Theme.mono(11, relativeTo: .caption))
                    .foregroundStyle(Theme.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
        .overlay {
            RoundedRectangle(cornerRadius: Theme.radius)
                .strokeBorder(locked ? Theme.green.opacity(0.5) : Theme.line, lineWidth: 1)
        }
    }

    private func row(_ name: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(name)
                .font(Theme.mono(12))
                .foregroundStyle(Theme.inkSoft)
            Spacer(minLength: 8)
            Text(value)
                .font(Theme.mono(12, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.trailing)
        }
    }

    private func outcomeChip(_ outcome: HeadcountClient.Outcome) -> some View {
        switch outcome {
        case .confirmed: return Chip(text: "recorded", tone: .ok, symbol: "checkmark.circle.fill")
        case .queue:     return Chip(text: "queued", tone: .neutral, symbol: "clock.fill")
        case .failed:    return Chip(text: "failed", tone: .no, symbol: "exclamationmark.triangle.fill")
        }
    }
}
