import Foundation

/// Charisma's servers: balances (the same service Swap and Meme Roulette use), the token list and USD prices
public struct Charisma: Sendable {
    static let balances = URL(string: "https://swap.charisma.rocks/api/v1/balances")!
    static let tokens = URL(string: "https://tokens.charisma.rocks/api/v1/sip10")!
    static let prices = URL(string: "https://lakehouse.charisma.rocks/api/token-prices?limit=1000")!

    let http: HTTP

    public init(session: URLSession = .shared) {
        http = HTTP(session: session)
    }

    public func balanceSheet(address: String) async throws -> BalanceSheet {
        try await http.get(Self.balances.appending(path: address).appending(path: "sheet"), from: .balances)
    }

    /// Charisma's token list. Blocking a token (a scam) takes it off this list, so an empty list is an error.
    public func tokenList() async throws -> [TokenInfo] {
        let list = try await http.get(Self.tokens, from: .tokenList, as: [TokenInfo].self)
        guard !list.isEmpty else { throw WalletError.tokenListUnavailable }
        return list
    }

    /// One token's details, for tokens that aren't on the list
    public func token(_ contractId: String) async throws -> TokenInfo {
        struct Answer: Decodable { let data: TokenInfo }
        return try await http.get(Self.tokens.appending(path: contractId), from: .tokenList, as: Answer.self).data
    }

    /// Details for tokens that aren't on the list, all at once. A failed lookup is logged and left out, so that token
    /// shows as unknown (the extension's rule): one bad token never blanks the Tokens tab. Throws only
    /// CancellationError.
    public func lookUp(_ contractIds: [String]) async throws -> [String: TokenInfo] {
        try await withThrowingTaskGroup(of: (String, TokenInfo?).self) { group in
            for id in contractIds {
                group.addTask {
                    do {
                        return (id, try await token(id))
                    } catch is CancellationError {
                        // The screen went away: not a failed lookup
                        throw CancellationError()
                    } catch {
                        Log.balances.error("Couldn't look up \(id, privacy: .public): \(error, privacy: .public)")
                        return (id, nil)
                    }
                }
            }
            var found: [String: TokenInfo] = [:]
            for try await (id, info) in group {
                if let info { found[id] = info }
            }
            return found
        }
    }

    /// USD per whole token, by contract id (".stx" for STX)
    public func usdPrices() async throws -> [String: Double] {
        struct Price: Decodable {
            let token_contract_id: String
            let usd_price: Double
        }
        struct Answer: Decodable { let prices: [Price] }
        let prices = try await http.get(Self.prices, from: .prices, as: Answer.self).prices
        return Dictionary(prices.map { ($0.token_contract_id, $0.usd_price) }, uniquingKeysWith: { first, _ in first })
    }

    /// The address's balance sheet now and every time it changes, pushed by the service (no polling). Reconnects on
    /// its own like blaze-sdk's watchBalances: about a second after the service closes a stream (it does every few
    /// minutes), and 1 s doubling to 30 s after errors. `problem` events are ignored, as in the extension. Stops when
    /// the consuming task is cancelled.
    public func watchBalances(address: String) -> AsyncStream<BalanceSheet> {
        let request = {
            var request = URLRequest(url: Self.balances.appending(path: address).appending(path: "stream"))
            request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
            request.cachePolicy = .reloadIgnoringLocalCacheData
            return request
        }()
        let session = http.session
        // Only the newest sheet matters: an older one waiting in the buffer is already out of date
        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let task = Task {
                var wait: Double = 1
                while !Task.isCancelled {
                    do {
                        let (bytes, response) = try await session.bytes(for: request)
                        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                        guard status == 200 else { throw WalletError.requestFailed(.balances, status: status) }
                        wait = 1
                        // Each event is one `event:` line and one `data:` line (`lines` skips the blank line between)
                        var event = ""
                        for try await line in bytes.lines {
                            if line.hasPrefix("event:") {
                                event = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
                            } else if line.hasPrefix("data:"), event == "sheet" {
                                let data = Data(line.dropFirst(5).trimmingCharacters(in: .whitespaces).utf8)
                                continuation.yield(try JSONDecoder().decode(BalanceSheet.self, from: data))
                                event = ""
                            }
                        }
                    } catch {
                        if Task.isCancelled { break }
                        // A URLError's own description names the URL, which holds the address
                        Log.network.error("balance stream: \((error as? URLError)?.localizedDescription ?? "\(error)", privacy: .public)")
                        wait = min(wait * 2, 30)
                    }
                    try? await Task.sleep(for: .seconds(wait))
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
