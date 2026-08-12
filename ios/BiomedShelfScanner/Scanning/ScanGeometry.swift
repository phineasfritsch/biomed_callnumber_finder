import CoreGraphics

/// Where the viewfinder is allowed to be.
///
/// The scan band is not a decorative frame. `FrameProcessor` filters Vision observations by
/// exactly this rect, so **what is drawn is what is scanned** — that equality is the whole reason
/// the engine OCRs the full frame instead of setting `regionOfInterest` (DESIGN.md §3.1.1).
///
/// Which is why the band cannot be a hand-picked constant. It was, and the constants were wrong:
/// the precision band ran from 0.18 to 0.82 of the screen, and the single-shot shutter sits at
/// roughly 0.72–0.81. The outline crossed the button, the "what I can see" chip was drawn 28pt
/// *below* the band and landed squarely on it, and the bottom of the scan area was behind the
/// thumb pressing the shutter. Aiming at a spine meant aiming at your own hand.
///
/// So the band is derived from the controls instead: everything below is measured from the same
/// numbers the views lay out with, and the free space between them is what gets scanned. Change a
/// control's size here and the band follows it.
///
/// All of this is pure arithmetic on purpose — `ScanGeometryTests` walks every shipping iPhone
/// size and asserts the band never meets the chrome.
enum ScanGeometry {

    // MARK: The controls, as laid out

    /// Mode chips in the top bar. Matches the `frame(height:)` in `ScanView.topBar`.
    static let barHeight: CGFloat = 44
    /// `ScanView.topBar`'s own top padding.
    static let barTopPadding: CGFloat = 8
    /// The shutter's outer ring. Matches `ScanView.scanButton`.
    static let shutter: CGFloat = 78

    /// The trip sheet's peek detent, as **requested** in `presentationDetents`.
    ///
    /// This is a request, not a measurement, and the difference cost a bug. A `.height(104)`
    /// detent does not produce a sheet whose top edge is 104pt above the bottom of the screen:
    /// the system adds the grabber, its own bottom safe-area inset, and its minimum height, and
    /// none of that is published anywhere you can read it. Laying the shutter out against this
    /// number put the shutter underneath the sheet.
    ///
    /// So it is now only a floor and a first-frame fallback. What the layout actually uses is
    /// `ScanView`'s measurement of where the sheet's top edge really is — see `sheetHeight`.
    static let sheetPeek: CGFloat = 104
    /// Air between any two of the above. One value, so the rhythm is uniform.
    static let gap: CGFloat = 16

    /// Never let the band collapse to nothing on a small screen, even if that means the outline
    /// tucks under the top bar — the top bar is a chip row over a dimmed region, and overlapping
    /// it costs a little clarity. Overlapping the shutter costs you the label.
    static let minBandHeight: CGFloat = 200

    /// Fraction of the screen the sweep band occupies, at most. Sweeping a truck shelf wants a
    /// horizontal strip at label height, not the whole viewport — a taller band starts catching
    /// the shelf above.
    static let sweepHeightFraction: CGFloat = 0.5

    // MARK: Derived layout

    /// How much of the screen the trip sheet actually covers, in points up from the bottom edge.
    ///
    /// `measured` is what `ScanView` reads back from the sheet itself. Everything below is laid
    /// out against this rather than against `sheetPeek`, because the detent and the sheet are not
    /// the same size and only one of them is real.
    static func sheetHeight(measured: CGFloat?) -> CGFloat {
        guard let measured, measured.isFinite else { return sheetPeek }
        // Floor at the requested detent so a mid-animation or zero reading cannot drop the
        // shutter back under the sheet, which is the failure this whole path exists to prevent.
        return max(sheetPeek, measured)
    }

    /// The shutter's bottom padding, *inside* the safe area — which is where `ScanView` applies it.
    ///
    /// Derived rather than typed in, because the number it has to clear is measured from the
    /// bottom of the **screen** while the padding is applied from the bottom of the **safe area**.
    /// On a home-indicator phone those differ by 34pt, which is exactly the size of gap that gets
    /// a button tucked half under a sheet.
    static func shutterBottomPadding(safeBottom: CGFloat, sheetHeight: CGFloat) -> CGFloat {
        max(gap, sheetHeight + gap - safeBottom)
    }

    /// Screen top → top of the band.
    static func topChrome(safeTop: CGFloat) -> CGFloat {
        safeTop + barTopPadding + barHeight + gap
    }

    /// Screen bottom → bottom of the band.
    static func bottomChrome(safeBottom: CGFloat, sheetHeight: CGFloat) -> CGFloat {
        safeBottom + shutterBottomPadding(safeBottom: safeBottom, sheetHeight: sheetHeight)
            + shutter + gap
    }

    /// The scan band, in **upright portrait normalized coordinates with a bottom-left origin** —
    /// the space Vision reports observation bounding boxes in, and the space the overlay draws in.
    ///
    /// The band is deliberately the same in single-shot and sweep mode even though the shutter is
    /// only on screen in one of them. A frame that jumps when you change mode is a frame you have
    /// to re-aim, and the whole point of the mode toggle is that it changes nothing about how you
    /// hold the phone.
    static func band(
        precision: Bool,
        screen: CGSize,
        safeTop: CGFloat,
        safeBottom: CGFloat,
        sheetHeight: CGFloat
    ) -> CGRect {
        let h = screen.height
        guard h > 0 else { return CGRect(x: 0, y: 0.25, width: 1, height: 0.5) }

        let bottom = min(bottomChrome(safeBottom: safeBottom, sheetHeight: sheetHeight), h)
        // Give up top chrome before band height. See `minBandHeight`.
        let top = min(topChrome(safeTop: safeTop), max(0, h - bottom - minBandHeight))
        let free = max(0, h - top - bottom)

        let heightPt = precision ? free : min(free, h * sweepHeightFraction)
        // Centred in the free space, not in the screen: the screen's midpoint is under the sheet.
        let topPt = top + (free - heightPt) / 2

        return CGRect(
            x: precision ? 0.30 : 0,
            y: max(0, (h - topPt - heightPt) / h),
            width: precision ? 0.40 : 1,
            height: min(1, heightPt / h)
        )
    }
}
