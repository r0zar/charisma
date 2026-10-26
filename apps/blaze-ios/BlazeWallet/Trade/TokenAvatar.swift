import SwiftUI

/// A token's picture on the Trade screen: its logo from Charisma's token list, or its first letter while the logo
/// loads, when there's none, or when it can't be read (as the extension does)
struct TokenAvatar: View {
    let url: URL?
    let symbol: String
    var size: CGFloat = 36

    var body: some View {
        RemoteImage(url: url) {
            Text(symbol.prefix(1).uppercased())
                .brandFont(.caption, weight: .semibold)
                .foregroundStyle(.brand("ink-muted"))
        }
        .frame(width: size, height: size)
        .background(Color.brand("surface-sunken"))
        // Almost square: token logos aren't all round, and a circle cuts their corners off
        .clipShape(RoundedRectangle(cornerRadius: size * 0.25))
    }
}
