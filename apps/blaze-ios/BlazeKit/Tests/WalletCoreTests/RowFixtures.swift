import Foundation
@testable import WalletCore

extension TokenRow {
    /// A row as TokenRows.build would make it
    static func make(_ contractId: String, standard: Int128, blaze: Int128 = 0, symbol: String = "TKN", decimals: Int = 6, listed: Bool = true, asset: String? = "token") -> TokenRow {
        TokenRow(
            contractId: contractId, standard: standard, blaze: blaze,
            meta: TokenMeta(TokenInfo(contractId: contractId, name: symbol, symbol: symbol, decimals: decimals, identifier: asset)),
            listed: listed, asset: contractId == TokenRow.stx ? "" : asset
        )
    }
}
