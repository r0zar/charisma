import Foundation
import P256K

/// A mainnet transaction from a single-sig account, serialized and signed byte-for-byte as @stacks/transactions 7 does
/// (standard auth, compressed key, anchor mode any, post condition mode deny)
public struct StacksTransaction: Hashable, Sendable {
    public enum Payload: Hashable, Sendable {
        /// Send STX, with an empty memo
        case stxTransfer(recipient: Principal, amount: UInt64)
        /// Call a public function of a contract
        case contractCall(contract: StacksAddress, contractName: String, functionName: String, arguments: [ClarityValue])
    }

    /// "`sender` sends exactly `amount` of `token`'s fungible token `asset`"
    public struct SendsExactly: Hashable, Sendable {
        public let sender: StacksAddress
        public let token: StacksAddress
        public let tokenName: String
        public let asset: String
        public let amount: UInt64
    }

    public let payload: Payload
    public let postConditions: [SendsExactly]
    /// The sender's 33-byte compressed public key
    public let publicKey: Data
    public let nonce: UInt64
    public let fee: UInt64
    /// 65 bytes, recovery id then r and s; all zeros until signed
    public let signature: Data

    private init(payload: Payload, postConditions: [SendsExactly] = [], publicKey: Data, nonce: UInt64 = 0, fee: UInt64 = 0) {
        self.init(payload: payload, postConditions: postConditions, publicKey: publicKey, nonce: nonce, fee: fee, signature: Self.emptySignature)
    }

    private init(payload: Payload, postConditions: [SendsExactly], publicKey: Data, nonce: UInt64, fee: UInt64, signature: Data) {
        self.payload = payload
        self.postConditions = postConditions
        self.publicKey = Data(publicKey)
        self.nonce = nonce
        self.fee = fee
        self.signature = Data(signature)
    }

    /// STX from `publicKey`'s account to `recipient`, in micro-STX
    public static func stxTransfer(to recipient: Principal, amount: UInt64, publicKey: Data, nonce: UInt64 = 0, fee: UInt64 = 0) -> StacksTransaction {
        StacksTransaction(payload: .stxTransfer(recipient: recipient, amount: amount), publicKey: publicKey, nonce: nonce, fee: fee)
    }

    /// A SIP-010 `transfer(amount, sender, recipient, none)`, guarded so exactly `amount` of `token::asset` leaves the sender
    public static func sip10Transfer(
        token: StacksAddress, tokenName: String, asset: String, amount: UInt64, to recipient: Principal,
        publicKey: Data, nonce: UInt64 = 0, fee: UInt64 = 0
    ) throws -> StacksTransaction {
        guard Principal.isContractName(tokenName) else { throw StacksError.invalidContractName }
        guard isClarityName(asset) else { throw StacksError.invalidAssetName }
        let sender = StacksAddress(publicKey: publicKey)
        return StacksTransaction(
            payload: .contractCall(
                contract: token, contractName: tokenName, functionName: "transfer",
                arguments: [.uint(UInt128(amount)), .principal(.standard(sender)), .principal(recipient), .none]
            ),
            postConditions: [SendsExactly(sender: sender, token: token, tokenName: tokenName, asset: asset, amount: amount)],
            publicKey: publicKey, nonce: nonce, fee: fee
        )
    }

    /// The payload alone, hex: what Hiro's fee estimate (`/v2/fees/transaction`) takes
    public var payloadHex: String { payload.serialized.hex }

    /// The signed size in bytes, which the fee estimate also takes (a single-sig signature is always 65 bytes)
    public var estimatedLength: Int { serialized.count }

    public var serialized: Data { bytes(nonce: nonce, fee: fee, signature: signature) }

    public var txid: String { SHA512_256.hash(serialized).hex }

    /// The hash the sender signs: the txid with nonce, fee and signature cleared, then auth type, fee and nonce
    public var presignHash: Data {
        let initial = SHA512_256.hash(bytes(nonce: 0, fee: 0, signature: Self.emptySignature))
        return SHA512_256.hash(initial + Data([Self.standardAuth]) + fee.bigEndianData + nonce.bigEndianData)
    }

    /// Signed with the account's private key (32 bytes, or 33 ending in 01), which must match `publicKey`
    public func signed(privateKey: Data) throws -> StacksTransaction {
        let keys = try AccountKeys(privateKey: privateKey)
        guard keys.publicKey == publicKey else { throw StacksError.invalidKey }
        let key = try P256K.Recovery.PrivateKey(dataRepresentation: Data(keys.privateKey.prefix(32)), format: .compressed)
        let compact = key.signature(for: HashDigest(Array(presignHash))).compactRepresentation
        let signature = Data([UInt8(compact.recoveryId)]) + compact.signature
        return StacksTransaction(payload: payload, postConditions: postConditions, publicKey: publicKey, nonce: nonce, fee: fee, signature: signature)
    }

    private static let emptySignature = Data(repeating: 0, count: 65)
    private static let standardAuth: UInt8 = 0x04

    private func bytes(nonce: UInt64, fee: UInt64, signature: Data) -> Data {
        var out = Data([0x00]) + UInt32(1).bigEndianData                   // mainnet, chain id 1
        out += Data([Self.standardAuth, 0x00]) + Hashing.hash160(publicKey) // standard auth, P2PKH signer
        out += nonce.bigEndianData + fee.bigEndianData
        out += Data([0x00]) + signature                                     // compressed key, signature
        out += Data([0x03, 0x02])                                           // anchor mode any, post conditions deny
        out += UInt32(postConditions.count).bigEndianData
        for condition in postConditions { out += condition.serialized }
        return out + payload.serialized
    }
}

extension StacksTransaction.Payload {
    var serialized: Data {
        switch self {
        case .stxTransfer(let recipient, let amount):
            Data([0x00]) + ClarityValue.principal(recipient).serialized + amount.bigEndianData + Data(repeating: 0, count: 34)
        case .contractCall(let contract, let contractName, let functionName, let arguments):
            Data([0x02, contract.version]) + contract.hash160 + lengthPrefixed(contractName) + lengthPrefixed(functionName)
                + UInt32(arguments.count).bigEndianData + arguments.reduce(Data()) { $0 + $1.serialized }
        }
    }
}

extension StacksTransaction.SendsExactly {
    var serialized: Data {
        Data([0x01, 0x02, sender.version]) + sender.hash160       // fungible, standard principal
            + Data([token.version]) + token.hash160 + lengthPrefixed(tokenName) + lengthPrefixed(asset)
            + Data([0x01]) + amount.bigEndianData                   // equal to
    }
}

/// Clarity's rule for asset names: a letter, then letters, digits or `-_!?+<>=/*`, at most 128 characters
private func isClarityName(_ name: String) -> Bool {
    guard let first = name.unicodeScalars.first, name.utf8.count <= 128, first.isASCII, CharacterSet.letters.contains(first) else {
        return false
    }
    return name.unicodeScalars.allSatisfy { $0.isASCII && (CharacterSet.alphanumerics.contains($0) || "-_!?+<>=/*".unicodeScalars.contains($0)) }
}

/// A 1-byte length, then the UTF-8 bytes
private func lengthPrefixed(_ text: String) -> Data {
    Data([UInt8(text.utf8.count)]) + Data(text.utf8)
}
