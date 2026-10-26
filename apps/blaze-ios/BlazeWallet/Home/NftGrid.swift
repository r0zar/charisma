import SwiftUI
import WalletCore

/// One NFT: its picture, its name and collection. A tap opens its contract on the explorer. An NFT whose details
/// couldn't load shows its id and says so.
struct NftCard: View {
    let nft: NftItem

    var body: some View {
        if let link = URL(string: "https://explorer.hiro.so/address/\(nft.contractId)?chain=mainnet") {
            Link(destination: link) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 6) {
            picture
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)
                .background(Color.brand("surface-sunken"))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            Text(nft.name ?? "#\(nft.tokenId)")
                .brandFont(.subheadline, weight: .semibold)
                .lineLimit(1)
            Text(nft.problem != nil ? String(localized: "Details unavailable") : collection)
                .brandFont(.caption)
                .foregroundStyle(.brand("ink-muted"))
                .lineLimit(1)
        }
    }

    private var picture: some View {
        RemoteImage(url: nft.image) { placeholder }
    }

    private var placeholder: some View {
        Text(collection.prefix(1).uppercased())
            .brandFont(.title2, weight: .semibold)
            .foregroundStyle(.brand("ink-muted"))
    }

    /// The collection's name: its contract's name, after the address
    private var collection: String {
        nft.contractId.split(separator: ".").last.map(String.init) ?? nft.contractId
    }
}
