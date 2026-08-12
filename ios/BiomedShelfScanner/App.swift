import SwiftUI
import UIKit

@main
struct BiomedShelfScannerApp: App {

    /// Navigation bars are the one surface SwiftUI does not let a view style directly — the title
    /// font in particular has no SwiftUI equivalent. Configured once, through UIKit, rather than
    /// leaving a system-styled bar sitting on top of a paper page on every screen.
    init() {
        let bar = UINavigationBarAppearance()
        bar.configureWithOpaqueBackground()
        bar.backgroundColor = UIColor(Theme.paper)
        bar.shadowColor = UIColor(Theme.line)

        // Falls back to the system face if the bundled font is missing, which is exactly what a
        // UIFont(name:) miss does anyway — but ios/Tools/fonts.test.js exists so it never is.
        let title = UIFont(name: Theme.FontName.display, size: 17) ?? .boldSystemFont(ofSize: 17)
        let large = UIFont(name: Theme.FontName.display, size: 30) ?? .boldSystemFont(ofSize: 30)
        bar.titleTextAttributes = [.font: title, .foregroundColor: UIColor(Theme.ink)]
        bar.largeTitleTextAttributes = [.font: large, .foregroundColor: UIColor(Theme.ink)]

        UINavigationBar.appearance().standardAppearance = bar
        UINavigationBar.appearance().scrollEdgeAppearance = bar
        UINavigationBar.appearance().compactAppearance = bar
        UINavigationBar.appearance().tintColor = UIColor(Theme.ink)

        // The segmented control in the trip header, and the toggles in Diagnostics.
        UISegmentedControl.appearance().selectedSegmentTintColor = UIColor(Theme.ink)
        UISegmentedControl.appearance().backgroundColor = UIColor(Theme.paper2)
        UISegmentedControl.appearance().setTitleTextAttributes(
            [.foregroundColor: UIColor(Theme.paper),
             .font: UIFont(name: Theme.FontName.monoSemi, size: 13) ?? .systemFont(ofSize: 13)],
            for: .selected)
        UISegmentedControl.appearance().setTitleTextAttributes(
            [.foregroundColor: UIColor(Theme.ink),
             .font: UIFont(name: Theme.FontName.mono, size: 13) ?? .systemFont(ofSize: 13)],
            for: .normal)
    }

    /// The router and store are built once and shared. Loading 453 ranges is trivial, but the
    /// router is the app's single source of truth about the building — there should be exactly one.
    @State private var router: Router?
    @State private var store: TripStore?
    @State private var loadError: String?

    var body: some Scene {
        WindowGroup {
            Group {
                if let router, let store {
                    ScanView(router: router)
                        .environment(store)
                        .environment(HeadcountStore())
                } else if let loadError {
                    // If the bundled dataset is missing the app has no reason to exist — fail
                    // loudly rather than presenting an empty scanner that silently locates nothing.
                    ContentUnavailableView(
                        "Shelf data missing",
                        systemImage: "exclamationmark.triangle",
                        description: Text(loadError)
                    )
                } else {
                    ProgressView()
                }
            }
            .task {
                guard router == nil else { return }
                do {
                    let r = try Router(bundledRanges: "biomed-shelf-ranges")
                    router = r
                    store = TripStore(router: r)
                } catch {
                    loadError = "biomed-shelf-ranges.json could not be loaded from the app bundle."
                }
            }
            // One theme, deliberately — the same decision Shelfmark and Headcount made, and for
            // the same reason: three tools used on one shift that do not look like each other are
            // three tools. The brief for a dark default (stacks lighting) is real, and if it is
            // ever taken up it gets taken up in all three at once from one shared token block.
            //
            // Because the app opts out of the system's dark mode rather than adapting to it,
            // every surface has to paint itself. Nothing may rely on a system background; see
            // `PaperBackground` and `Theme`.
            .preferredColorScheme(.light)
            .tint(Theme.ink)
        }
    }
}
