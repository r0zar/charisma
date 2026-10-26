import Foundation
import P256K

/// SIP-018 structured data: a message signed under a domain, as @stacks/transactions' signStructuredData signs it. The
/// Blaze protocol signs its orders this way, so a signature here is the one the subnet checks.
public enum StructuredData {
    /// The bytes SIP-018 puts first: "SIP018"
    static let prefix = Data([0x53, 0x49, 0x50, 0x30, 0x31, 0x38])

    /// The signature of `message` under `domain`: 65 bytes, r then s then the recovery id. The key is 32 bytes (a
    /// 33-byte compressed key ending in 01 works too: its first 32 bytes are used).
    public static func sign(message: ClarityValue, domain: ClarityValue, privateKey: Data) throws -> Data {
        let digest = Hashing.sha256(prefix + Hashing.sha256(domain.serialized) + Hashing.sha256(message.serialized))
        let key = try P256K.Recovery.PrivateKey(dataRepresentation: privateKey.prefix(32), format: .compressed)
        let compact = key.signature(for: HashDigest(Array(digest))).compactRepresentation
        return compact.signature + Data([UInt8(compact.recoveryId)])
    }
}
