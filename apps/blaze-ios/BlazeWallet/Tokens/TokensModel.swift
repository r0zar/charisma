import Foundation
import Observation
import WalletCore

/// The active account's token rows and prices, kept live by the balance stream while the Tokens tab is on screen
@MainActor @Observable
final class TokensModel {
    let address: String
    private(set) var rows: [TokenRow]?
    private(set) var prices: [String: Double]?
    private(set) var error: Error?
    private(set) var priceError: Error?

    private let charisma = Charisma()
    private var list: [TokenInfo] = []
    /// Tokens not on the list, looked up once each; a failed lookup leaves the token unknown (Charisma.lookUp logs it)
    private var lookups: [String: TokenInfo] = [:]
    private var lookedUp: Set<String> = []

    init(address: String) {
        self.address = address
    }

    var listed: [TokenRow] { rows?.filter(\.listed) ?? [] }
    var unlisted: [TokenRow] { rows?.filter { !$0.listed } ?? [] }

    /// STX's row: its Standard balance pays every network fee
    var stx: TokenRow? { rows?.first(where: \.isSTX) }

    /// USD value of a row, or nil when the feed has no price for it
    func value(of row: TokenRow) -> Double? {
        guard let meta = row.meta, let price = prices?[row.contractId] else { return nil }
        return Amount.units(row.total, decimals: meta.decimals) * price
    }

    var totalValue: Double { listed.compactMap(value(of:)).reduce(0, +) }
    var unpricedCount: Int { listed.filter { value(of: $0) == nil }.count }

    /// Balances and prices from scratch. Prices are separate: balances still show when the price feed is down.
    func load() async {
        error = nil
        priceError = nil
        async let prices = charisma.usdPrices()
        do {
            async let sheet = charisma.balanceSheet(address: address)
            list = try await charisma.tokenList()
            try await show(try await sheet)
        } catch is CancellationError {
            // The tab went away or refreshed again
        } catch {
            self.error = error
        }
        do {
            self.prices = try await prices
        } catch is CancellationError {
        } catch {
            priceError = error
        }
    }

    /// Every sheet the service pushes, until the tab goes away
    func watch() async {
        do {
            for await sheet in charisma.watchBalances(address: address) where !list.isEmpty {
                try await show(sheet)
            }
        } catch {
            // Only CancellationError: the tab went away
        }
    }

    /// Throws only CancellationError, before anything is kept
    private func show(_ sheet: BalanceSheet) async throws {
        let missing = TokenRows.unlisted(sheet: sheet, list: list).filter { !lookedUp.contains($0) }
        if !missing.isEmpty {
            lookups.merge(try await charisma.lookUp(missing)) { kept, _ in kept }
            lookedUp.formUnion(missing)
        }
        rows = TokenRows.build(sheet: sheet, list: list, lookups: lookups)
    }
}
