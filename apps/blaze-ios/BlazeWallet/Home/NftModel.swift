import Foundation
import Observation
import WalletCore

/// The account's NFTs, a page at a time, with each one's details as its contract gives them
@MainActor @Observable
final class NftModel {
    static let pageSize = 12

    let address: String
    private(set) var items: [NftItem]?
    private(set) var total = 0
    private(set) var busy = false
    private(set) var error: Error?

    init(address: String) {
        self.address = address
    }

    var hasMore: Bool { (items?.count ?? 0) < total }

    /// The first page, from scratch
    func load() async {
        items = nil
        await fetch(offset: 0)
    }

    /// The next page after the NFTs on screen
    func loadMore() async {
        await fetch(offset: items?.count ?? 0)
    }

    private func fetch(offset: Int) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let page = try await Nfts.page(address: address, offset: offset, limit: Self.pageSize)
            items = (items ?? []) + page.items
            total = page.total
        } catch is CancellationError {
            // The screen went away or the account changed
        } catch {
            self.error = error
        }
    }
}
