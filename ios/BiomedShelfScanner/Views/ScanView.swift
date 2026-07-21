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
    @State private var showSheetScanner = false
    @State private var showRoute = false
    @State private var pendingImport: [(CallNumber, Router.Hit?)] = []

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
            case .duplicate: return Theme.accent
            case .warning:   return Theme.unlocated
            }
        }
    }

    var body: some View {
        ZStack {
            CameraPreview(session: engine.session)
                .ignoresSafeArea()

            ViewfinderOverlay(
                roi: engine.isPrecisionMode ? ScanEngine.precisionROI : ScanEngine.wideROI,
                seeing: seeing,
                flash: flash?.color
            )
            .ignoresSafeArea()

            VStack {
                topBar
                Spacer()
            }

            if let message = engine.errorMessage {
                cameraUnavailable(message)
            }
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
        .sheet(isPresented: .constant(true)) {
            TripSheet(
                router: router,
                onPlanRoute: { showRoute = true },
                onScanSheet: { showSheetScanner = true }
            )
            .presentationDetents([.height(104), .medium, .large])
            .presentationBackgroundInteraction(.enabled(upThrough: .medium))
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled()
        }
        .fullScreenCover(isPresented: $showRoute) {
            RouteView(route: store.route())
        }
        .fullScreenCover(isPresented: $showSheetScanner) {
            DocumentScanner(
                router: router,
                onFinish: { pendingImport = $0; showSheetScanner = false },
                onCancel: { showSheetScanner = false }
            )
            .ignoresSafeArea()
        }
        .sheet(isPresented: .init(get: { !pendingImport.isEmpty }, set: { if !$0 { pendingImport = [] } })) {
            SheetImportReview(found: pendingImport) { chosen in
                for (cn, hit) in chosen { store.add(cn, hit: hit) }
                pendingImport = []
            }
        }
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack(spacing: 12) {
            Button {
                engine.isPrecisionMode.toggle()
                engine.resetVoting()
            } label: {
                Label(
                    engine.isPrecisionMode ? "Precision" : "Wide",
                    systemImage: engine.isPrecisionMode ? "viewfinder.rectangular" : "viewfinder"
                )
                .font(.footnote.weight(.medium))
                .padding(.horizontal, 12)
                .frame(height: 44)
            }
            .accessibilityHint("Precision narrows the scan area to one label at a time, for tightly packed spines.")

            Spacer()

            if engine.hasTorch {
                Button {
                    engine.isTorchOn.toggle()
                } label: {
                    Image(systemName: engine.isTorchOn ? "bolt.fill" : "bolt.slash")
                        .font(.body.weight(.semibold))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel(engine.isTorchOn ? "Turn torch off" : "Turn torch on")
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 12)
        .background(.ultraThinMaterial.opacity(0.85), in: Capsule())
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func cameraUnavailable(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "camera.fill").font(.largeTitle)
            Text(message).multilineTextAlignment(.center)
            // Always give a path forward: the scanner is a convenience, the routing is the product.
            Text("You can still add call numbers by hand from the list below.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: 320)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
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

            let isNew = store.add(cn, hit: hit)
            if isNew {
                feedback.accepted(result)
                flashNow(hit == nil ? .warning : .accepted)
            } else {
                // Already on the trip — quantity bumped. Distinct feel so you know it registered
                // as a second copy rather than a missed scan.
                feedback.duplicate()
                flashNow(.duplicate)
            }
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

/// The ROI frame, plus whatever Vision currently sees.
///
/// Deliberately *not* a box tracked to the text's bounding rect. Mapping Vision's normalized,
/// bottom-left, rotated coordinate space onto a `resizeAspectFill` preview layer is fiddly and
/// error-prone, and the payoff would be a box that jitters at 10fps. A steady frame plus a
/// readable chip communicates the same thing and is easier to read at arm's length.
struct ViewfinderOverlay: View {

    let roi: CGRect
    let seeing: CallNumberRecognizer.Result?
    let flash: Color?

    var body: some View {
        GeometryReader { geo in
            let rect = viewRect(in: geo.size)

            ZStack {
                // Dim everything outside the scan band so the eye goes where the camera looks.
                Color.black.opacity(0.45)
                    .reverseMask {
                        RoundedRectangle(cornerRadius: 12).frame(width: rect.width, height: rect.height)
                            .position(x: rect.midX, y: rect.midY)
                    }

                RoundedRectangle(cornerRadius: 12)
                    .stroke(flash ?? strokeColor, lineWidth: flash != nil ? 4 : 2)
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)

                if let text = seeingText {
                    Text(text)
                        .font(Theme.callNumber(.callout))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(strokeColor.opacity(0.9), in: Capsule())
                        .position(x: rect.midX, y: rect.maxY + 28)
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
        case nil:        return .white.opacity(0.6)
        }
    }

    /// Vision ROI is normalized with a bottom-left origin; SwiftUI is top-left. Flip y.
    private func viewRect(in size: CGSize) -> CGRect {
        CGRect(
            x: roi.minX * size.width,
            y: (1 - roi.maxY) * size.height,
            width: roi.width * size.width,
            height: roi.height * size.height
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
