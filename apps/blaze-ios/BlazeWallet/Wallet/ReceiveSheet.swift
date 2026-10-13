import CoreImage.CIFilterBuiltins
import SwiftUI

/// The account's address as a QR code, with Copy and Share
struct ReceiveSheet: View {
    let address: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                if let code = Self.qrCode(address) {
                    Image(uiImage: code)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 240)
                        .padding(16)
                        .background(.white, in: RoundedRectangle(cornerRadius: 16))
                }
                Text(address).monoFont(.callout).multilineTextAlignment(.center).textSelection(.enabled)
                HStack(spacing: 16) {
                    CopyButton(text: address).buttonStyle(.bordered)
                    ShareLink(item: address).buttonStyle(.bordered)
                }
                Text("Send only Stacks (STX) and Stacks tokens to this address.")
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.brand("bg"))
            .navigationTitle("Receive")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    /// One renderer for every redraw
    private static let renderer = CIContext()

    private static func qrCode(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let image = renderer.createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: image)
    }
}
