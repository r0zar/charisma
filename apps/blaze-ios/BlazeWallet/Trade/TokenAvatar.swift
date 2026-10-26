import SwiftUI

/// A token's picture on the Trade screen: its image from Charisma's token list, or its first letter while the image
/// loads, when there's none, or when it fails to load (as the extension does)
struct TokenAvatar: View {
    let url: URL?
    let symbol: String
    var size: CGFloat = 36

    var body: some View {
        AsyncImage(url: url) { phase in
            if case .success(let image) = phase {
                image.resizable().scaledToFill()
            } else {
                Text(symbol.prefix(1).uppercased())
                    .brandFont(.caption, weight: .semibold)
                    .foregroundStyle(.brand("ink-muted"))
            }
        }
        .frame(width: size, height: size)
        .background(Color.brand("surface-sunken"))
        .clipShape(Circle())
    }
}
