import SwiftUI

/// Design tokens. See DESIGN.md §6.
///
/// Chrome is deliberately native (system backgrounds, system controls). Only two things carry
/// over from the web app: the shelf-group colours, which are *semantic* on the floor map, and the
/// high-contrast accent.
enum Theme {

    // MARK: Colour

    /// Status colours never stand alone — every use pairs with an SF Symbol and text, so the
    /// information survives colour-blindness and glare. See `StatusChip`.
    static let located = Color.green
    static let unlocated = Color.orange
    static let accent = Color(red: 0.01, green: 0.42, blue: 0.63)   // #0369A1

    /// Shelf group colours, carried over from the web locator so the floor map stays recognisable
    /// to anyone who used it.
    enum ShelfGroup {
        static let green = Color(red: 0.36, green: 0.49, blue: 0.23)   // #5B7D3A
        static let orange = Color(red: 0.78, green: 0.42, blue: 0.15)  // #C66A25
        static let char = Color(red: 0.23, green: 0.21, blue: 0.19)    // #3A3631
        static let slate = Color(red: 0.42, green: 0.44, blue: 0.50)   // #6A7080
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
        return c.opacity(soft ? 0.22 : 1)
    }

    // MARK: Motion

    /// One spring for the whole app. Unifying the rhythm is most of what makes motion feel
    /// designed rather than assembled.
    static let spring = Animation.spring(response: 0.3, dampingFraction: 0.8)

    // MARK: Type

    /// Call numbers are **always** monospaced. They are identifiers packed with ambiguous glyphs
    /// (O/0, I/1, S/5); proportional type makes them genuinely harder to verify, and verification
    /// is the human's job here.
    static func callNumber(_ size: Font.TextStyle = .body) -> Font {
        .system(size, design: .monospaced)
    }
}

/// Located / not-located, as colour + symbol + text. Never colour alone.
struct StatusChip: View {
    let item: TripItem

    var body: some View {
        Label {
            Text(item.locationLabel ?? "Not in mapped ranges")
                .font(.caption)
        } icon: {
            Image(systemName: item.isLocated ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.caption)
        }
        .foregroundStyle(item.isLocated ? Theme.located : Theme.unlocated)
        .accessibilityLabel(
            item.isLocated
                ? "Located: level \(item.level ?? 0), shelf \(item.shelfID ?? ""), \(item.side ?? "") side"
                : "Not in mapped ranges. May be Reference on floor 4, or unmapped."
        )
    }
}
