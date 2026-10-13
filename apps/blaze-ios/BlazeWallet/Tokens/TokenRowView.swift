import SwiftUI
import WalletCore

/// One token: icon, symbol, "X on Blaze" or its name, the total (cut to 6 decimals) and its USD value
struct TokenRowView: View {
    let row: TokenRow
    let value: Double?
    let pricesLoaded: Bool

    var body: some View {
        HStack(spacing: 12) {
            TokenIcon(row: row)
            VStack(alignment: .leading, spacing: 2) {
                Text(Format.symbol(row)).brandFont(.body, weight: .semibold)
                if row.blaze != 0, row.meta != nil {
                    Label {
                        Text("\(Format.amount(row.blaze, of: row, precision: .cut(6))) on Blaze")
                    } icon: {
                        Image(systemName: "flame.fill")
                    }
                    .labelStyle(.titleAndIcon)
                    .brandFont(.caption)
                    .foregroundStyle(.brand("blaze"))
                } else {
                    Text(row.meta?.name ?? row.contractId)
                        .brandFont(.caption)
                        .foregroundStyle(.brand("ink-muted"))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(Format.amount(row.total, of: row, precision: .cut(6)))
                    .monoFont(.body)
                    .contentTransition(.numericText())
                    .animation(.default, value: row.total)
                if pricesLoaded {
                    Text(value.map(Format.usd) ?? "—").monoFont(.caption).foregroundStyle(.brand("ink-muted"))
                }
            }
        }
        .contentShape(Rectangle())
        .padding(.vertical, 4)
    }
}

/// The token's image, or its first letter when there's none or it fails to load (as in the extension). Unlisted tokens
/// always show the letter: their image address is the token maker's choice, and loading it would tell them who looked.
struct TokenIcon: View {
    let row: TokenRow

    var body: some View {
        AsyncImage(url: row.listed ? row.meta?.image : nil) { phase in
            if case .success(let image) = phase {
                image.resizable().scaledToFill()
            } else {
                Text(Format.symbol(row).prefix(1).uppercased())
                    .brandFont(.headline, weight: .semibold)
                    .foregroundStyle(.brand("ink-muted"))
            }
        }
        .frame(width: 36, height: 36)
        .background(Color.brand("surface-sunken"))
        .clipShape(Circle())
    }
}
