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

    func setRegionOfInterest(_ roi: CGRect) { request.regionOfInterest = roi }
    func reset() { voter.reset() }

    /// Returns nil when the frame was throttled away.
    func process(_ pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) -> Outcome? {
        let now = Date()
        guard now.timeIntervalSince(lastProcessed) >= minFrameInterval else { return nil }
        lastProcessed = now

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation)
        do { try handler.perform([request]) } catch { return .nothing }

        guard let observations = request.results, !observations.isEmpty else {
            voter.miss()
            return .nothing
        }

        // Diagnostics is per-FRAME, not per-observation. A frame showing a book cover carries
        // many text observations (title words, publisher, shelf signs); recording each failure
        // separately encoded a JPEG per observation at 10fps and wrapped the 500-record ring
        // buffer in under a minute — evicting exactly the failures worth keeping. Accumulate,
        // then record one verdict for the whole frame.
        var frameCandidates: [(text: String, confidence: Float)] = []

        for observation in observations {
            // Ranked candidates. Taking only topCandidates(1) throws away the whole advantage of
            // knowing what a call number looks like — see CallNumberRecognizer.
            let candidates = observation.topCandidates(5).map { ($0.string, $0.confidence) }
            guard let result = recognizer.resolve(candidates: candidates) else {
                frameCandidates.append(contentsOf: candidates)
                continue
            }

            let key: String
            switch result {
            case let .located(cn, _): key = cn.raw.uppercased()
            case let .unlocated(cn):  key = cn.raw.uppercased()
            }
            let accepted = voter.consider(key)
            diagnose(candidates, result: result, accepted: accepted, pixelBuffer: pixelBuffer)
            return accepted ? .accepted(result) : .seeing(result)
        }

        // Vision saw text but nothing in the frame survived the pipeline. One record — this is
        // the bucket that distinguishes "bad read" from "good read, bad grammar".
        if !frameCandidates.isEmpty {
            diagnose(Array(frameCandidates.prefix(10)), result: nil, accepted: false, pixelBuffer: pixelBuffer)
        }
        voter.miss()
        return .nothing
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
        let extracted = candidates.flatMap { CallNumberRecognizer.extract(from: $0.text) }
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

    /// Narrows recognition to a centred band. Tight spines sit millimetres apart, so a wide ROI
    /// will happily read the neighbour's label. Vision's space is normalized with a **bottom-left
    /// origin**, relative to the *rotated* image.
    var isPrecisionMode = false {
        didSet { processor.setRegionOfInterest(isPrecisionMode ? Self.precisionROI : Self.wideROI) }
    }

    static let wideROI = CGRect(x: 0.0, y: 0.25, width: 1.0, height: 0.5)
    static let precisionROI = CGRect(x: 0.15, y: 0.40, width: 0.7, height: 0.2)

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
        processor.setRegionOfInterest(Self.wideROI)
        processor.isDiagnosing = ScanDiagnostics.shared.isRecording
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
