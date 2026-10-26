import Foundation
import StacksKit

/// A swap through Charisma's router, as the extension makes it (apps/signet/src/shared/trade/swap.ts and
/// background/lib/swap.ts). The best route comes from Charisma's swap service. Every pool on it must be on Charisma's
/// vault list with the same settings. The router's own call, with its post-conditions, is built from that route, and
/// the account signs only what the review showed.
public enum Swap {
    static let quoteURL = URL(string: "https://swap.charisma.rocks/api/v1/quote")!
    static let vaultsURL = URL(string: "https://invest.charisma.rocks/api/v1/vaults")!
    /// Charisma's router: the only contract a swap calls
    static let router = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop"
    /// The router's default slippage: 1 %
    static let slippage = 0.01
    /// The router's opcodes for depositing into and withdrawing from a pool (the others are swaps and liquidity)
    static let opcodeDeposit = 0x05
    static let opcodeWithdraw = 0x06

    static let http = HTTP(session: .shared)

    /// A token on a route
    public struct Token: Decodable, Hashable, Sendable {
        /// ".stx", or the token's contract id
        public let contractId: String
        public let symbol: String?
        public let decimals: Int?
        /// The asset name a fungible token's post-conditions need; nil for STX
        public let identifier: String?
    }

    /// A pool, as Charisma's vault list describes it
    public struct Vault: Decodable, Hashable, Sendable {
        /// The pool's contract (the router's `pool` argument)
        public let contractId: String
        /// The contract that holds the pool's funds, when it isn't the vault itself
        public let externalPoolId: String?
        /// The asset this pool swaps STX through ("contract::asset"), e.g. Arkadiko's wSTX
        public let stxWrapper: String?
        /// The pool sends part of the input on to a fee address, so it sends some of the input token too
        public let forwardsInputFee: Bool?
        /// The pool's second token, as a contract reference
        public let tokenB: ContractRef?

        public struct ContractRef: Decodable, Hashable, Sendable {
            public let contractId: String?
        }
    }

    /// One pool on a route: the router's opcode for it, the tokens going in and out, and the quote's amounts
    public struct Hop: Decodable, Hashable, Sendable {
        public struct Quote: Decodable, Hashable, Sendable {
            public let amountIn: Double
            public let amountOut: Double
        }

        public let vault: Vault
        public let tokenIn: Token
        public let tokenOut: Token
        public let opcode: Int
        public let quote: Quote?
    }

    /// The best route for a trade: its tokens in order, its pools, and the amounts in smallest units
    public struct Route: Decodable, Hashable, Sendable {
        public let path: [Token]
        public let hops: [Hop]
        public let amountIn: Double
        public let amountOut: Double
    }

    /// The router's call for a route: its function, arguments and post-conditions
    public struct Call: Hashable, Sendable {
        /// "swap-N" for N hops
        public let functionName: String
        public let arguments: [ClarityValue]
        public let postConditions: [PostCondition]
    }

    /// A swap ready to sign: the route, what it sends and the least it may return, and the network fee
    public struct Review: Hashable, Sendable {
        public let route: Route
        public let call: Call
        /// Smallest units of the input token
        public let amountIn: UInt64
        /// The least the output token may come to: the quote less the router's slippage
        public let minimumOut: UInt64
        /// Micro-STX
        public let fee: UInt64
    }

    /// The best route for `amount` (smallest units of `tokenIn`) from `tokenIn` to `tokenOut`. A route that can't be
    /// found throws the service's reason, such as "No route found".
    public static func quote(from tokenIn: String, to tokenOut: String, amount: UInt64) async throws -> Route {
        struct Answer: Decodable {
            let success: Bool
            let data: Route?
            let error: String?
        }
        var components = URLComponents(url: quoteURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "tokenIn", value: tokenIn),
            URLQueryItem(name: "tokenOut", value: tokenOut),
            URLQueryItem(name: "amount", value: String(amount)),
        ]
        guard let url = components?.url else { throw WalletError.unexpected("The quote address") }
        let (data, response) = try await http.answer(URLRequest(url: url), from: .swap)
        guard let answer = try? JSONDecoder().decode(Answer.self, from: data) else {
            throw response.statusCode == 200 ? WalletError.unreadable(.swap) : WalletError.requestFailed(.swap, status: response.statusCode)
        }
        if response.statusCode == 200, answer.success, let route = answer.data { return route }
        throw WalletError.unexpected(answer.error ?? "No route found")
    }

    /// Every pool on the route must be on Charisma's vault list, with the same settings. Otherwise nothing is built.
    public static func verify(_ route: Route) async throws {
        struct Answer: Decodable {
            let status: String
            let data: [Lenient<Vault>]
        }
        let answer = try await http.get(vaultsURL, from: .swap, as: Answer.self)
        guard answer.status == "success" else { throw WalletError.unexpected("Charisma's vault list isn't available") }
        let vaults = answer.data.compactMap(\.value)
        for hop in route.hops {
            guard let known = vaults.first(where: { $0.contractId == hop.vault.contractId }),
                  (known.externalPoolId ?? "") == (hop.vault.externalPoolId ?? ""),
                  (known.stxWrapper ?? "") == (hop.vault.stxWrapper ?? ""),
                  (known.forwardsInputFee ?? false) == (hop.vault.forwardsInputFee ?? false)
            else {
                throw WalletError.unexpected("The route goes through a pool that isn't on Charisma's vault list: \(hop.vault.contractId)")
            }
        }
    }

    /// The router's call for a route, built as the router's own builder (dexterity-sdk) builds it
    public static func call(for route: Route, sender: StacksAddress) throws -> Call {
        var arguments: [ClarityValue] = [.uint(UInt128(try micro(route.amountIn)))]
        for hop in route.hops {
            guard let opcode = UInt8(exactly: hop.opcode) else { throw WalletError.unexpected("opcode \(hop.opcode)") }
            // The router's opcode is an optional 16-byte buffer: the opcode, then zeros
            var bytes = Data(count: 16)
            bytes[0] = opcode
            arguments.append(.tuple([
                "opcode": ClarityValue.some(.buffer(bytes)),
                "pool": .principal(try Principal(hop.vault.contractId)),
            ]))
        }
        return Call(
            functionName: "swap-\(route.hops.count)",
            arguments: arguments,
            postConditions: try postConditions(for: route, sender: sender)
        )
    }

    /// Every post-condition the router's builder makes for the route, combined per principal and asset as it combines them
    static func postConditions(for route: Route, sender: StacksAddress) throws -> [PostCondition] {
        let me = PostConditionPrincipal.standard(sender)
        var conditions: [PostCondition] = []
        var index: [String: Int] = [:]
        func add(_ condition: PostCondition, to principal: PostConditionPrincipal, asset: String) throws {
            let key = principal.serialized.hex + "|" + asset
            if let at = index[key] {
                conditions[at] = try conditions[at].adding(amountOf(condition))
            } else {
                index[key] = conditions.count
                conditions.append(condition)
            }
        }

        for hop in route.hops {
            let amountIn = try micro(hop.quote?.amountIn ?? 0)
            let amountOut = try micro(hop.quote?.amountOut ?? 0)
            let maxIn = try micro((Double(amountIn) * (1 + slippage)).rounded(.down))
            let minOut = try micro((Double(amountOut) * (1 - slippage)).rounded(.down))
            let maxOut = try micro((Double(amountOut) * (1 + slippage)).rounded(.up))
            let pool = try party(nonEmpty(hop.vault.externalPoolId) ?? hop.vault.contractId)

            func put(_ token: Token, _ principal: PostConditionPrincipal, _ code: ConditionCode, _ amount: UInt64) throws {
                try add(try condition(token, principal, code, amount), to: principal, asset: assetKey(token))
            }
            func putWrapper(_ wrapper: String, _ principal: PostConditionPrincipal, _ code: ConditionCode, _ amount: UInt64) throws {
                try add(try wrapperCondition(wrapper, principal, code, amount), to: principal, asset: wrapper)
            }

            switch hop.opcode {
            case opcodeDeposit:
                // Deposits move whatever the previous hop delivered, which can differ from the quote by the slippage
                try put(hop.tokenIn, me, .lessOrEqual, maxIn)
            case opcodeWithdraw:
                let holder = nonEmpty(hop.vault.externalPoolId) ?? nonEmpty(hop.vault.tokenB?.contractId) ?? hop.vault.contractId
                try put(hop.tokenOut, try party(holder), .greaterOrEqual, minOut)
            default:
                try put(hop.tokenIn, me, .lessOrEqual, maxIn)
                try put(hop.tokenOut, pool, .greaterOrEqual, minOut)
                if let wrapper = nonEmpty(hop.vault.stxWrapper) {
                    // STX in is wrapped, with the sender paying the wrapper in; STX out arrives as the wrapper
                    if hop.tokenIn.contractId == TokenRow.stx {
                        try putWrapper(wrapper, me, .lessOrEqual, maxIn)
                    }
                    if hop.tokenOut.contractId == TokenRow.stx {
                        try putWrapper(wrapper, pool, .greaterOrEqual, minOut)
                        try putWrapper(wrapper, me, .lessOrEqual, maxOut)
                    }
                }
                if hop.vault.forwardsInputFee == true {
                    // The pool forwards a slice of the input to its fee address: never more than the input
                    try put(hop.tokenIn, pool, .lessOrEqual, maxIn)
                }
            }
        }
        return conditions
    }

    /// Checks the route against the vault list, builds the router's call and estimates the fee. The fee comes out of
    /// the STX balance (`stx`), and so does the amount when the input is STX.
    public static func review(route: Route, from: TokenRow, amount: UInt64, stx: TokenRow, account: Account, hiro: Hiro) async throws -> Review {
        guard Int128(amount) <= from.standard else { throw WalletError.moreThanBalance(available: max(from.standard, 0)) }
        try await verify(route)
        let call = try call(for: route, sender: try StacksAddress(account.stxAddress))
        let estimate = try unsigned(call, publicKey: try publicKey(of: account), nonce: 0, fee: 0)
        let fee = try await hiro.estimateFee(for: estimate)
        try Send.checkFee(Int128(fee), amount: Int128(amount), row: from, stxBalance: stx.standard)
        let minimumOut = try micro((route.amountOut * (1 - slippage)).rounded(.down))
        return Review(route: route, call: call, amountIn: amount, minimumOut: minimumOut, fee: fee)
    }

    /// Signs the reviewed swap with the account's key at its next nonce. Keep the result: after a failed broadcast, try
    /// `broadcast` again with this same transaction, never a new signature, as sends do.
    public static func sign(_ review: Review, from account: Account, hiro: Hiro) async throws -> StacksTransaction {
        let nonce = try await hiro.nextNonce(address: account.stxAddress)
        let transaction = try unsigned(review.call, publicKey: try publicKey(of: account), nonce: nonce, fee: review.fee)
        do {
            return try transaction.signed(privateKey: Data(hex: account.privateKey))
        } catch {
            throw WalletError.unexpected(String(describing: error))
        }
    }

    /// Sends a signed swap to the network. Returns its txid.
    public static func broadcast(_ signed: StacksTransaction, hiro: Hiro) async throws -> String {
        try await hiro.broadcast(signed)
    }

    private static func unsigned(_ call: Call, publicKey: Data, nonce: UInt64, fee: UInt64) throws -> StacksTransaction {
        guard case .contract(let address, let name) = try Principal(router) else { throw WalletError.unexpected(router) }
        return try StacksTransaction.contractCall(
            contract: address, contractName: name, functionName: call.functionName, arguments: call.arguments,
            postConditions: call.postConditions, publicKey: publicKey, nonce: nonce, fee: fee
        )
    }

    private static func publicKey(of account: Account) throws -> Data {
        do {
            return try Data(hex: account.publicKey)
        } catch {
            throw WalletError.unexpected(String(describing: error))
        }
    }

    /// A route amount as smallest units: a whole, non-negative number
    private static func micro(_ value: Double) throws -> UInt64 {
        guard value >= 0, value < 18_446_744_073_709_551_615, value == value.rounded(.down) else {
            throw WalletError.unexpected("amount \(value)")
        }
        return UInt64(value)
    }

    private static func nonEmpty(_ text: String?) -> String? {
        guard let text, !text.isEmpty else { return nil }
        return text
    }

    /// A principal in a post-condition: a standard principal, or a contract
    private static func party(_ text: String) throws -> PostConditionPrincipal {
        switch try Principal(text) {
        case .standard(let address): return .standard(address)
        case .contract(let address, let name): return .contract(address, name: name)
        }
    }

    /// STX's post-condition, or a fungible token's, by its contract and asset name
    private static func condition(_ token: Token, _ principal: PostConditionPrincipal, _ code: ConditionCode, _ amount: UInt64) throws -> PostCondition {
        guard token.contractId != TokenRow.stx else { return .stx(principal: principal, code: code, amount: amount) }
        guard let asset = token.identifier, !asset.isEmpty, case .contract(let address, let name) = try Principal(token.contractId) else {
            throw WalletError.unexpected("\(token.contractId) has no asset name")
        }
        return .fungible(principal: principal, token: address, tokenName: name, asset: asset, code: code, amount: amount)
    }

    /// A wrapper token's post-condition: the wrapper is "contract::asset"
    private static func wrapperCondition(_ wrapper: String, _ principal: PostConditionPrincipal, _ code: ConditionCode, _ amount: UInt64) throws -> PostCondition {
        let parts = wrapper.components(separatedBy: "::")
        guard parts.count == 2, case .contract(let address, let name) = try Principal(parts[0]) else {
            throw WalletError.unexpected("wrapper \(wrapper)")
        }
        return .fungible(principal: principal, token: address, tokenName: name, asset: parts[1], code: code, amount: amount)
    }

    /// What a post-condition is about, for combining: STX, or a token's contract and asset
    private static func assetKey(_ token: Token) -> String {
        token.contractId == TokenRow.stx ? "STX" : "\(token.contractId)::\(token.identifier ?? "")"
    }

    private static func amountOf(_ condition: PostCondition) -> UInt64 {
        switch condition {
        case .stx(_, _, let amount), .fungible(_, _, _, _, _, let amount): amount
        }
    }
}

/// One entry of a list that may hold entries this build can't read: those are dropped, and the rest still load
struct Lenient<Value: Decodable>: Decodable {
    let value: Value?

    init(from decoder: Decoder) throws {
        value = try? Value(from: decoder)
    }
}
