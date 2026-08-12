import AVFoundation
import CoreHaptics
import Observation
import UIKit

/// The feel of the counting surface.
///
/// Every action answers on two channels, because this is used with the phone at your side rather
/// than in front of your face, and because a library is quiet enough that sound alone is rude and
/// loud enough that vibration alone gets missed.
///
/// **The patterns are the design, not the tones.** With sound off the buzz is the whole signal, so
/// no two share a shape: length carries size, and a double never means the same kind of thing as
/// a single. Forward and back differed only in pitch in an early draft, which made them identical
/// in a silent room.
///
/// ## What this port gets that the web version could not have
///
/// Safari implements no Vibration API on iOS, so `better_headcount` reproduces haptics by
/// script-clicking a hidden `<input type="switch">` — one fixed tap, no duration, no intensity,
/// and later taps in a pattern fall outside Safari's transient activation and are dropped, so a
/// multi-pulse pattern collapses to its first pulse. Apple then closed script-triggered toggles
/// in iOS 26.5, and feature detection cannot see that, so on a current phone the web version has
/// no haptics at all and the tone is the only channel.
///
/// A native app has Core Haptics. The vocabulary below is the same vocabulary — deliberately, so
/// muscle memory transfers between the two tools — but here the patterns actually play, in full,
/// with real durations and intensities, on every device that has the Taptic Engine.
@Observable
@MainActor
final class HeadcountFeedback {

    /// The seven answers. Same names, same meanings, same rhythms as `better_headcount`.
    enum Event {
        /// A finger landed on a control.
        case press
        /// One more.
        case add
        /// One fewer.
        case subtract
        /// Forward a stop.
        case next
        /// Back a stop.
        case back
        /// No — clamped, locked, or the end of the route.
        case refused
        /// The last stop.
        case finished

        /// Milliseconds, on/off alternating — the same arrays the web version vibrates with.
        var pattern: [Int] {
            switch self {
            case .press:     return [7]
            case .add:       return [15]
            case .subtract:  return [12, 60, 12]
            case .next:      return [34]
            case .back:      return [12, 45, 34]
            case .refused:   return [55, 45, 55]
            case .finished:  return [20, 50, 20, 50, 95]
            }
        }

        /// Hertz. Carries the same distinction the pattern does, for anyone working with sound on.
        var tone: Double {
            switch self {
            case .press:    return 1046
            case .add:      return 880
            case .subtract: return 440
            case .next:     return 660
            case .back:     return 494
            case .refused:  return 196
            case .finished: return 1174
            }
        }

        var intensity: Float {
            switch self {
            case .press:    return 0.35
            case .add:      return 0.6
            case .next:     return 0.75
            case .subtract, .back: return 0.55
            case .refused:  return 1.0
            case .finished: return 0.9
            }
        }
    }

    /// One tap to mute, and it persists. This is a library.
    var isSoundOn: Bool {
        didSet { UserDefaults.standard.set(isSoundOn, forKey: Self.soundKey) }
    }
    private static let soundKey = "headcount.sound"

    private var engine: CHHapticEngine?
    private let notify = UINotificationFeedbackGenerator()
    private let impact = UIImpactFeedbackGenerator(style: .medium)
    private let light = UIImpactFeedbackGenerator(style: .light)

    private var audio: AVAudioEngine?
    private var player: AVAudioPlayerNode?

    init() {
        isSoundOn = UserDefaults.standard.object(forKey: Self.soundKey) as? Bool ?? true
    }

    func prepare() {
        notify.prepare()
        impact.prepare()
        light.prepare()
        startHaptics()
        startAudio()
    }

    func fire(_ event: Event) {
        haptic(event)
        if isSoundOn { tone(event) }
    }

    // MARK: Haptics

    private func startHaptics() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics, engine == nil else { return }
        engine = try? CHHapticEngine()
        // The engine is stopped whenever the app is backgrounded or another app takes the
        // hardware. Without this the first tap after coming back is silent — and a silent tap is
        // exactly the thing the vocabulary exists to prevent.
        engine?.resetHandler = { [weak self] in try? self?.engine?.start() }
        engine?.stoppedHandler = { _ in }
        try? engine?.start()
    }

    private func haptic(_ event: Event) {
        guard let engine else { return fallbackHaptic(event) }

        var events: [CHHapticEvent] = []
        var t: TimeInterval = 0
        for (i, ms) in event.pattern.enumerated() {
            let seconds = Double(ms) / 1000
            if i % 2 == 0 {
                events.append(CHHapticEvent(
                    eventType: .hapticContinuous,
                    parameters: [
                        .init(parameterID: .hapticIntensity, value: event.intensity),
                        .init(parameterID: .hapticSharpness, value: 0.7),
                    ],
                    relativeTime: t,
                    duration: max(seconds, 0.012)
                ))
            }
            t += seconds
        }
        guard let pattern = try? CHHapticPattern(events: events, parameters: []),
              let player = try? engine.makePlayer(with: pattern)
        else { return fallbackHaptic(event) }
        try? player.start(atTime: 0)
    }

    /// Devices without Core Haptics (and the Simulator) still get *something* distinguishable —
    /// less expressive, but the distinction between "counted" and "refused" survives, and that is
    /// the one that matters.
    private func fallbackHaptic(_ event: Event) {
        switch event {
        case .press:                notify.prepare(); light.impactOccurred()
        case .add, .next:           impact.impactOccurred()
        case .subtract, .back:      light.impactOccurred()
        case .refused:              notify.notificationOccurred(.error)
        case .finished:             notify.notificationOccurred(.success)
        }
    }

    // MARK: Tone

    private func startAudio() {
        guard audio == nil else { return }
        // `.ambient` so the tones respect the silent switch and never interrupt anything the
        // walker is already listening to. The haptics fire either way.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)

        let e = AVAudioEngine()
        let p = AVAudioPlayerNode()
        e.attach(p)
        e.connect(p, to: e.mainMixerNode, format: nil)
        try? e.start()
        audio = e
        player = p
    }

    private func tone(_ event: Event) {
        guard let audio, let player else { return }
        if !audio.isRunning { try? audio.start() }

        let format = audio.mainMixerNode.outputFormat(forBus: 0)
        let rate = format.sampleRate
        // Long enough to have a pitch, short enough not to trail into the next tap.
        let frames = AVAudioFrameCount(rate * 0.06)
        guard frames > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames)
        else { return }
        buffer.frameLength = frames

        let step = 2 * Double.pi * event.tone / rate
        for channel in 0..<Int(format.channelCount) {
            guard let data = buffer.floatChannelData?[channel] else { continue }
            for i in 0..<Int(frames) {
                // Raised-cosine envelope. A bare sine clicks at both ends, and a click is a
                // sound the vocabulary does not have a meaning for.
                let progress = Double(i) / Double(frames)
                let envelope = 0.5 * (1 - cos(2 * Double.pi * min(progress, 1)))
                data[i] = Float(sin(step * Double(i)) * envelope * 0.25)
            }
        }
        player.scheduleBuffer(buffer, at: nil, options: .interrupts)
        player.play()
    }
}
