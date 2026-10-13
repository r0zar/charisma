import CommonCrypto
import Foundation
import Security

/// BIP39 seed phrases with the English word list, as @scure/bip39 and @stacks/wallet-sdk use them
public enum Mnemonic {
    /// The cleanup for every typed or pasted seed phrase (translations spec, "Seed word entry"). Full-width letters
    /// and spaces become normal ones (NFKC), Turkish İ and ı become i, then lowercase without a locale (a Turkish
    /// locale would turn I into ı) and single spaces between words.
    public static func normalize(_ text: String) -> String {
        text.precomposedStringWithCompatibilityMapping
            .replacingOccurrences(of: "İ", with: "i")
            .replacingOccurrences(of: "ı", with: "i")
            .lowercased()
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }

    /// A new 24-word phrase from 256 bits of system randomness
    public static func generate() throws -> String {
        var entropy = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, entropy.count, &entropy) == errSecSuccess else {
            throw StacksError.randomUnavailable
        }
        return phrase(entropy: Data(entropy))
    }

    /// Whether `phrase` (already normalized) is 12, 15, 18, 21 or 24 listed words with a matching checksum
    public static func isValid(_ phrase: String) -> Bool { (try? entropy(of: phrase)) != nil }

    /// The 64-byte BIP39 seed of a valid, normalized phrase: PBKDF2-HMAC-SHA512, 2048 rounds, no passphrase
    public static func seed(_ phrase: String) throws -> Data {
        _ = try entropy(of: phrase)
        let password = phrase.decomposedStringWithCompatibilityMapping
        let salt = Array("mnemonic".utf8)
        var seed = [UInt8](repeating: 0, count: 64)
        let status = CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2), password, password.utf8.count, salt, salt.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA512), 2048, &seed, seed.count
        )
        guard status == Int32(kCCSuccess) else { throw StacksError.invalidSeedPhrase }
        return Data(seed)
    }

    /// The words for 16 to 32 bytes of entropy: 11 bits per word, the checksum taken from SHA-256 of the entropy
    static func phrase(entropy: Data) -> String {
        let hash = Hashing.sha256(entropy)
        let bits = Self.bits(of: entropy) + Self.bits(of: hash).prefix(entropy.count / 4)
        return stride(from: 0, to: bits.count, by: 11)
            .map { bip39English[Self.number(bits[$0..<$0 + 11])] }
            .joined(separator: " ")
    }

    static func entropy(of phrase: String) throws -> Data {
        let words = phrase.split(separator: " ")
        guard [12, 15, 18, 21, 24].contains(words.count) else { throw StacksError.invalidSeedPhrase }
        var bits: [Bool] = []
        for word in words {
            guard let index = wordIndex[String(word)] else { throw StacksError.invalidSeedPhrase }
            bits += (0..<11).reversed().map { index >> $0 & 1 == 1 }
        }
        let checksumBits = words.count / 3
        let entropyBits = bits.count - checksumBits
        let entropy = Data(stride(from: 0, to: entropyBits, by: 8).map { UInt8(Self.number(bits[$0..<$0 + 8])) })
        guard Array(Self.bits(of: Hashing.sha256(entropy)).prefix(checksumBits)) == Array(bits.suffix(checksumBits)) else {
            throw StacksError.invalidSeedPhrase
        }
        return entropy
    }

    private static let wordIndex = Dictionary(uniqueKeysWithValues: bip39English.enumerated().map { ($1, $0) })

    private static func bits(of data: Data) -> [Bool] {
        data.flatMap { byte in (0..<8).reversed().map { byte >> $0 & 1 == 1 } }
    }

    private static func number(_ bits: ArraySlice<Bool>) -> Int {
        bits.reduce(0) { $0 << 1 | ($1 ? 1 : 0) }
    }
}
