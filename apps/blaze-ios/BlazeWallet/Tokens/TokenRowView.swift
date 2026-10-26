import SwiftUI
import WalletCore

/// One token: its logo, symbol and name on the left; its USD value, the amount (cut to 6 decimals) and, under those,
/// the Blaze share in the flame's colours on the right
struct TokenRowView: View {
    let row: TokenRow
    let value: Double?
    let pricesLoaded: Bool

    var body: some View {
        HStack(spacing: 12) {
            TokenIcon(row: row)
            VStack(alignment: .leading, spacing: 1) {
                Text(Format.symbol(row)).brandFont(.callout, weight: .bold)
                Text(row.meta?.name ?? row.contractId)
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 1) {
                if pricesLoaded {
                    Text(verbatim: value.map(Format.usd) ?? "—").monoFont(size: 15, relativeTo: .callout)
                }
                Text(verbatim: "\(Format.amount(row.total, of: row, precision: .cut(6))) \(Format.symbol(row))")
                    .monoFont(pricesLoaded ? .caption : .callout)
                    .foregroundStyle(.brand(pricesLoaded ? "ink-muted" : "ink"))
                    .contentTransition(.numericText())
                    .animation(.default, value: row.total)
                if row.blaze != 0, row.meta != nil {
                    HStack(spacing: 3) {
                        Image(systemName: "flame.fill").font(.system(size: 10, weight: .bold))
                        Text("\(Format.amount(row.blaze, of: row, precision: .cut(6))) on Blaze")
                    }
                    .monoFont(.caption)
                    .foregroundStyle(Theme.blazeText)
                }
            }
        }
        .contentShape(Rectangle())
    }
}

/// The token's image, or its first letter when there's none or it fails to load (as in the extension), with the Blaze
/// flame when some of it is on Blaze. Unlisted tokens always show the letter: their image address is the token maker's
/// choice, and loading it would tell them who looked.
struct TokenIcon: View {
    let row: TokenRow

    var body: some View {
        RemoteImage(url: row.listed ? row.meta?.image : nil) {
            Text(Format.symbol(row).prefix(1).uppercased())
                .brandFont(.headline, weight: .semibold)
                .foregroundStyle(.brand("ink-muted"))
        }
        .frame(width: 36, height: 36)
        .background(Color.brand("surface-sunken"))
        .clipShape(RoundedRectangle(cornerRadius: 9))
        .overlay(alignment: .bottomTrailing) {
            if row.blaze != 0 { BlazeBadge().offset(x: 4, y: 4) }
        }
    }
}
