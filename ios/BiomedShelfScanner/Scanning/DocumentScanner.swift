import SwiftUI
import Vision
import VisionKit

/// Sheet mode: capture an ILL request sheet and pull every call number off it at once.
///
/// A printed list is a fundamentally different capture problem from a spine — one page, many
/// lines, no ambiguity about aiming. `VNDocumentCameraViewController` handles edge detection,
/// perspective correction and lighting for free, which is why this isn't just the live scanner
/// pointed at paper.
struct DocumentScanner: UIViewControllerRepresentable {

    let router: Router
    /// Called with everything found on the page. The caller reviews before committing — a sheet
    /// scan is a bulk import, and bulk imports deserve a look.
    let onFinish: ([(CallNumber, Router.Hit?)]) -> Void
    let onCancel: () -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let vc = VNDocumentCameraViewController()
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        private let parent: DocumentScanner
        init(_ parent: DocumentScanner) { self.parent = parent }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            var found: [(CallNumber, Router.Hit?)] = []
            var seen = Set<String>()
            let recognizer = CallNumberRecognizer(router: parent.router)

            for i in 0..<scan.pageCount {
                guard let cg = scan.imageOfPage(at: i).cgImage else { continue }
                for text in Self.recognizeLines(in: cg) {
                    guard let result = recognizer.resolve(candidates: [text]) else { continue }
                    let (cn, hit): (CallNumber, Router.Hit?)
                    switch result {
                    case let .located(c, h): (cn, hit) = (c, h)
                    case let .unlocated(c):  (cn, hit) = (c, nil)
                    }
                    guard seen.insert(cn.raw.uppercased()).inserted else { continue }
                    found.append((cn, hit))
                }
            }
            controller.dismiss(animated: true) { self.parent.onFinish(found) }
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            controller.dismiss(animated: true) { self.parent.onCancel() }
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError error: Error
        ) {
            controller.dismiss(animated: true) { self.parent.onCancel() }
        }

        /// One request per page, returning each recognized line separately so a list of call
        /// numbers doesn't get concatenated into one unparseable run.
        private static func recognizeLines(in image: CGImage) -> [String] {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = false   // see DESIGN.md §3.1
            request.recognitionLanguages = ["en-US"]

            let handler = VNImageRequestHandler(cgImage: image)
            try? handler.perform([request])

            return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
        }
    }
}
