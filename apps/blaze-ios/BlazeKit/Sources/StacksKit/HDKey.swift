import CryptoKit
import Foundation
import P256K

/// BIP32 private-key derivation, only as far as Stacks accounts need it
struct HDKey {
    static let hardened: UInt32 = 0x8000_0000

    /// 32-byte secp256k1 private key
    let privateKey: Data
    let chainCode: Data

    /// The master key of a BIP39 seed
    init(seed: Data) throws {
        let digest = Self.hmac(key: Data("Bitcoin seed".utf8), data: seed)
        try self.init(privateKey: digest.prefix(32), chainCode: digest.suffix(32))
    }

    private init(privateKey: Data, chainCode: Data) throws {
        // Throws when the key is zero or not below the curve order
        _ = try Self.signingKey(privateKey)
        self.privateKey = Data(privateKey)
        self.chainCode = Data(chainCode)
    }

    /// The child at `index`; indexes from `hardened` up are hardened
    func child(_ index: UInt32) throws -> HDKey {
        let key = try Self.signingKey(privateKey)
        let parent = index >= Self.hardened ? Data([0]) + privateKey : key.publicKey.dataRepresentation
        let digest = Self.hmac(key: chainCode, data: parent + index.bigEndianData)
        do {
            return try HDKey(privateKey: try key.add(Array(digest.prefix(32))).dataRepresentation, chainCode: digest.suffix(32))
        } catch {
            throw StacksError.invalidKey
        }
    }

    func derive(_ path: [UInt32]) throws -> HDKey {
        try path.reduce(self) { try $0.child($1) }
    }

    static func signingKey(_ privateKey: Data) throws -> P256K.Signing.PrivateKey {
        do {
            return try P256K.Signing.PrivateKey(dataRepresentation: privateKey, format: .compressed)
        } catch {
            throw StacksError.invalidKey
        }
    }

    private static func hmac(key: Data, data: Data) -> Data {
        Data(CryptoKit.HMAC<CryptoKit.SHA512>.authenticationCode(for: data, using: CryptoKit.SymmetricKey(data: key)))
    }
}
