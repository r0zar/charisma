import Foundation

/// Charisma's balance sheet for an address (blaze-sdk `BalanceSheet`), only the fields the wallet reads
public struct BalanceSheet: Decodable, Sendable {
    public struct Token: Decodable, Sendable {
        /// The on-chain token a subnet holds (".stx" for STX); nil for a token on Stacks itself
        public let base: String?
        /// Smallest units, counting what's on its way; nil when the chain couldn't be read
        public let ready: String?
        /// Why `ready` is nil
        public let error: String?

        public init(base: String? = nil, ready: String?, error: String? = nil) {
            self.base = base
            self.ready = ready
            self.error = error
        }
    }

    public let address: String
    public let tokens: [String: Token]

    public init(address: String, tokens: [String: Token]) {
        self.address = address
        self.tokens = tokens
    }
}

/// A token as Charisma's token list describes it (`/api/v1/sip10`), only the fields the wallet reads
public struct TokenInfo: Decodable, Hashable, Sendable {
    /// Always set in the list; one-token lookups may leave it out
    public let contractId: String?
    public let name: String?
    public let symbol: String?
    public let decimals: Int?
    public let image: String?
    /// The fungible token's asset name, which post conditions need
    public let identifier: String?
    /// "SUBNET" for Blaze subnets
    public let type: String?
    /// For a subnet: the on-chain token it holds
    public let base: String?

    public init(
        contractId: String?, name: String?, symbol: String?, decimals: Int?, image: String? = nil,
        identifier: String?, type: String? = nil, base: String? = nil
    ) {
        self.contractId = contractId
        self.name = name
        self.symbol = symbol
        self.decimals = decimals
        self.image = image
        self.identifier = identifier
        self.type = type
        self.base = base
    }
}
