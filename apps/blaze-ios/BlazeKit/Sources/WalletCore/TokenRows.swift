import Foundation

/// What the wallet knows about a token. Without all three of name, symbol and decimals (0 to 38) a token is unknown:
/// shown in raw units and never sendable, never guessed. The token list copies decimals from the token author's own
/// metadata, so a negative or absurd value is refused here rather than trusted.
public struct TokenMeta: Hashable, Sendable {
    public let name: String
    public let symbol: String
    public let decimals: Int
    public let image: URL?

    /// Decimals a real token can have: an Int128 amount holds 38 digits
    static let decimalRange = 0...38

    init?(_ info: TokenInfo) {
        guard let name = info.name, let symbol = info.symbol, let decimals = info.decimals, Self.decimalRange.contains(decimals) else {
            return nil
        }
        self.name = name
        self.symbol = symbol
        self.decimals = decimals
        self.image = info.image.flatMap { $0.isEmpty ? nil : URL(string: $0) }
    }
}

/// Why a row can't be sent from the wallet
public enum Unsendable: Sendable {
    /// Not on Charisma's token list (blocked as a scam, or an unknown airdrop)
    case unlisted
    /// Name, symbol or decimals unknown
    case unknown
    /// On the list, but without the asset name a post condition needs
    case missingAssetName
    /// Everything is on Blaze; sends spend the Standard balance (move Blaze funds with Charisma Swap)
    case onlyOnBlaze
    /// Nothing on Standard or Blaze (STX's row is always shown, even empty)
    case nothingToSend
}

/// One token the active account holds: its Standard (on Stacks) and Blaze (all its subnets) balances
public struct TokenRow: Hashable, Identifiable, Sendable {
    public static let stx = ".stx"

    /// Contract id, or ".stx"
    public let contractId: String
    /// On Stacks, counting what's on its way: what sends spend
    public let standard: Int128
    /// Its subnets added up, counting what's on its way
    public let blaze: Int128
    public let meta: TokenMeta?
    public let listed: Bool
    /// The asset name post conditions need: "" for STX, nil when the token list has none
    public let asset: String?
    /// The Blaze balance by subnet (v1, v2, older releases): what picks the subnet a Blaze order spends from
    public var blazeParts: [String: Int128] = [:]

    public var id: String { contractId }
    public var isSTX: Bool { contractId == Self.stx }
    public var total: Int128 { standard + blaze }

    public var unsendable: Unsendable? {
        if !listed { return .unlisted }
        if meta == nil { return .unknown }
        if asset == nil { return .missingAssetName }
        if standard <= 0 { return blaze > 0 ? .onlyOnBlaze : .nothingToSend }
        return nil
    }
}

/// The extension's getWalletBalances (apps/signet/src/background/lib/tokens.ts)
public enum TokenRows {
    /// Contract ids that will become rows but aren't on the list: look them up (`Charisma.lookUp`) before `build`
    public static func unlisted(sheet: BalanceSheet, list: [TokenInfo]) -> [String] {
        let listed = Set(list.compactMap(\.contractId)).union([TokenRow.stx])
        return totals(sheet).keys.filter { !listed.contains($0) }.sorted()
    }

    /// Blaze balances fold into their base token's row. STX is always there; other rows with nothing on either side
    /// are dropped. Order: STX, then tokens with a Standard balance, then tokens held only on Blaze, each by contract
    /// id, so rows stay put across refreshes and live updates. `lookups` holds what `unlisted` asked for; a token
    /// missing from it is unknown.
    public static func build(sheet: BalanceSheet, list: [TokenInfo], lookups: [String: TokenInfo]) -> [TokenRow] {
        let byId = Dictionary(list.compactMap { info in info.contractId.map { ($0, info) } }, uniquingKeysWith: { first, _ in first })
        let rows = totals(sheet).map { id, total -> TokenRow in
            let info = byId[id] ?? lookups[id]
            let isSTX = id == TokenRow.stx
            return TokenRow(
                contractId: id, standard: total.standard, blaze: total.blaze,
                meta: info.flatMap(TokenMeta.init), listed: isSTX || byId[id] != nil,
                asset: isSTX ? "" : info?.identifier.flatMap { $0.isEmpty ? nil : $0 },
                blazeParts: total.parts
            )
        }
        return rows.sorted { a, b in
            let rank = { (row: TokenRow) in row.isSTX ? 0 : row.standard != 0 ? 1 : 2 }
            return (rank(a), a.contractId) < (rank(b), b.contractId)
        }
    }

    /// Each row's Standard and Blaze totals: STX always, others only when something is on either side. A token whose
    /// balance the service couldn't read is left out and logged (the extension's rule).
    private static func totals(_ sheet: BalanceSheet) -> [String: (standard: Int128, blaze: Int128, parts: [String: Int128])] {
        var totals: [String: (standard: Int128, blaze: Int128, parts: [String: Int128])] = [TokenRow.stx: (0, 0, [:])]
        for (id, token) in sheet.tokens {
            guard let ready = token.ready, let amount = Int128(ready) else {
                Log.balances.error("Couldn't read \(id, privacy: .public)'s balance: \(token.error ?? "no amount", privacy: .public)")
                continue
            }
            let base = token.base ?? id
            var row = totals[base] ?? (0, 0, [:])
            if token.base == nil {
                row.standard += amount
            } else {
                row.blaze += amount
                row.parts[id, default: 0] += amount
            }
            totals[base] = row
        }
        return totals.filter { id, total in id == TokenRow.stx || total.standard != 0 || total.blaze != 0 }
    }
}
