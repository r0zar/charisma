import Foundation
import Testing
@testable import WalletCore

/// Counts calls and how many ran at once
private actor Calls {
    private(set) var total = 0
    private(set) var mostAtOnce = 0
    private var running = 0

    func start() {
        total += 1
        running += 1
        mostAtOnce = max(mostAtOnce, running)
    }

    func end() { running -= 1 }
}

private enum Down: Error { case down }

struct TokenCacheTests {
    let cha = TokenInfo(contractId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", name: "Charisma", symbol: "CHA", decimals: 6, identifier: "charisma")

    @Test func theListIsKeptForItsMaxAgeAndSharedBetweenCallers() async throws {
        let clock = TestClock()
        let cache = TokenCache(now: { clock.now })
        let calls = Calls()
        let load: @Sendable () async throws -> [TokenInfo] = { [cha] in
            await calls.start()
            try await Task.sleep(for: .milliseconds(50))
            await calls.end()
            return [cha]
        }
        // Two screens at once: one request
        async let first = cache.list(maxAge: 600, load: load)
        async let second = cache.list(maxAge: 600, load: load)
        let (a, b) = try await (first, second)
        #expect(a == [cha] && b == [cha])
        #expect(await calls.total == 1)
        // Within the 10 minutes: no request; after them, a new one; maxAge 0 always asks
        clock.advance(minutes: 9)
        _ = try await cache.list(maxAge: 600, load: load)
        #expect(await calls.total == 1)
        clock.advance(minutes: 2)
        _ = try await cache.list(maxAge: 600, load: load)
        #expect(await calls.total == 2)
        _ = try await cache.list(maxAge: 0, load: load)
        #expect(await calls.total == 3)
    }

    @Test func aFailedLoadIsAnErrorNeverTheOldList() async throws {
        let clock = TestClock()
        let cache = TokenCache(now: { clock.now })
        let good: @Sendable () async throws -> [TokenInfo] = { [cha] in [cha] }
        let down: @Sendable () async throws -> [TokenInfo] = { throw Down.down }
        _ = try await cache.list(maxAge: 600, load: good)
        clock.advance(minutes: 11)
        await #expect(throws: Down.down) { try await cache.list(maxAge: 600, load: down) }
        // And nothing failed is kept: the next ask loads again
        let next = try await cache.list(maxAge: 600, load: good)
        #expect(next == [cha])
    }

    @Test func detailsAreLookedUpOncePerSessionFourAtATime() async throws {
        let cache = TokenCache()
        let calls = Calls()
        let ids = (1...10).map { "SP000000000000000000002Q6VF78.token-\($0)" }
        let lookUp: @Sendable (String) async throws -> TokenInfo = { id in
            await calls.start()
            try await Task.sleep(for: .milliseconds(20))
            await calls.end()
            // One the service doesn't know, and one whose lookup fails for a passing reason
            guard !id.hasSuffix("-7") else { throw WalletError.requestFailed(.tokenList, status: 404) }
            guard !id.hasSuffix("-8") else { throw WalletError.requestFailed(.tokenList, status: 403) }
            return TokenInfo(contractId: id, name: id, symbol: "T", decimals: 0, identifier: "t")
        }
        let found = try await cache.details(of: ids, lookUp: lookUp)
        #expect(found.count == 8)
        #expect(found["SP000000000000000000002Q6VF78.token-7"] == nil)
        let (total, mostAtOnce) = (await calls.total, await calls.mostAtOnce)
        #expect(total == 10 && mostAtOnce <= 4)
        // Asked again: only the passing failure (the 403) is tried again; the unknown token isn't
        let again = try await cache.details(of: Array(ids.prefix(8)), lookUp: lookUp)
        #expect(again.count == 6)
        #expect(await calls.total == 11)
    }
}
