import AVFoundation
import CoreImage
import Observation
import UIKit
import Vision

/// Runs Vision over camera frames. Lives entirely on the capture queue.
///
/// Split out from `ScanEngine` so the Vision request, the recognizer, the voter and the frame
/// throttle are owned by exactly one serial queue and never touched from the main actor.
/// `@unchecked Sendable` is a considered claim rather than a shrug: `AVCaptureVideoDataOutput`
/// delivers to a single serial queue, so every access below is serialized by construction.
final class FrameProcessor: @unchecked Sendable {

    enum Outcome {
        case accepted(CallNumberRecognizer.Result)
        case seeing(CallNumberRecognizer.Result)
        case nothing
    }

    private let recognizer: CallNumberRecognizer
    private let voter = StabilityVoter()
    private let request: VNRecognizeTextRequest

    /// Vision at `.accurate` on every frame would drain the battery for nothing — labels don't
    /// move at 60fps. ~10fps is past the point of diminishing returns.
    private let minFrameInterval: TimeInterval = 0.1
    private var lastProcessed = Date.distantPast

    init(router: Router) {
        self.recognizer = CallNumberRecognizer(router: router)
        let r = VNRecognizeTextRequest()
        r.recognitionLevel = .accurate
        r.recognitionLanguages = ["en-US"]
        // NON-NEGOTIABLE. "NA388" is not an English word. With correction on, Vision bends call
        // numbers toward real words and silently destroys them. See DESIGN.md §3.1.
        r.usesLanguageCorrection = false
        self.request = r
    }

    /// The scan band, in **upright portrait** normalized coordinates (bottom-left origin) — the
    /// same space the viewfinder overlay draws in.
    ///
    /// Deliberately NOT `request.regionOfInterest`. That property crops the raw buffer, which is
    /// landscape (pre-rotation), so a rect that looks right on the portrait screen selects a
    /// different region of the sensor — the guide box and the scanned area silently disagree.
    /// Instead we OCR the full frame and filter observations by bounding box: with an
    /// orientation supplied to the handler, observation boxes come back in upright space, which
    /// is exactly the overlay's space. What you see is what gets scanned, by construction.
    private var band = CGRect(x: 0, y: 0.25, width: 1, height: 0.5)

    func setBand(_ rect: CGRect) { band = rect }
    func reset() { voter.reset() }

    /// When false, frames are dropped before Vision runs. Single-shot mode leaves the preview
    /// live but the recognizer idle between button presses — no battery spent OCRing a viewfinder
    /// nobody has armed. Same benign-race contract as `isDiagnosing`.
    var isActive = true

    // MARK: Preprocessing variants

    /// Journal labels come in every combination the bindery had in stock — white on red, gold on
    /// green, white on blue — and Vision's luminance view of those is low-contrast mush. But in
    /// the right single channel they snap to near-B/W: white text on red is dark-vs-bright in the
    /// GREEN channel; gold on green is brightest in RED. Pencil benefits from the plain
    /// contrast-boosted grays.
    ///
    /// Strategy is hunt-and-stick: try one variant per frame, round-robin while nothing reads,
    /// stay put as soon as one produces. Costs nothing when the plain image works (index 0), and
    /// at 10fps a full cycle is under a second of hunting. `StabilityVoter.missTolerance` exists
    /// precisely so this cycling doesn't wipe the vote count between hits.
    private enum Variant: CaseIterable {
        case plain, gray, grayInverted
        case red, green, blue
        case redInverted, greenInverted, blueInverted
    }
    private var variantIndex = 0

    private func enhance(_ image: CIImage, _ v: Variant) -> CIImage {
        func mono(_ x: CGFloat, _ y: CGFloat, _ z: CGFloat, inverted: Bool) -> CIImage {
            let vec = CIVector(x: x, y: y, z: z, w: 0)
            var out = image.applyingFilter("CIColorMatrix", parameters: [
                "inputRVector": vec, "inputGVector": vec, "inputBVector": vec,
            ])
            out = out.applyingFilter("CIColorControls", parameters: [kCIInputContrastKey: 1.4])
            return inverted ? out.applyingFilter("CIColorInvert") : out
        }
        switch v {
        case .plain:
            return image
        case .gray, .grayInverted:
            var out = image.applyingFilter("CIColorControls", parameters: [
                kCIInputSaturationKey: 0, kCIInputContrastKey: 1.5,
            ])
            if v == .grayInverted { out = out.applyingFilter("CIColorInvert") }
            return out
        case .red, .redInverted:
            return mono(1, 0, 0, inverted: v == .redInverted)
        case .green, .greenInverted:
            return mono(0, 1, 0, inverted: v == .greenInverted)
        case .blue, .blueInverted:
            return mono(0, 0, 1, inverted: v == .blueInverted)
        }
    }

    /// Advance the hunt on a fruitless frame; success leaves the index where it is.
    private func nextVariant() {
        variantIndex = (variantIndex + 1) % Variant.allCases.count
    }

    /// Returns nil when the frame was throttled away or scanning is not armed.
    func process(_ pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) -> Outcome? {
        guard isActive else { return nil }
        let now = Date()
        guard now.timeIntervalSince(lastProcessed) >= minFrameInterval else { return nil }
        lastProcessed = now

        let base = CIImage(cvPixelBuffer: pixelBuffer)
        let variant = Variant.allCases[variantIndex]
        let handler = VNImageRequestHandler(ciImage: enhance(base, variant), orientation: orientation)
        do { try handler.perform([request]) } catch { nextVariant(); return .nothing }

        let inBand = (request.results ?? []).filter {
            band.contains(CGPoint(x: $0.boundingBox.midX, y: $0.boundingBox.midY))
        }
        guard !inBand.isEmpty else {
            nextVariant()
            voter.miss()
            return .nothing
        }

        // THE load-bearing step, learned from the first field build scanning nothing at all:
        // Vision emits ONE OBSERVATION PER LINE. A spine label is stacked one token per line
        // ("Biomed" / "W1" / "NA388" / "no.66" / "1984"), so no single observation ever contains
        // a whole call number — resolving observations independently can never succeed. The
        // label must be reassembled top-to-bottom first. (Bounding boxes are bottom-left origin,
        // so "top of the frame" means larger midY.)
        let lines = inBand
            .sorted { $0.boundingBox.midY > $1.boundingBox.midY }
            .prefix(8)
            .map { $0.topCandidates(3) }
            .filter { !$0.isEmpty }

        let topTexts = lines.compactMap { $0.first?.string }
        let confidences = lines.compactMap { $0.first?.confidence }
        // Mean, not min: one glare-hit line shouldn't gate away an otherwise solid label.
        let joinedConfidence = confidences.isEmpty
            ? Float(0) : confidences.reduce(0, +) / Float(confidences.count)

        var candidates: [(text: String, confidence: Float)] = [
            (topTexts.joined(separator: "\n"), joinedConfidence)
        ]
        // Ranked variants: swap ONE line at a time for its 2nd/3rd read, others stay at top-1.
        // Keeps the constrained-decoding advantage for whichever single line OCR fumbled.
        for (i, lineCandidates) in lines.enumerated() {
            for alt in lineCandidates.dropFirst() {
                var parts = topTexts
                parts[i] = alt.string
                candidates.append((parts.joined(separator: "\n"), alt.confidence))
            }
        }
        // Single-line fallback: request slips and flat labels carry the whole call number in one
        // observation, and joining them with unrelated neighbours could bury it.
        for line in lines {
            candidates.append(contentsOf: line.map { ($0.string, $0.confidence) })
        }

        guard let result = recognizer.resolve(candidates: candidates) else {
            // One diagnostic record per FRAME (not per observation — that encoded a JPEG per
            // title-word at 10fps and wrapped the ring buffer in a minute). This bucket is what
            // separates "Vision misread it" from "good read, grammar rejected it".
            diagnose(Array(candidates.prefix(10)), result: nil, accepted: false, pixelBuffer: pixelBuffer)
            nextVariant()
            voter.miss()
            return .nothing
        }

        let key: String
        switch result {
        case let .located(cn, _): key = cn.raw.uppercased()
        case let .unlocated(cn):  key = cn.raw.uppercased()
        }
        // Volume-less reads earn acceptance more slowly. No trailing NO./year token usually
        // means the label's volume lines haven't assembled yet — 5 frames instead of 3 gives the
        // full text a half-second to out-vote the partial. Costs 0.2s on books that genuinely
        // have no volume; prevents most partial rows (the input to every merge hazard).
        // `V.` and `PT.` belong here for the same reason `NO.` does: they are volume tokens, and a
        // read that has one has assembled. Without them a v.-numbered spine took 5 frames to
        // accept where an identically complete no.-numbered one took 3.
        let hasTrail = key.range(
            of: #"((NO|V|PT)\.?\s?\d|(18|19|20)\d{2})"#, options: .regularExpression) != nil
        let accepted = voter.consider(key, required: hasTrail ? 3 : 5)
        diagnose(Array(candidates.prefix(10)), result: result, accepted: accepted, pixelBuffer: pixelBuffer)
        return accepted ? .accepted(result) : .seeing(result)
    }

    /// Fire-and-forget hop to the diagnostics recorder. Cheap when recording is off — the JPEG is
    /// only encoded for frames that failed, and only while capturing.
    private func diagnose(
        _ candidates: [(text: String, confidence: Float)],
        result: CallNumberRecognizer.Result?,
        accepted: Bool,
        pixelBuffer: CVPixelBuffer
    ) {
        guard isDiagnosing else { return }
        // Both readings, so a corpus shows whether a frame failed before or after O/0 restoration
        // — the difference between "Vision misread it" and "the repair did not fire".
        let extracted = candidates.flatMap { c in
            CallNumberRecognizer.readings(of: c.text).flatMap(CallNumberRecognizer.matches(in:))
        }
        var frame: Data?
        if result == nil || !accepted {
            frame = Self.jpeg(from: pixelBuffer)
        }
        Task { @MainActor in
            ScanDiagnostics.shared.record(
                candidates: candidates, extracted: extracted,
                result: result, accepted: accepted, frame: frame
            )
        }
    }

    /// Mirrors `ScanDiagnostics.isRecording`, cached here so the capture queue never has to read
    /// main-actor state per frame.
    var isDiagnosing = false

    private static func jpeg(from buffer: CVPixelBuffer, quality: CGFloat = 0.5) -> Data? {
        let ci = CIImage(cvPixelBuffer: buffer)
        let ctx = CIContext()
        guard let cg = ctx.createCGImage(ci, from: ci.extent) else { return nil }
        return UIImage(cgImage: cg, scale: 1, orientation: .right).jpegData(compressionQuality: quality)
    }
}

/// Owns the capture-queue side of the pipeline.
///
/// Kept separate from `ScanEngine` on purpose. `ScanEngine` is `@MainActor` (it drives
/// `@Observable` UI state), and a `@MainActor` type cannot cleanly host a delegate callback that
/// must run on the video queue. Splitting the delegate out means no part of this file has to
/// argue with the isolation checker.
private final class VideoDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {

    private let processor: FrameProcessor
    private let onOutcome: @Sendable (FrameProcessor.Outcome) -> Void

    init(processor: FrameProcessor, onOutcome: @escaping @Sendable (FrameProcessor.Outcome) -> Void) {
        self.processor = processor
        self.onOutcome = onOutcome
    }

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        // Serial video queue. Frame throttling lives in the processor.
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer),
              // Camera sensor is landscape-right relative to a portrait-locked UI.
              let outcome = processor.process(pixelBuffer, orientation: .right)
        else { return }
        onOutcome(outcome)
    }
}

/// Live camera → Vision → resolved call numbers.
@Observable
@MainActor
final class ScanEngine {

    enum Event {
        /// Committed to the trip.
        case accepted(CallNumberRecognizer.Result)
        /// Live preview only — what Vision currently sees. Not committed.
        case seeing(CallNumberRecognizer.Result)
        case cleared
    }

    // MARK: Observable state

    private(set) var isRunning = false
    private(set) var hasTorch = false
    var errorMessage: String?

    var isTorchOn = false {
        didSet { setTorch(isTorchOn) }
    }

    /// Narrows the scan band to one spine.
    ///
    /// The band itself is not stored here. It depends on the screen and its safe areas, which
    /// only the view knows, so `ScanView` computes it with `ScanGeometry` and pushes it in
    /// through `setBand` — the same rect it draws. See `ScanGeometry` for why the band is derived
    /// from the control layout rather than being a constant.
    var isPrecisionMode = false

    // MARK: Capture mode

    /// Field revision of the original zero-tap design. Continuous capture files partial re-reads
    /// of one book as separate entries; a trip list that needs de-duplicating costs more trust
    /// than a button press costs time. Default is now single-shot: arm → first accepted read →
    /// recognizer idles. Sweep keeps continuous capture for running a whole truck shelf.
    enum CaptureMode: String {
        case single, sweep
    }

    var captureMode: CaptureMode = .single {
        didSet { syncActive() }
    }

    /// Armed = the recognizer is live and hunting. Always true in sweep mode; in single mode,
    /// true only between a button press and the next accepted read.
    private(set) var isArmed = false

    func arm() {
        isArmed = true
        processor.reset()   // fresh votes — don't inherit half-votes from the previous book
        syncActive()
    }

    func disarm() {
        isArmed = false
        syncActive()
    }

    private func syncActive() {
        processor.isActive = captureMode == .sweep || isArmed
    }

    /// The band the recognizer filters observations by, in upright portrait normalized
    /// coordinates. Set by the view from `ScanGeometry` — see `isPrecisionMode`.
    func setBand(_ rect: CGRect) { processor.setBand(rect) }

    /// Set by the view. Called on the main actor.
    var onEvent: ((Event) -> Void)?

    // MARK: Internals

    let session = AVCaptureSession()
    private let videoQueue = DispatchQueue(label: "scanner.video", qos: .userInitiated)
    private let output = AVCaptureVideoDataOutput()
    private let processor: FrameProcessor
    private var delegate: VideoDelegate?
    private var device: AVCaptureDevice?
    private var configured = false

    init(router: Router) {
        self.processor = FrameProcessor(router: router)
        // A placeholder only, and it lasts one layout pass: ScanView pushes the real band as soon
        // as it can measure the screen. FrameProcessor's own default is the same rect.
        processor.setBand(CGRect(x: 0, y: 0.25, width: 1, height: 0.5))
        processor.isDiagnosing = ScanDiagnostics.shared.isRecording
        syncActive()   // default single-shot: recognizer idle until the button arms it
    }

    /// Called when the diagnostics toggle changes, so the capture queue doesn't have to poll.
    func setDiagnosing(_ on: Bool) {
        processor.isDiagnosing = on
    }

    // MARK: Session control

    func start() async {
        guard await AVCaptureDevice.requestAccess(for: .video) else {
            errorMessage = "Camera access is off. Turn it on in Settings to scan call numbers."
            return
        }
        do {
            try configureIfNeeded()
        } catch {
            errorMessage = "No usable camera on this device."
            return
        }
        guard !session.isRunning else { isRunning = true; return }
        let session = self.session
        await Task.detached(priority: .userInitiated) { session.startRunning() }.value
        isRunning = true
        // Scanning is an eyes-off activity — the user is looking at book spines, not the screen,
        // so nothing resets the system idle timer. Without this the phone dims and locks in the
        // middle of a truck. Restored in stop(), which also runs on backgrounding.
        UIApplication.shared.isIdleTimerDisabled = true
    }

    func stop() {
        if isTorchOn { isTorchOn = false }
        UIApplication.shared.isIdleTimerDisabled = false
        guard session.isRunning else { return }
        let session = self.session
        Task.detached(priority: .userInitiated) { session.stopRunning() }
        isRunning = false
    }

    func resetVoting() { processor.reset() }

    private func configureIfNeeded() throws {
        guard !configured else { return }
        session.beginConfiguration()
        defer { session.commitConfiguration() }

        session.sessionPreset = .hd1920x1080

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input)
        else { throw ScanError.noCamera }
        session.addInput(input)
        self.device = device
        self.hasTorch = device.hasTorch

        // Spine labels are small and close. Let the lens get near them and keep hunting.
        try? device.lockForConfiguration()
        if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
        if device.isAutoFocusRangeRestrictionSupported { device.autoFocusRangeRestriction = .near }
        if device.isSmoothAutoFocusSupported { device.isSmoothAutoFocusEnabled = true }
        device.unlockForConfiguration()

        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true

        // The delegate hops back to the main actor; the engine only ever publishes from there.
        let d = VideoDelegate(processor: processor) { [weak self] outcome in
            Task { @MainActor in
                guard let self else { return }
                switch outcome {
                case let .accepted(r): self.onEvent?(.accepted(r))
                case let .seeing(r):   self.onEvent?(.seeing(r))
                case .nothing:         self.onEvent?(.cleared)
                }
            }
        }
        self.delegate = d
        output.setSampleBufferDelegate(d, queue: videoQueue)

        guard session.canAddOutput(output) else { throw ScanError.noCamera }
        session.addOutput(output)

        configured = true
    }

    private func setTorch(_ on: Bool) {
        // The lower stacks are dim. This is a functional control, not a nicety.
        guard let device, device.hasTorch, device.isTorchAvailable else { return }
        try? device.lockForConfiguration()
        device.torchMode = on ? .on : .off
        device.unlockForConfiguration()
    }

    enum ScanError: Error { case noCamera }
}

// MARK: - Haptics

/// Distinct haptics for located vs not-located is what lets you keep your eyes on the books
/// instead of the screen — you feel the difference without looking. That is the entire ergonomic
/// premise of this app (DESIGN.md §1), so it gets its own type rather than being sprinkled
/// through views.
@MainActor
final class ScanFeedback {

    private let notify = UINotificationFeedbackGenerator()
    private let impact = UIImpactFeedbackGenerator(style: .medium)

    func prepare() {
        notify.prepare()
        impact.prepare()
    }

    func accepted(_ result: CallNumberRecognizer.Result) {
        switch result {
        case .located:   notify.notificationOccurred(.success)
        case .unlocated: notify.notificationOccurred(.warning)
        }
        notify.prepare()
    }

    /// A book already on the trip — quantity bumped rather than added.
    func duplicate() {
        impact.impactOccurred()
        impact.prepare()
    }
}
