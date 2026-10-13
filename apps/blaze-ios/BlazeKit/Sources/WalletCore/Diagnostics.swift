import Foundation
import StacksKit

/// An address's balance on one Blaze subnet, for Status
public struct SubnetBalance: Hashable, Identifiable, Sendable {
    public let contractId: String
    public let symbol: String
    public let decimals: Int
    /// The on-chain token it holds (".stx" for STX), when the token list says
    public let base: String?
    /// Smallest units; nil when the read failed (logged for developers, left out of "Holding your funds")
    public let balance: Int128?

    public var id: String { contractId }
}

/// Status's real checks: the Stacks network, Charisma's token list and every Blaze subnet (the extension's
/// background/lib/diagnostics.ts)
public struct Diagnostics: Sendable {
    public let checkedAt: Date
    public let blockHeight: Int
    public let networkLatency: Duration
    public let tokenCount: Int
    public let tokenListLatency: Duration
    public let subnets: [SubnetBalance]

    public static func check(address: StacksAddress, charisma: Charisma, hiro: Hiro, subnets: SubnetReader) async throws -> Diagnostics {
        let clock = ContinuousClock()
        async let network = clock.measured { try await hiro.tipHeight() }
        async let tokens = clock.measured { try await charisma.tokenList() }
        let (height, networkLatency) = try await network
        let (list, tokenListLatency) = try await tokens
        return Diagnostics(
            checkedAt: Date(), blockHeight: height, networkLatency: networkLatency,
            tokenCount: list.count, tokenListLatency: tokenListLatency,
            subnets: await subnets.balances(of: address, list: list)
        )
    }
}

/// Reads an address's balance on every subnet in the token list, four at a time (Hiro rate-limits), keeping the
/// answer for a minute so Status doesn't ask ~37 contracts again on every visit
public actor SubnetReader {
    private let hiro: Hiro
    private var kept: (address: StacksAddress, at: Date, balances: [SubnetBalance])?

    public init(hiro: Hiro) {
        self.hiro = hiro
    }

    public func balances(of address: StacksAddress, list: [TokenInfo]) async -> [SubnetBalance] {
        if let kept, kept.address == address, Date().timeIntervalSince(kept.at) < 60 { return kept.balances }
        let subnets = list.filter { info in
            guard info.type == "SUBNET" else { return false }
            guard info.contractId != nil, info.symbol != nil, info.decimals != nil else {
                // Without these its balance can't be shown honestly: a token-list data problem for developers
                Log.balances.error("Subnet \(info.contractId ?? "?", privacy: .public) has no contract id, symbol or decimals on the token list")
                return false
            }
            return true
        }
        var balances: [SubnetBalance] = []
        for start in stride(from: 0, to: subnets.count, by: 4) {
            let batch = subnets[start..<min(start + 4, subnets.count)]
            balances += await withTaskGroup(of: (Int, SubnetBalance).self) { group in
                for (offset, info) in batch.enumerated() {
                    group.addTask { [hiro] in (offset, await Self.read(info, of: address, hiro: hiro)) }
                }
                var results: [(Int, SubnetBalance)] = []
                for await result in group { results.append(result) }
                return results.sorted { $0.0 < $1.0 }.map(\.1)
            }
        }
        kept = (address, Date(), balances)
        return balances
    }

    /// `info` has a contract id, symbol and decimals (checked by `balances`)
    private static func read(_ info: TokenInfo, of address: StacksAddress, hiro: Hiro) async -> SubnetBalance {
        let id = info.contractId!
        // The token list calls STX's base "stx"; the wallet calls it ".stx"
        let base = info.base.map { $0 == "stx" ? TokenRow.stx : $0 }
        var balance: Int128?
        do {
            guard case .contract(let subnet, let name) = try Principal(id) else { throw WalletError.unexpected(id) }
            balance = try await hiro.subnetBalance(subnet: subnet, name: name, of: address)
        } catch {
            // A subnet that can't be read is a token-list data problem for developers, not news for the person
            Log.balances.error("Couldn't read subnet \(id, privacy: .public): \(error, privacy: .public)")
        }
        return SubnetBalance(contractId: id, symbol: info.symbol!, decimals: info.decimals!, base: base, balance: balance)
    }
}

private extension ContinuousClock {
    /// The work's result and how long it took
    func measured<T>(_ work: () async throws -> T) async rethrows -> (T, Duration) {
        let start = now
        let value = try await work()
        return (value, start.duration(to: now))
    }
}
