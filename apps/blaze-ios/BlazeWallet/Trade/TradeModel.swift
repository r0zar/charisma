import Foundation
import Observation
import WalletCore

/// The Trade screen's data: the tokens it can swap into, and the best route for the trade on screen. A quote that
/// arrives after the trade changed is dropped, so the screen only ever shows a route for what it shows.
@MainActor @Observable
final class TradeModel {
    /// Every token a swap can receive: STX first, then Charisma's token list
    private(set) var tokens: [TokenInfo] = []
    /// The contract ids the router can reach: the only tokens a swap can use
    private(set) var routable: Set<String> = []
    private(set) var loadError: Error?
    private(set) var route: Swap.Route?
    private(set) var quoteError: Error?
    private(set) var quoting = false

    private let charisma = Charisma()

    func loadTokens() async {
        do {
            async let reachable = Swap.routableTokens()
            let list = try await charisma.tokenList()
            routable = try await reachable
            // STX is on Charisma's list with its logo: take it from there, so its picture shows like every other token's
            guard let stx = list.first(where: { $0.contractId == TokenRow.stx }) else {
                throw WalletError.unexpected("Charisma's token list has no STX")
            }
            tokens = [stx] + list.filter { info in
                guard let id = info.contractId else { return false }
                // A Blaze subnet copy of a token is the same token on Blaze: swaps use the base token on Stacks
                return id != TokenRow.stx && info.type != "SUBNET" && routable.contains(id)
            }
            loadError = nil
        } catch is CancellationError {
            // The screen went away
        } catch {
            loadError = error
        }
    }

    /// Forgets the quote: the trade on screen has none yet
    func clearQuote() {
        route = nil
        quoteError = nil
        quoting = false
    }

    /// The best route for `amount` (smallest units) from `from` to `to`. Its reason, if there's none, is kept for the screen.
    func quote(from: String, to: String, amount: UInt64) async {
        quoting = true
        quoteError = nil
        route = nil
        defer { quoting = false }
        do {
            let found = try await Swap.quote(from: from, to: to, amount: amount)
            guard !Task.isCancelled else { return }
            route = found
        } catch is CancellationError {
            // The trade changed again: its own quote is on its way
        } catch {
            guard !Task.isCancelled else { return }
            quoteError = error
        }
    }
}
