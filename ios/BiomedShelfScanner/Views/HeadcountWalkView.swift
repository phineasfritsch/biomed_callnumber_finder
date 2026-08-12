import SwiftUI

/// Walk mode — one stop at a time, on a target that fills three quarters of the screen.
///
/// This is the reason the round screen can afford to be dense. It is built to be used with the
/// phone **at your side**, not in front of your face: tap anywhere on the stage to add one, swipe
/// either axis to change stop, and every gesture also has a button.
///
/// **Dead ends answer.** A disabled control dispatches no events, so pressing Next at the last
/// stop would feel exactly like missing the button — and "nothing happened" must never be
/// confusable with "you missed". Controls here are never `disabled`; they stay pressable,
/// announce themselves as dimmed, and reply with the refusal pattern.
struct HeadcountWalkView: View {

    @Environment(HeadcountStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let feedback: HeadcountFeedback
    /// Not `@Environment(\.dismiss)`: this is a mode of `HeadcountView`, not a presentation, so
    /// there is nothing to dismiss. See the note where it is switched in.
    let onDone: () -> Void

    @State private var flash: Color?

    private var stops: [HeadcountLogic.Stop] { store.stops }
    private var index: Int { min(store.walkIndex, max(0, stops.count - 1)) }
    private var stop: HeadcountLogic.Stop? { stops.indices.contains(index) ? stops[index] : nil }

    var body: some View {
        ZStack {
            PaperBackground()
            VStack(spacing: 0) {
                header
                if let stop { stage(stop) } else { Spacer() }
                controls
            }
        }
        // Counting is an eyes-off, phone-at-your-side activity: nothing here resets the idle
        // timer, and a phone that locks on Level 7 costs you the walk.
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .statusBarHidden(false)
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center) {
            Button {
                feedback.fire(.press)
                withAnimation(Theme.spring) { onDone() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.down")
                    Text("Review").font(Theme.mono(13, weight: .semibold))
                }
                .foregroundStyle(Theme.ink)
                .frame(minWidth: 44, minHeight: 44)
                .padding(.horizontal, 8)
            }
            .accessibilityLabel("Back to the round")

            Spacer()

            Text("\(index + 1) of \(stops.count)")
                .font(Theme.mono(12, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(Theme.inkSoft)

            Spacer()

            Button {
                feedback.isSoundOn.toggle()
                feedback.fire(.press)
            } label: {
                Image(systemName: feedback.isSoundOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                    .foregroundStyle(Theme.ink)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel(feedback.isSoundOn ? "Mute the tones" : "Unmute the tones")
        }
        .padding(.horizontal, 10)
        .padding(.top, 4)
    }

    // MARK: The stage

    /// Three quarters of the viewport, the stop name, the count at display size, and nothing else
    /// competing for the thumb.
    private func stage(_ stop: HeadcountLogic.Stop) -> some View {
        let value = store.count(stop)
        let locked = store.isLocked(stop.form)

        return VStack(spacing: 8) {
            Text(stop.counter.label)
                .font(Theme.display(26, relativeTo: .title))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 20)

            // Walk mode names the sheet only when the stop is off the lead form's route — on a
            // combined round ten of eleven stops feed the same sheet, and labelling all of them
            // buries the one that does not.
            if stop.form.id != stops.first?.form.id {
                Chip(text: "\(stop.form.short) sheet", tone: .info, symbol: "arrow.turn.down.right")
            }
            if locked {
                Chip(text: "already recorded", tone: .ok, symbol: "checkmark.circle.fill")
            }

            Text("\(value)")
                .font(Theme.mono(104, relativeTo: .largeTitle, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Theme.ink)
                .minimumScaleFactor(0.4)
                .lineLimit(1)
                .padding(.horizontal, 12)

            Text(locked ? "this form's row has landed" : "tap anywhere to add one")
                .font(Theme.mono(11, relativeTo: .caption))
                .foregroundStyle(Theme.inkFaint)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Colour only, never a transform: a stage that moves under a thumb already on its way
        // back down loses the next tap.
        .background(flash ?? (value > 0 ? Theme.greenSoft : Theme.card))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.radius).strokeBorder(Theme.line, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .onTapGesture { add(stop) }
        .gesture(
            DragGesture(minimumDistance: 24)
                .onEnded { g in
                    // A threshold before anything moves, so a tap that slides a little is still a
                    // tap. Either axis changes stop — the phone is at your side and there is no
                    // "up" you can count on.
                    let dx = g.translation.width, dy = g.translation.height
                    if abs(dx) > abs(dy) { dx < 0 ? next() : back() } else { dy < 0 ? next() : back() }
                }
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(stop.counter.label), \(value) counted")
        .accessibilityHint("Double tap to add one. Swipe with three fingers to change stop.")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: add(stop)
            case .decrement: subtract(stop)
            @unknown default: break
            }
        }
    }

    // MARK: Controls

    /// Deliberately **not** part of the stage, so a blind tap on the counting surface can never
    /// land on Back or −1.
    private var controls: some View {
        HStack(spacing: 8) {
            control("Back", symbol: "chevron.left", dimmed: index == 0) { back() }
            control("−1", symbol: "minus", dimmed: (stop.map { store.count($0) } ?? 0) == 0) {
                if let stop { subtract(stop) }
            }
            control("Next", symbol: "chevron.right", dimmed: index >= stops.count - 1) { next() }
        }
        .padding(.horizontal, 10)
        .padding(.bottom, 6)
    }

    private func control(_ title: String, symbol: String, dimmed: Bool,
                         action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: symbol).font(.system(size: 13, weight: .semibold))
                Text(title).font(Theme.mono(13, weight: .semibold))
            }
            .foregroundStyle(dimmed ? Theme.inkFaint : Theme.ink)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.radius))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.radius)
                    .strokeBorder(dimmed ? Theme.line.opacity(0.6) : Theme.line, lineWidth: 1)
            }
        }
        // NOT `.disabled`. A disabled button dispatches nothing, and silence is indistinguishable
        // from a missed tap. It stays pressable and answers with the refusal pattern; VoiceOver
        // still hears that it is dimmed.
        .accessibilityAddTraits(dimmed ? [.isSelected] : [])
        .accessibilityHint(dimmed ? "Dimmed. There is nothing in that direction." : "")
    }

    // MARK: Actions

    private func add(_ stop: HeadcountLogic.Stop) {
        switch store.bump(stop, by: 1) {
        case .changed:
            feedback.fire(.add)
            flashNow(Theme.greenSoft)
        case .refused:
            feedback.fire(.refused)
            flashNow(Theme.orangeSoft)
        case .debounced:
            break
        }
    }

    private func subtract(_ stop: HeadcountLogic.Stop) {
        switch store.bump(stop, by: -1) {
        case .changed:  feedback.fire(.subtract); flashNow(Theme.paper2)
        case .refused:  feedback.fire(.refused); flashNow(Theme.orangeSoft)
        case .debounced: break
        }
    }

    private func next() {
        guard index < stops.count - 1 else {
            // End of the route is a dead end that answers, and it answers differently from a
            // refusal — you have finished, which is not the same as being told no.
            feedback.fire(.finished)
            flashNow(Theme.greenSoft)
            return
        }
        store.setWalkIndex(index + 1)
        feedback.fire(.next)
    }

    private func back() {
        guard index > 0 else {
            feedback.fire(.refused)
            flashNow(Theme.orangeSoft)
            return
        }
        store.setWalkIndex(index - 1)
        feedback.fire(.back)
    }

    private func flashNow(_ colour: Color) {
        guard !reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.08)) { flash = colour }
        Task {
            try? await Task.sleep(for: .milliseconds(140))
            withAnimation(.easeIn(duration: 0.1)) { flash = nil }
        }
    }
}
