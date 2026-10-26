import SwiftDraw
import SwiftUI
import UIKit

/// Longest side of an SVG's bitmap, in points: sharp at 3x for an NFT card, and light on memory for a token avatar
private let svgSide: CGFloat = 160

/// A picture from the web, filling its frame. Token and NFT art points at bitmaps and at SVGs, and SwiftUI draws only
/// bitmaps, so an SVG is rasterized here first. The placeholder shows while the picture loads, when there's none, or
/// when it can't be read.
struct RemoteImage<Placeholder: View>: View {
    let url: URL?
    private let placeholder: Placeholder

    @State private var image: UIImage?

    init(url: URL?, @ViewBuilder placeholder: () -> Placeholder) {
        self.url = url
        self.placeholder = placeholder()
    }

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                placeholder
            }
        }
        .task(id: url) {
            image = nil
            guard let url else { return }
            let loaded = await RemoteImage.load(url)
            // A picture for a row that has since changed isn't shown
            guard !Task.isCancelled else { return }
            image = loaded
        }
    }

    private static func load(_ url: URL) async -> UIImage? {
        guard let result = try? await URLSession.shared.data(from: url) else { return nil }
        return image(from: result.0)
    }

    /// A bitmap as it is, or an SVG rasterized at its own proportions (so a wide picture isn't stretched). Nil when neither reads.
    static func image(from data: Data) -> UIImage? {
        if let bitmap = UIImage(data: data) { return bitmap }
        guard let svg = SVG(data: data), svg.size.width > 0, svg.size.height > 0 else { return nil }
        let fit = svgSide / max(svg.size.width, svg.size.height)
        return svg.rasterize(size: CGSize(width: svg.size.width * fit, height: svg.size.height * fit))
    }
}
