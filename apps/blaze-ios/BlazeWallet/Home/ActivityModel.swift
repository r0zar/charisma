import Foundation
import Observation
import WalletCore

/// The account's transactions, a page at a time, newest first. Each token a transfer names gets its symbol and
/// decimals from Charisma's list (or its lookup); one that can't be named shows raw, as the extension does.
@MainActor @Observable
final class ActivityModel {
    static let pageSize = 20

    let address: String
    private(set) var rows: [ActivityRow]?
    private(set) var hasMore = false
    private(set) var busy = false
    private(set) var error: Error?
    /// Token details by contract id, for the contracts the loaded rows name
    private(set) var tokens: [String: TokenInfo] = [:]

    private let hiro = Hiro()
    private let charisma = Charisma()

    init(address: String) {
        self.address = address
    }

    /// The first page, from scratch
    func load() async {
        rows = nil
        await fetch(offset: 0)
    }

    /// The next page after the rows on screen
    func loadMore() async {
        await fetch(offset: rows?.count ?? 0)
    }

    private func fetch(offset: Int) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let page = try await hiro.activity(address: address, offset: offset, limit: Self.pageSize)
            let known = try await charisma.tokenList()
            var details: [String: TokenInfo] = [:]
            for info in known {
                if let id = info.contractId { details[id] = info }
            }
            // Contracts the list doesn't name (STX aside) are looked up, once per session
            let unknown = Set(page.flatMap(\.moves).map(\.contractId))
                .filter { $0 != TokenRow.stx && details[$0] == nil }
            for (id, info) in try await charisma.lookUp(Array(unknown)) {
                details[id] = info
            }
            tokens = details
            rows = (rows ?? []) + page
            hasMore = page.count == Self.pageSize
        } catch is CancellationError {
            // The screen went away or the account changed
        } catch {
            self.error = error
        }
    }
}
