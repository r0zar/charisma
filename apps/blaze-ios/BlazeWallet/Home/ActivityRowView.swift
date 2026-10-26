import SwiftUI
import WalletCore

/// One transaction: what it moved for this account ("Sent 1.5 STX · Received 2 sBTC", or the contract function it
/// called), when, its status when it isn't a success, and a link to the explorer
struct ActivityRowView: View {
    let row: ActivityRow
    /// Token details by contract id, for naming the moves
    let tokens: [String: TokenInfo]

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.brand(row.status == .failed ? "danger" : "ink-body"))
                .frame(width: 36, height: 36)
                .background(Color.brand("surface"), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).brandFont(.callout, weight: .bold).lineLimit(2)
                Text(detail).monoFont(.caption).foregroundStyle(.brand("ink-muted"))
            }
            Spacer(minLength: 8)
            Link(destination: Format.explorer(row.txid)) {
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.brand("ink-muted"))
                    .frame(width: 32, height: 32)
            }
            .accessibilityLabel(Text("View on explorer"))
        }
    }

    private var icon: String {
        if row.moves.contains(where: { !$0.incoming }) { return "arrow.up.right" }
        if !row.moves.isEmpty { return "arrow.down.left" }
        return "arrow.triangle.2.circlepath"
    }

    private var title: String {
        let sent = row.moves.filter { !$0.incoming }.map { String(localized: "Sent \(text(for: $0))") }
        let received = row.moves.filter(\.incoming).map { String(localized: "Received \(text(for: $0))") }
        let parts = sent + received
        if !parts.isEmpty { return parts.joined(separator: " · ") }
        if let function = row.function { return String(localized: "Contract call: \(function)") }
        return "—"
    }

    private var detail: String {
        let when = row.time.formatted(date: .abbreviated, time: .shortened)
        switch row.status {
        case .success: return when
        case .pending: return "\(when) · \(String(localized: "Pending"))"
        case .failed: return "\(when) · \(String(localized: "Failed"))"
        }
    }

    /// "1.5 STX", "stdao #867" for an NFT, or the raw amount and the contract's name when the token isn't known
    private func text(for move: ActivityMove) -> String {
        let name = move.contractId.split(separator: ".").last.map(String.init) ?? move.contractId
        if let tokenId = move.tokenId { return "\(name) #\(tokenId)" }
        if move.contractId == TokenRow.stx, let raw = Int128(move.amount) {
            return "\(Self.amount(raw, decimals: 6)) STX"
        }
        guard let info = tokens[move.contractId], let decimals = info.decimals, let symbol = info.symbol,
              let raw = Int128(move.amount) else {
            return "\(move.amount) \(name)"
        }
        return "\(Self.amount(raw, decimals: decimals)) \(symbol)"
    }

    /// Up to 6 decimals, as the token list shows them
    private static func amount(_ raw: Int128, decimals: Int) -> String {
        Amount.units(raw, decimals: decimals).formatted(.number.precision(.fractionLength(0...6)))
    }
}
