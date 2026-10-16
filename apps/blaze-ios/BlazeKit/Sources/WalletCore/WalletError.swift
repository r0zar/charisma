import Foundation

/// The servers the wallet talks to, named in errors
public enum Service: String, Sendable {
    /// Charisma's balance service, swap.charisma.rocks
    case balances
    /// Charisma's token list, tokens.charisma.rocks
    case tokenList
    /// Charisma's price feed, prices.charisma.rocks
    case prices
    /// The Stacks network, through Hiro (api.hiro.so)
    case stacks
}

/// Everything WalletCore can fail with. WalletCore has no words for people: the app's String Catalog words each case.
public enum WalletError: Error, Equatable, Sendable {
    // The wallet
    case locked
    case invalidSeedPhrase
    case seedPhraseNameTaken(String)
    case seedPhraseNotFound
    case accountNotFound

    // Servers
    /// The server answered with this HTTP status
    case requestFailed(Service, status: Int)
    /// The server couldn't be reached (offline, timed out)
    case unreachable(Service)
    /// The server answered with something WalletCore can't read
    case unreadable(Service)
    /// The token list came back empty, so tokens can't be checked against its block list
    case tokenListUnavailable

    // Sending
    case invalidRecipient
    /// Not a number in the locale's format; the app shows an example with the locale's decimal mark
    case invalidAmount
    case tooManyDecimals(max: Int)
    case amountNotPositive
    /// More than the Standard balance, which is what sends spend (`available` in smallest units)
    case moreThanBalance(available: Int128)
    /// More than one transfer can carry: Stacks transfers and post conditions hold at most UInt64.max smallest units
    case amountTooLarge
    /// The token can't be sent from the wallet, and why. `symbol` is its symbol, or its contract id when unknown.
    case unsendable(Unsendable, symbol: String)
    /// The fee, plus the amount for an STX send, doesn't fit the STX balance. `mostSendable` is set for STX sends.
    case notEnoughSTXForFee(fee: Int128, stxBalance: Int128, mostSendable: Int128?)
    /// The network refused the transaction; `reason` is the node's own text
    case rejected(reason: String)

    /// Text from a server or library that has no case of its own; the app shows it after a translated lead-in
    case unexpected(String)
}
