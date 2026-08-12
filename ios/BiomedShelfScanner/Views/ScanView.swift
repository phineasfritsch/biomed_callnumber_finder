import SwiftUI

/// Root view: the camera, live and already scanning.
///
/// Not a tab, not behind a button. The app opens ready to scan because the job is "point at 40
/// spines", and every tap between the librarian and that loop is friction multiplied by 40.
/// See DESIGN.md §1–§2.
struct ScanView: View {

    @Environment(TripStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var engine: ScanEngine
    @State private var feedback = ScanFeedback()

    @State private var seeing: CallNumberRecognizer.Result?
    @State private var flash: FlashState?

    private let router: Router

    init(router: Router) {
        self.router = router
        _engine = State(initialValue: ScanEngine(router: router))
    }

    private enum FlashState: Equatable {
        case accepted, duplicate, warning
        var color: Color {
            switch self {
            case .accepted:  return Theme.located
            case .duplicate: return Theme.hi
            case .warning:   return Theme.unlocated
            }
        }
    }

    var body: some View {
        GeometryReader { geo in
            // One measurement, two consumers: the rect the overlay draws and the band the
            // recognizer filters by are the same value, so they cannot drift apart. See
            // ScanGeometry — this is what stopped the outline running under the shutter.
            let safeTop = geo.safeAreaInsets.top
            let safeBottom = geo.safeAreaInsets.bottom
            let screen = CGSize(
                width: geo.size.width,
                height: geo.size.height + safeTop + safeBottom
            )
            let band = ScanGeometry.band(
                precision: engine.isPrecisionMode,
                screen: screen,
                safeTop: safeTop,
                safeBottom: safeBottom
            )

            ZStack {
                CameraPreview(session: engine.session)
                    .ignoresSafeArea()

                ViewfinderOverlay(band: band, seeing: seeing, flash: flash?.color)
                    .ignoresSafeArea()

                VStack {
                    topBar
                    Spacer()
                    if engine.captureMode == .single {
                        scanButton
                            .padding(.bottom, ScanGeometry.shutterBottomPadding(safeBottom: safeBottom))
                    }
                }

                if let message = engine.errorMessage {
                    cameraUnavailable(message)
                }
            }
            .onChange(of: band) { _, new in engine.setBand(new) }
            .onAppear { engine.setBand(band) }
        }
        .task { await engine.start() }
        .onAppear {
            feedback.prepare()
            engine.onEvent = handle
        }
        .onChange(of: scenePhase) { _, phase in
            // Don't hold the camera (or the torch) while backgrounded.
            switch phase {
            case .active:     Task { await engine.start() }
            case .background: engine.stop()
            default:          break
            }
        }
        // The trip sheet is permanently presented — it *is* the bottom half of the UI, and the
        // camera stays live behind it. Route, request-sheet capture and import review are all
        // presented from inside TripSheet rather than here: a fullScreenCover raised from a view
        // that already has a sheet up does not reliably appear, because the sheet owns the
        // presentation context.
        .sheet(isPresented: .constant(true)) {
            TripSheet(
                router: router,
                onToggleDiagnostics: { engine.setDiagnosing($0) },
                onPresentFullScreen: { engine.stop() },
                onDismissFullScreen: { Task { await engine.start() } }
            )
            // ScanGeometry.sheetPeek must match this. The band is measured off it.
            .presentationDetents([.height(ScanGeometry.sheetPeek), .medium, .large])
            .presentationBackgroundInteraction(.enabled(upThrough: .medium))
            .presentationDragIndicator(.visible)
            .presentationBackground(Theme.paper)
            .interactiveDismissDisabled()
        }
    }

    // MARK: Scan button

    /// The arm switch. Press → recognizer hunts until one read is accepted → idles again.
    /// One press per book, by design: continuous capture filed partial re-reads of a single
    /// label as separate entries, and a trip list that needs de-duplicating costs more trust
    /// than a tap costs time.
    private var scanButton: some View {
        Button {
            if engine.isArmed { engine.disarm() } else { engine.arm() }
        } label: {
            ZStack {
                Circle()
                    .strokeBorder(Theme.paper.opacity(0.9), lineWidth: 4)
                    .frame(width: ScanGeometry.shutter, height: ScanGeometry.shutter)
                Circle()
                    .fill(engine.isArmed ? Theme.orange : Theme.card)
                    .frame(width: ScanGeometry.shutter - 16, height: ScanGeometry.shutter - 16)
                if engine.isArmed {
                    Image(systemName: "xmark")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.paper)
                }
            }
        }
        .accessibilityLabel(engine.isArmed ? "Cancel scan" : "Scan a call number")
        .accessibilityHint(engine.isArmed
            ? "Scanning now. Double tap to stop without adding anything."
            : "Starts scanning. Stops by itself once one call number is read.")
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack(spacing: 4) {
            modeChip(
                title: engine.isPrecisionMode ? "Precision" : "Wide",
                symbol: engine.isPrecisionMode ? "viewfinder.rectangular" : "viewfinder",
                on: engine.isPrecisionMode
            ) {
                engine.isPrecisionMode.toggle()
                engine.resetVoting()
            }
            .accessibilityHint("Precision narrows the scan area to one label at a time, for tightly packed spines.")

            modeChip(
                title: engine.captureMode == .single ? "Single" : "Sweep",
                symbol: engine.captureMode == .single ? "camera.metering.spot" : "camera.metering.matrix",
                on: engine.captureMode == .sweep
            ) {
                engine.captureMode = engine.captureMode == .single ? .sweep : .single
                engine.resetVoting()
            }
            .accessibilityHint("Single scans one book per button press. Sweep scans continuously along a shelf.")

            Spacer(minLength: 0)

            if engine.hasTorch {
                modeChip(
                    title: nil,
                    symbol: engine.isTorchOn ? "bolt.fill" : "bolt.slash",
                    on: engine.isTorchOn
                ) {
                    engine.isTorchOn.toggle()
                }
                .accessibilityLabel(engine.isTorchOn ? "Turn torch off" : "Turn torch on")
            }
        }
        .padding(4)
        // Over live video, so a scrim rather than a token colour — the scene behind changes
        // brightness unpredictably and no flat fill passes contrast against all of it.
        .background(.ultraThinMaterial, in: Capsule())
        .overlay { Capsule().strokeBorder(Theme.paper.opacity(0.25), lineWidth: 1) }
        .padding(.horizontal, ScanGeometry.gap)
        .padding(.top, ScanGeometry.barTopPadding)
    }

    private func modeChip(title: String?, symbol: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: symbol).font(.system(size: 13, weight: .semibold))
                if let title {
                    Text(title).font(Theme.mono(12, relativeTo: .footnote, weight: .semibold))
                }
            }
            .foregroundStyle(on ? Theme.ink : Theme.paper)
            .padding(.horizontal, 12)
            // 44pt tall, and the chip is the tap target — not the glyph inside it.
            .frame(minWidth: 44, minHeight: ScanGeometry.barHeight - 8)
            .background(on ? Theme.paper.opacity(0.92) : .clear, in: Capsule())
        }
    }

    private func cameraUnavailable(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "camera.fill").font(.system(size: 26)).foregroundStyle(Theme.inkSoft)
            Text(message)
                .font(Theme.mono(13))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
            // Always give a path forward: the scanner is a convenience, the routing is the product.
            Text("You can still add call numbers by hand from the list below.")
                .font(Theme.mono(12, relativeTo: .footnote))
                .foregroundStyle(Theme.inkSoft)
                .multilineTextAlignment(.center)
        }
        .card(padding: 20)
        .frame(maxWidth: 320)
        .padding()
    }

    // MARK: Events

    private func handle(_ event: ScanEngine.Event) {
        switch event {
        case let .seeing(result):
            withAnimation(reduceMotion ? nil : Theme.spring) { seeing = result }

        case .cleared:
            withAnimation(reduceMotion ? nil : Theme.spring) { seeing = nil }

        case let .accepted(result):
            let cn: CallNumber
            let hit: Router.Hit?
            switch result {
            case let .located(c, h): cn = c; hit = h
            case let .unlocated(c):  cn = c; hit = nil
            }

            // Merge window only in sweep — single-shot disarms after each accept, so a same-book
            // upgrade can never follow and prefix-merging would only ever eat the NEXT book
            // (journals shelve as runs of the same title). See TripStore.add.
            // 2.5s: a same-book upgrade lands within ~2s (voter cadence); anything later is more
            // likely the next volume in the run. Tight window = small cross-book exposure.
            let window: TimeInterval? = engine.captureMode == .sweep ? 2.5 : nil
            switch store.add(cn, hit: hit, mergeWindow: window) {
            case .added, .merged:
                feedback.accepted(result)
                flashNow(hit == nil ? .warning : .accepted)
            case .alreadyPresent:
                // Distinct feel: registered, but you already had it. Copies go through the
                // quantity stepper deliberately — see TripStore.add.
                feedback.duplicate()
                flashNow(.duplicate)
            }
            // Single-shot: one press, one book. Recognizer idles until the next press.
            if engine.captureMode == .single { engine.disarm() }
            UIAccessibility.post(notification: .announcement, argument: announcement(cn, hit))
        }
    }

    private func flashNow(_ state: FlashState) {
        guard !reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.12)) { flash = state }
        Task {
            try? await Task.sleep(for: .milliseconds(180))
            withAnimation(.easeIn(duration: 0.12)) { flash = nil }
        }
    }

    /// VoiceOver gets the same information the haptic carries, so eyes-off scanning works for
    /// low-vision users too — same goal, different modality.
    private func announcement(_ cn: CallNumber, _ hit: Router.Hit?) -> String {
        guard let hit else { return "\(cn.raw). Not in mapped ranges." }
        return "\(cn.raw). Level \(hit.level), shelf \(hit.shelfID), \(hit.side) side."
    }
}

/// The scan band, plus whatever Vision currently sees.
///
/// Deliberately *not* a box tracked to the text's bounding rect. Mapping Vision's normalized,
/// bottom-left, rotated coordinate space onto a `resizeAspectFill` preview layer is fiddly and
/// error-prone, and the payoff would be a box that jitters at 10fps. A steady frame plus a
/// readable chip communicates the same thing and is easier to read at arm's length.
struct ViewfinderOverlay: View {

    /// Normalized, bottom-left origin — the space Vision reports in and `ScanGeometry` computes
    /// in. This rect *is* the scanned region; see `ScanGeometry`.
    let band: CGRect
    let seeing: CallNumberRecognizer.Result?
    let flash: Color?

    var body: some View {
        GeometryReader { geo in
            let rect = viewRect(in: geo.size)

            ZStack {
                // Dim everything outside the scan band so the eye goes where the camera looks.
                Color.black.opacity(0.45)
                    .reverseMask {
                        RoundedRectangle(cornerRadius: Theme.radius)
                            .frame(width: rect.width, height: rect.height)
                            .position(x: rect.midX, y: rect.midY)
                    }

                RoundedRectangle(cornerRadius: Theme.radius)
                    .stroke(flash ?? strokeColor, lineWidth: flash != nil ? 4 : 2)
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)

                if let text = seeingText {
                    // Inside the band's lower edge, not below it. Drawn below, this chip landed
                    // on the shutter — the band now stops 16pt short of the button, which is not
                    // room for a chip and never will be.
                    Text(text)
                        .font(Theme.callNumber(14))
                        .foregroundStyle(Theme.paper)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(strokeColor.opacity(0.92), in: Capsule())
                        .position(x: rect.midX, y: rect.maxY - 24)
                        .transition(.opacity)
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var seeingText: String? {
        switch seeing {
        case let .located(cn, _): return cn.raw
        case let .unlocated(cn):  return cn.raw
        case nil:                 return nil
        }
    }

    private var strokeColor: Color {
        switch seeing {
        case .located:   return Theme.located
        case .unlocated: return Theme.unlocated
        case nil:        return Theme.paper.opacity(0.65)
        }
    }

    /// Vision's band is normalized with a bottom-left origin; SwiftUI is top-left. Flip y.
    private func viewRect(in size: CGSize) -> CGRect {
        CGRect(
            x: band.minX * size.width,
            y: (1 - band.maxY) * size.height,
            width: band.width * size.width,
            height: band.height * size.height
        )
    }
}

private extension View {
    /// Punch a hole in a shape — used for the viewfinder dim.
    func reverseMask<Mask: View>(@ViewBuilder _ mask: () -> Mask) -> some View {
        self.mask {
            Rectangle().overlay(alignment: .center) { mask().blendMode(.destinationOut) }
        }
    }
}
