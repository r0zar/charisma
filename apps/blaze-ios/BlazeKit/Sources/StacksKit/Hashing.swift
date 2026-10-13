import CryptoKit
import Foundation

/// The hashes Stacks addresses and transactions are built from
enum Hashing {
    static func sha256(_ data: Data) -> Data { Data(CryptoKit.SHA256.hash(data: data)) }

    /// RIPEMD-160 of SHA-256: what a Stacks address commits to
    static func hash160(_ data: Data) -> Data { RIPEMD160.hash(sha256(data)) }
}
