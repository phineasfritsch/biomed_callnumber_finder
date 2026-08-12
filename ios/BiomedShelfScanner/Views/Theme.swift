import SwiftUI

/// Design tokens — **copied from Shelfmark, not re-derived.**
///
/// Shelfmark (the website), Headcount (the web tool) and this app are one visual system. The
/// token block below is the same one that appears in `site.css` and `better_headcount/styles.css`
/// under `:root`. If a value changes it changes in all three, or the tools stop looking related.
/// See `better_headcount/DESIGN.md`.
///
/// This replaced the app's original "chrome goes native" position. That was a defensible choice
/// on its own terms — system controls are free and always current — but it made the app the odd
/// one out in a family of three tools used by the same people in the same building on the same
/// shift. Recognisability won.
enum Theme {

    // MARK: Palette

    /// Warm paper, the page ground.
    static let paper = Color(hex: 0xF3EFE4)
    /// The texture dot, and the ground for recessed areas.
    static let paper2 = Color(hex: 0xECE6D6)
    /// Every card, sheet and row sits on this.
    static let card = Color(hex: 0xFBF9F3)

    static let ink = Color(hex: 0x26221A)
    static let inkSoft = Color(hex: 0x6B6353)
    static let inkFaint = Color(hex: 0x9A9080)
    /// Hairline borders. Never a system separator — those are grey and read as cold here.
    static let line = Color(hex: 0xD8CFBA)

    static let green = Color(hex: 0x5B7D3A)
    static let greenSoft = Color(hex: 0xDDE7CB)
    static let orange = Color(hex: 0xC66A25)
    static let orangeSoft = Color(hex: 0xF3DDC6)
    static let slate = Color(hex: 0x6A7080)
    static let slateSoft = Color(hex: 0xCDD2DC)

    /// Destructive and blocking. Shelfmark's `--accent`.
    static let accent = Color(hex: 0x7A2E1E)
    static let good = Color(hex: 0x3B6D3B)
    static let hi = Color(hex: 0x1D9E75)

    /// Corner radius. One value, everywhere. Shelfmark's `--r`.
    static let radius: CGFloat = 12

    // MARK: Status

    /// Located / not located. These are the same green and orange as the shelf groups, which is
    /// deliberate: on the floor map, green already means "this is the shelf you want".
    static let located = green
    static let unlocated = orange

    /// Shelf group colours, carried over from the web locator so the floor map stays recognisable
    /// to anyone who used it. These are *semantic* — they identify shelf groups — so unlike the
    /// chrome they were never up for redesign.
    enum ShelfGroup {
        static let green = Theme.green
        static let orange = Theme.orange
        static let char = Color(hex: 0x3A3631)
        static let slate = Theme.slate
    }

    /// Where a stop sits in the walk, as colour.
    ///
    /// A number badge is exact but only if you read every badge; the ramp gives you the *shape* of
    /// the walk at a glance — where it starts, which way it sweeps, how far it has to go. Both are
    /// drawn, and neither is load-bearing alone: colour-blind readers keep the numbers.
    ///
    /// Cool to warm, four anchors, matching the web app exactly. A single-hue light-to-dark ramp
    /// loses its middle at this size, and "blue is early, red is late" is the one ramp convention
    /// nobody has to be taught. The anchors sit in a narrow luminance band so white badge text
    /// stays legible at every position.
    private static let ramp: [(Double, Double, Double)] = [
        (3, 105, 161), (46, 125, 91), (198, 138, 30), (179, 64, 26),
    ]

    static func order(_ i: Int, of n: Int) -> Color {
        func rgb(_ c: (Double, Double, Double)) -> Color {
            Color(red: c.0 / 255, green: c.1 / 255, blue: c.2 / 255)
        }
        guard n > 1 else { return rgb(ramp[0]) }
        let t = Double(min(max(i, 0), n - 1)) / Double(n - 1)
        let span = Double(ramp.count - 1)
        let seg = min(Int(t * span), ramp.count - 2)
        let f = t * span - Double(seg)
        let a = ramp[seg], b = ramp[seg + 1]
        return rgb((a.0 + (b.0 - a.0) * f, a.1 + (b.1 - a.1) * f, a.2 + (b.2 - a.2) * f))
    }

    /// The same colours the web map paints unvisited stacks in.
    static func shelfGroup(_ g: Router.Shelf.Group, soft: Bool) -> Color {
        let c: Color
        switch g {
        case .green:  c = ShelfGroup.green
        case .orange: c = ShelfGroup.orange
        case .char:   c = ShelfGroup.char
        case .slate:  c = ShelfGroup.slate
        }
        return soft ? c.opacity(0.22) : c
    }

    // MARK: Motion

    /// One spring for the whole app. Unifying the rhythm is most of what makes motion feel
    /// designed rather than assembled.
    static let spring = Animation.spring(response: 0.3, dampingFraction: 0.8)

    // MARK: Type

    /// Bundled with the app (`Resources/Fonts`, listed in `UIAppFonts`) rather than fetched, so
    /// the app is still itself in a basement with no signal — which is where it is used.
    ///
    /// These are static instances built by `ios/Tools/make-fonts.py`. Fraunces' *variable*
    /// default instance is Black at 9pt optical size, so registering the variable file and asking
    /// for "Fraunces" would render every heading in the app as a heavy caption face.
    enum FontName {
        static let display = "Fraunces-SemiBold"
        static let displayMedium = "Fraunces-Medium"
        static let displayRegular = "Fraunces-Regular"
        static let mono = "SplineSansMono-Regular"
        static let monoMedium = "SplineSansMono-Medium"
        static let monoSemi = "SplineSansMono-SemiBold"
    }

    /// Page titles, panel headings, big numbers. Shelfmark uses Fraunces 600 for exactly these
    /// and nothing else.
    ///
    /// `relativeTo:` is what keeps Dynamic Type working with a custom face — without it the size
    /// is frozen and the app fails at the largest accessibility sizes.
    static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .headline) -> Font {
        .custom(FontName.display, size: size, relativeTo: style)
    }

    /// Everything else. Shelfmark is a monospaced interface end to end — 13px base — and that is
    /// not a stylistic tic here: the content is call numbers, shelf ids and counts, all of which
    /// are read character by character.
    static func mono(_ size: CGFloat, relativeTo style: Font.TextStyle = .body,
                     weight: MonoWeight = .regular) -> Font {
        .custom(weight.name, size: size, relativeTo: style)
    }

    enum MonoWeight {
        case regular, medium, semibold
        var name: String {
            switch self {
            case .regular:  return FontName.mono
            case .medium:   return FontName.monoMedium
            case .semibold: return FontName.monoSemi
            }
        }
    }

    /// Call numbers are **always** monospaced. They are identifiers packed with ambiguous glyphs
    /// (O/0, I/1, S/5); proportional type makes them genuinely harder to verify, and verification
    /// is the human's job here. The whole app being mono does not make this redundant — call
    /// numbers additionally get tabular figures so they align down a column.
    static func callNumber(_ size: CGFloat = 15) -> Font {
        mono(size, relativeTo: .body, weight: .medium)
    }

    /// The uppercase micro-label Shelfmark uses above every panel.
    static func micro(_ size: CGFloat = 10) -> Font {
        mono(size, relativeTo: .caption2, weight: .semibold)
    }
}

// MARK: - Surfaces

/// The page ground, texture and all.
///
/// The dot grid is `radial-gradient(var(--paper-2) .5px, transparent .5px)` at 14px on the web.
/// Drawn here with a tiled `Canvas` rather than an image so it stays crisp at every scale and
/// costs no asset. It is the single strongest cue that this is the same product as the website.
struct PaperBackground: View {
    var body: some View {
        Theme.paper.overlay {
            Canvas { ctx, size in
                let step: CGFloat = 14
                var y: CGFloat = 0
                while y < size.height {
                    var x: CGFloat = 0
                    while x < size.width {
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: x, y: y, width: 1, height: 1)),
                            with: .color(Theme.paper2)
                        )
                        x += step
                    }
                    y += step
                }
            }
            .accessibilityHidden(true)
        }
        .ignoresSafeArea()
    }
}

/// A hairline card on `--card` with a `--line` border. Every surface in Shelfmark is this.
struct Card: ViewModifier {
    var padding: CGFloat = 12
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.radius))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.radius).strokeBorder(Theme.line, lineWidth: 1)
            }
    }
}

extension View {
    func card(padding: CGFloat = 12) -> some View { modifier(Card(padding: padding)) }

    /// Paper ground behind a `List`/`Form`, with the system's own background removed.
    ///
    /// Without `scrollContentBackground(.hidden)` the system grouped background paints over the
    /// paper and the app is half Shelfmark, half iOS grey.
    func paperScroll() -> some View {
        self.scrollContentBackground(.hidden).background(PaperBackground())
    }
}

// MARK: - Controls

/// `.btn` — solid ink, paper text. The one primary action on a screen.
struct ShelfButton: ButtonStyle {
    enum Kind { case solid, ghost, danger }
    var kind: Kind = .solid
    /// Full-width buttons are the norm on the counting screens; inline ones are not.
    var wide = false

    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.mono(14, relativeTo: .body, weight: .semibold))
            .foregroundStyle(foreground)
            .frame(maxWidth: wide ? .infinity : nil, minHeight: 48)
            .padding(.horizontal, 16)
            .background(background(configuration.isPressed), in: RoundedRectangle(cornerRadius: Theme.radius))
            .overlay {
                RoundedRectangle(cornerRadius: Theme.radius)
                    .strokeBorder(kind == .ghost ? Theme.line : .clear, lineWidth: 1)
            }
            // Colour only. A transform would move the target under a thumb already on its way
            // back down for the next tap — the same rule Headcount's walk mode is built on.
            .opacity(isEnabled ? 1 : 0.45)
            .animation(Theme.spring, value: configuration.isPressed)
    }

    private var foreground: Color {
        switch kind {
        case .solid:  return Theme.paper
        case .ghost:  return Theme.ink
        case .danger: return Theme.paper
        }
    }

    private func background(_ pressed: Bool) -> Color {
        switch kind {
        case .solid:  return pressed ? Theme.inkSoft : Theme.ink
        case .ghost:  return pressed ? Theme.paper2 : Theme.card
        case .danger: return pressed ? Theme.accent.opacity(0.8) : Theme.accent
        }
    }
}

extension ButtonStyle where Self == ShelfButton {
    static var shelf: ShelfButton { ShelfButton() }
    static var shelfGhost: ShelfButton { ShelfButton(kind: .ghost) }
    static var shelfDanger: ShelfButton { ShelfButton(kind: .danger) }
    static var shelfWide: ShelfButton { ShelfButton(kind: .solid, wide: true) }
    static var shelfGhostWide: ShelfButton { ShelfButton(kind: .ghost, wide: true) }
}

/// `.chip` — a short status word on a soft ground. Shelfmark's ok / no / vol chips.
struct Chip: View {
    enum Tone { case ok, no, neutral, info }
    let text: String
    var tone: Tone = .neutral
    var symbol: String?
    /// Set when the chip sits on a row already tinted with its own soft colour — a green-soft
    /// chip on a green-soft row is an invisible chip. The ink stays, so the meaning does.
    var onSoftGround = false

    var body: some View {
        HStack(spacing: 4) {
            if let symbol {
                Image(systemName: symbol).font(.system(size: 10, weight: .semibold))
            }
            Text(text).font(Theme.micro(10)).textCase(.uppercase).tracking(1)
        }
        .foregroundStyle(ink)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(ground, in: Capsule())
    }

    private var ink: Color {
        switch tone {
        case .ok:      return Theme.good
        case .no:      return Theme.accent
        case .neutral: return Theme.slate
        case .info:    return Theme.ink
        }
    }
    private var ground: Color {
        if onSoftGround { return Theme.card }
        switch tone {
        case .ok:      return Theme.greenSoft
        case .no:      return Theme.orangeSoft
        case .neutral: return Theme.slateSoft
        case .info:    return Theme.paper2
        }
    }
}

/// The uppercase label that sits above every panel on the website.
struct MicroLabel: View {
    let text: String
    var body: some View {
        Text(text)
            .font(Theme.micro())
            .textCase(.uppercase)
            .tracking(1)
            .foregroundStyle(Theme.inkFaint)
    }
}

/// Located / not-located, as colour + symbol + text. Never colour alone.
struct StatusChip: View {
    let item: TripItem
    var onSoftGround = false

    var body: some View {
        Chip(
            text: item.locationLabel ?? "Not in mapped ranges",
            tone: item.isLocated ? .ok : .no,
            symbol: item.isLocated ? "checkmark.circle.fill" : "exclamationmark.triangle.fill",
            onSoftGround: onSoftGround
        )
        .accessibilityLabel(
            item.isLocated
                ? "Located: level \(item.level ?? 0), shelf \(item.shelfID ?? ""), \(item.side ?? "") side"
                : "Not in mapped ranges. May be Reference on floor 4, or unmapped."
        )
    }
}

// MARK: - Colour from hex

extension Color {
    /// Tokens are written as the hex the web files use, so the two can be diffed by eye.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}
