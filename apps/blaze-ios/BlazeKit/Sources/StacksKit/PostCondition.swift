import Foundation

/// Who a post-condition is about: a standard principal, or a contract
public enum PostConditionPrincipal: Hashable, Sendable {
    case standard(StacksAddress)
    case contract(StacksAddress, name: String)

    /// Its post-condition encoding: type 0x02 for a standard principal, 0x03 for a contract with its name
    var serialized: Data {
        switch self {
        case .standard(let address):
            Data([0x02, address.version]) + address.hash160
        case .contract(let address, let name):
            Data([0x03, address.version]) + address.hash160 + lengthPrefixed(name)
        }
    }
}

/// How much moved must be: exactly, more, less... (Stacks' fungible condition codes)
public enum ConditionCode: UInt8, Hashable, Sendable {
    case equal = 0x01
    case greater = 0x02
    case greaterOrEqual = 0x03
    case less = 0x04
    case lessOrEqual = 0x05
}

/// What a transaction guarantees about one principal's assets. The account's transactions run in deny mode: anything
/// that moves and isn't covered by one of these fails the transaction.
public enum PostCondition: Hashable, Sendable {
    /// `principal` sends `code` `amount` micro-STX
    case stx(principal: PostConditionPrincipal, code: ConditionCode, amount: UInt64)
    /// `principal` sends `code` `amount` of `token`'s fungible token `asset`
    case fungible(principal: PostConditionPrincipal, token: StacksAddress, tokenName: String, asset: String, code: ConditionCode, amount: UInt64)

    /// The same condition for `amount` more (the same principal and asset, as the router's builder combines them)
    func adding(_ extra: UInt64) throws -> PostCondition {
        func sum(_ amount: UInt64) throws -> UInt64 {
            let (total, overflow) = amount.addingReportingOverflow(extra)
            guard !overflow else { throw StacksError.amountOverflow }
            return total
        }
        switch self {
        case .stx(let principal, let code, let amount):
            return .stx(principal: principal, code: code, amount: try sum(amount))
        case .fungible(let principal, let token, let tokenName, let asset, let code, let amount):
            return .fungible(principal: principal, token: token, tokenName: tokenName, asset: asset, code: code, amount: try sum(amount))
        }
    }

    var serialized: Data {
        switch self {
        case .stx(let principal, let code, let amount):
            Data([0x00]) + principal.serialized + Data([code.rawValue]) + amount.bigEndianData
        case .fungible(let principal, let token, let tokenName, let asset, let code, let amount):
            Data([0x01]) + principal.serialized
                + Data([token.version]) + token.hash160 + lengthPrefixed(tokenName) + lengthPrefixed(asset)
                + Data([code.rawValue]) + amount.bigEndianData
        }
    }
}
