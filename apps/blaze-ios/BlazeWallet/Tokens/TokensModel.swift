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

    /// Throws only CancellationError, before anything is kept. Tokens not on the list are looked up once per session
    /// (Charisma keeps them); a failed lookup leaves the token unknown.
    private func show(_ sheet: BalanceSheet) async throws {
        let lookups = try await charisma.lookUp(TokenRows.unlisted(sheet: sheet, list: list))
        rows = TokenRows.build(sheet: sheet, list: list, lookups: lookups)
        // Rows are back (the stream recovers on its own): a failed load is no longer the news
        error = nil
    }
}
