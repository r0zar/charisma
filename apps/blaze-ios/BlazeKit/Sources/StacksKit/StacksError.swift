/// Everything StacksKit can refuse. StacksKit has no words for people: the app turns each case into a message.
public enum StacksError: Error, Equatable, Sendable {
    /// Not hex, or an odd number of digits
    case invalidHex
    /// A word not on the list, the wrong number of words, or a checksum that doesn't match
    case invalidSeedPhrase
    /// The system couldn't provide randomness for a new seed phrase
    case randomUnavailable
    /// Not a c32check Stacks address, or its checksum doesn't match (the SP/SM-only rule is WalletCore's recipient check)
    case invalidAddress
    /// Not a valid contract name (a letter, then letters, digits, - or _, at most 128 characters)
    case invalidContractName
    /// A private key that isn't 32 bytes (or 33 ending in 01), or isn't a valid secp256k1 key
    case invalidKey
    /// Bytes that aren't one of the Clarity values StacksKit reads
    case invalidClarityValue
}
