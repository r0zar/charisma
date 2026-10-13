import Foundation

/// One Stacks account's keys and address, derived as @stacks/wallet-sdk does: m/44'/5757'/0'/0/{index}
public struct AccountKeys: Hashable, Sendable {
    /// 33 bytes: the private key with the 0x01 "compressed" suffix, as wallet-sdk's `stxPrivateKey`
    public let privateKey: Data
    /// 33-byte compressed public key
    public let publicKey: Data
    /// Mainnet single-sig address (SP…)
    public let address: StacksAddress

    /// Account `index` (0 is "Account 1") of a valid, normalized seed phrase
    public static func derive(phrase: String, index: UInt32) throws -> AccountKeys {
        guard index < HDKey.hardened else { throw StacksError.invalidKey }
        let path = [44 | HDKey.hardened, 5757 | HDKey.hardened, 0 | HDKey.hardened, 0, index]
        let child = try HDKey(seed: Mnemonic.seed(phrase)).derive(path)
        return try AccountKeys(privateKey: child.privateKey)
    }

    /// From a stored private key: 32 bytes, or 33 ending in 01
    public init(privateKey: Data) throws {
        let key = Data(privateKey)
        guard key.count == 32 || (key.count == 33 && key.last == 0x01) else { throw StacksError.invalidKey }
        let secret = Data(key.prefix(32))
        self.privateKey = secret + Data([0x01])
        self.publicKey = try HDKey.signingKey(secret).publicKey.dataRepresentation
        self.address = StacksAddress(publicKey: publicKey)
    }
}
