import SwiftUI

@main
struct BiomedShelfScannerApp: App {

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
        }
    }
}
