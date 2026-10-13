import Foundation

/// vectors.json, written by apps/signet/scripts/ios-vectors.mjs from the extension's own libraries
struct Vectors: Decodable {
    struct Account: Decodable {
        let index: UInt32
        let privateKey: String
        let publicKey: String
        let address: String
    }

    struct Phrase: Decodable {
        let phrase: String
        let seed: String
        let accounts: [Account]
    }

    struct Transaction: Decodable {
        let name: String
        let kind: String
        let contract: String?
        let asset: String?
        let recipient: String
        let amount: String
        let senderKey: String
        let nonce: String
        let fee: String
        let payload: String
        let estimatedLength: Int
        let sighash: String
        let presign: String
        let serialized: String
        let txid: String
    }

    struct Address: Decodable {
        let address: String
        let version: UInt8
        let hash160: String
    }

    struct Clarity: Decodable {
        let name: String
        let hex: String
        let value: String?
    }

    let phrases: [Phrase]
    let transactions: [Transaction]
    let addresses: [Address]
    let clarity: [Clarity]

    static let all: Vectors = {
        let url = Bundle.module.url(forResource: "vectors", withExtension: "json")!
        return try! JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url))
    }()
}
