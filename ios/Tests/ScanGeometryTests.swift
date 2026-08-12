import XCTest
@testable import BiomedShelfScanner

/// The scan band must never touch the controls drawn on top of the preview.
///
/// This is a regression test with a specific bug behind it: the band was two hand-picked
/// constants, and the precision one ran from 0.18 to 0.82 of the screen while the single-shot
/// shutter sat at roughly 0.72–0.81. The outline crossed the button, and the bottom of the
/// scanned region was underneath the thumb pressing it. Because the band is also what
/// `FrameProcessor` filters observations by, that was not only ugly — part of what the frame
/// promised to scan was behind your own hand.
final class ScanGeometryTests: XCTestCase {

    /// Portrait sizes and safe areas for every iPhone the deployment target (iOS 17) reaches.
    /// Point sizes, not pixels.
    private struct Device {
        let name: String
        let size: CGSize
        let safeTop: CGFloat
        let safeBottom: CGFloat
    }

    private let devices: [Device] = [
        .init(name: "SE (2nd/3rd gen)",     size: .init(width: 375, height: 667), safeTop: 20, safeBottom: 0),
        .init(name: "8 Plus",               size: .init(width: 414, height: 736), safeTop: 20, safeBottom: 0),
        .init(name: "13 mini",              size: .init(width: 375, height: 812), safeTop: 50, safeBottom: 34),
        .init(name: "11 / XR",              size: .init(width: 414, height: 896), safeTop: 48, safeBottom: 34),
        .init(name: "14 / 13",              size: .init(width: 390, height: 844), safeTop: 47, safeBottom: 34),
        .init(name: "15 / 14 Pro",          size: .init(width: 393, height: 852), safeTop: 59, safeBottom: 34),
        .init(name: "15 Pro Max",           size: .init(width: 430, height: 932), safeTop: 59, safeBottom: 34),
    ]

    /// Plausible real sheet heights. A `.height(104)` detent does not produce a 104pt sheet —
    /// the system adds the grabber, its own bottom safe-area inset and its minimum height, and
    /// publishes none of it. Laying out against the requested number is what buried the shutter,
    /// so every case here is checked across the range the sheet can actually come back as.
    private let sheetHeights: [CGFloat?] = [nil, 104, 138, 172]

    /// Top of the shutter, measured from the bottom of the screen.
    private func shutterTop(_ d: Device, _ sheet: CGFloat) -> CGFloat {
        d.safeBottom
            + ScanGeometry.shutterBottomPadding(safeBottom: d.safeBottom, sheetHeight: sheet)
            + ScanGeometry.shutter
    }

    /// The band's bottom edge, measured from the bottom of the screen.
    private func bandBottom(_ band: CGRect, _ d: Device) -> CGFloat {
        band.minY * d.size.height
    }

    /// The band's top edge, measured from the top of the screen.
    private func bandTop(_ band: CGRect, _ d: Device) -> CGFloat {
        (1 - band.maxY) * d.size.height
    }

    func testBandNeverOverlapsTheShutter() {
        for d in devices {
          for measured in sheetHeights {
            let sheet = ScanGeometry.sheetHeight(measured: measured)
            for precision in [false, true] {
                let band = ScanGeometry.band(
                    precision: precision, screen: d.size,
                    safeTop: d.safeTop, safeBottom: d.safeBottom, sheetHeight: sheet
                )
                XCTAssertGreaterThanOrEqual(
                    bandBottom(band, d), shutterTop(d),
                    "\(d.name) \(precision ? "precision" : "wide"): band bottom "
                    + "\(bandBottom(band, d)) is below the shutter top \(shutterTop(d))"
                )
            }
          }
        }
    }

    /// The sheet's peek detent is opaque and permanently presented. Anything the band claims
    /// below it is a region the user cannot see but the recognizer still reads.
    func testBandNeverOverlapsTheSheetPeek() {
        for d in devices {
          for measured in sheetHeights {
            let sheet = ScanGeometry.sheetHeight(measured: measured)
            for precision in [false, true] {
                let band = ScanGeometry.band(
                    precision: precision, screen: d.size,
                    safeTop: d.safeTop, safeBottom: d.safeBottom, sheetHeight: sheet
                )
                XCTAssertGreaterThanOrEqual(
                    bandBottom(band, d), ScanGeometry.sheetPeek,
                    "\(d.name) \(precision ? "precision" : "wide"): band runs under the sheet"
                )
            }
          }
        }
    }

    /// The shutter must clear the sheet's real top edge, not the detent height it was asked for.
    ///
    /// This is the bug that shipped. `.height(104)` produced a sheet taller than 104pt, the
    /// shutter was laid out against 104, and the sheet covered it by about 18pt on a
    /// home-indicator phone.
    func testShutterClearsTheSheetWhateverHeightItTurnsOutToBe() {
        for d in devices {
            for measured in sheetHeights {
                let sheet = ScanGeometry.sheetHeight(measured: measured)
                let bottom = d.safeBottom
                    + ScanGeometry.shutterBottomPadding(safeBottom: d.safeBottom, sheetHeight: sheet)
                XCTAssertGreaterThanOrEqual(
                    bottom, sheet + ScanGeometry.gap,
                    "\(d.name) [sheet \(sheet)]: shutter bottom \(bottom) does not clear it"
                )
            }
        }
    }

    /// A measurement below the requested detent is a mid-animation or zero reading, and taking it
    /// at face value would drop the shutter straight back under the sheet.
    func testSheetHeightFloorsAtTheRequestedDetent() {
        XCTAssertEqual(ScanGeometry.sheetHeight(measured: nil), ScanGeometry.sheetPeek)
        XCTAssertEqual(ScanGeometry.sheetHeight(measured: 0), ScanGeometry.sheetPeek)
        XCTAssertEqual(ScanGeometry.sheetHeight(measured: 40), ScanGeometry.sheetPeek)
        XCTAssertEqual(ScanGeometry.sheetHeight(measured: 138), 138)
        XCTAssertEqual(ScanGeometry.sheetHeight(measured: .infinity), ScanGeometry.sheetPeek)
    }

    func testBandNeverOverlapsTheTopBar() {
        for d in devices {
          for measured in sheetHeights {
            let sheet = ScanGeometry.sheetHeight(measured: measured)
            for precision in [false, true] {
                let band = ScanGeometry.band(
                    precision: precision, screen: d.size,
                    safeTop: d.safeTop, safeBottom: d.safeBottom, sheetHeight: sheet
                )
                let barBottom = d.safeTop + ScanGeometry.barTopPadding + ScanGeometry.barHeight
                XCTAssertGreaterThanOrEqual(
                    bandTop(band, d), barBottom,
                    "\(d.name) \(precision ? "precision" : "wide"): band top \(bandTop(band, d)) "
                    + "is above the mode chips at \(barBottom)"
                )
            }
          }
        }
    }

    /// A band that clears everything by collapsing to nothing would pass the tests above.
    func testBandStaysBigEnoughToAimWith() {
        for d in devices {
          for measured in sheetHeights {
            let sheet = ScanGeometry.sheetHeight(measured: measured)
            for precision in [false, true] {
                let band = ScanGeometry.band(
                    precision: precision, screen: d.size,
                    safeTop: d.safeTop, safeBottom: d.safeBottom, sheetHeight: sheet
                )
                XCTAssertGreaterThanOrEqual(
                    band.height * d.size.height, ScanGeometry.minBandHeight,
                    "\(d.name) \(precision ? "precision" : "wide"): band is only "
                    + "\(band.height * d.size.height)pt tall"
                )
                XCTAssertTrue((0...1).contains(band.minY) && (0...1).contains(band.maxY),
                              "\(d.name): band escaped the screen — \(band)")
            }
          }
        }
    }

    /// Precision frames a single *vertical spine*: the stacked label reads top to bottom, so the
    /// box must be taller than it is wide. An early build shipped it as a landscape strip, which
    /// is a shape no spine label ever has.
    func testPrecisionBandIsTallAndNarrow() {
        for d in devices {
            let band = ScanGeometry.band(
                precision: true, screen: d.size, safeTop: d.safeTop, safeBottom: d.safeBottom,
                sheetHeight: ScanGeometry.sheetHeight(measured: nil)
            )
            XCTAssertGreaterThan(band.height * d.size.height, band.width * d.size.width, d.name)
            XCTAssertEqual(band.midX, 0.5, accuracy: 0.001, "\(d.name): precision band is off-centre")
        }
    }

    /// Sweeping a truck shelf wants a strip at label height. A band that grew to the full
    /// viewport would start collecting the shelf above.
    func testSweepBandStaysAStrip() {
        for d in devices {
            let band = ScanGeometry.band(
                precision: false, screen: d.size, safeTop: d.safeTop, safeBottom: d.safeBottom,
                sheetHeight: ScanGeometry.sheetHeight(measured: nil)
            )
            XCTAssertLessThanOrEqual(band.height, ScanGeometry.sweepHeightFraction + 0.001, d.name)
            XCTAssertEqual(band.width, 1, "\(d.name): sweep must span the full width")
        }
    }

    /// A zero-size screen happens for exactly one layout pass before `GeometryReader` reports.
    /// It must not produce a band that scans nothing or crashes on a divide.
    func testDegenerateScreenIsSurvivable() {
        let band = ScanGeometry.band(precision: true, screen: .zero, safeTop: 0, safeBottom: 0,
                                     sheetHeight: ScanGeometry.sheetHeight(measured: nil))
        XCTAssertGreaterThan(band.height, 0)
        XCTAssertTrue((0...1).contains(band.minY))
    }
}
