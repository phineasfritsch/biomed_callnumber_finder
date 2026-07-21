import AVFoundation
import SwiftUI

/// Live camera feed. Thin wrapper over `AVCaptureVideoPreviewLayer`.
struct CameraPreview: UIViewRepresentable {

    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let v = PreviewView()
        v.videoPreviewLayer.session = session
        v.videoPreviewLayer.videoGravity = .resizeAspectFill
        return v
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    /// Backing the view with `AVCaptureVideoPreviewLayer` directly (rather than adding a sublayer)
    /// means the layer resizes with the view for free — no manual frame bookkeeping on rotation.
    final class PreviewView: UIView {
        override static var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var videoPreviewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
}
