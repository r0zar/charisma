import Foundation
import StacksKit

/// The Stacks network through Hiro's public API, as the extension uses it (no API key)
public struct Hiro: Sendable {
    static let base = URL(string: "https://api.hiro.so")!

    let http: HTTP

    public init(session: URLSession = .shared) {
        http = HTTP(session: session)
    }

    /// The next nonce for a send. No second source: if this fails the send fails (no fallbacks).
    public func nextNonce(address: String) async throws -> UInt64 {
        struct Answer: Decodable { let possible_next_nonce: UInt64 }
        let url = Self.base.appending(path: "extended/v1/address").appending(path: address).appending(path: "nonces")
        return try await http.get(url, from: .stacks, as: Answer.self).possible_next_nonce
    }

    /// The fee @stacks/transactions would set: Hiro's middle estimate for this payload and length. When Hiro has no
    /// estimate for it, its per-byte transfer rate times the transaction's length.
    public func estimateFee(for transaction: StacksTransaction) async throws -> UInt64 {
        struct Request: Encodable {
            let transaction_payload: String
            let estimated_len: Int
        }
        struct Estimate: Decodable { let fee: UInt64 }
        struct Answer: Decodable { let estimations: [Estimate] }
        let request = try HTTP.jsonRequest(
            Self.base.appending(path: "v2/fees/transaction"),
            Request(transaction_payload: transaction.payloadHex, estimated_len: transaction.estimatedLength)
        )
        let (data, response) = try await http.answer(request, from: .stacks)
        if (200..<300).contains(response.statusCode) {
            let estimations: [Estimate] = try http.decode(data, from: .stacks, as: Answer.self).estimations
            guard estimations.count > 1 else { throw WalletError.unreadable(.stacks) }
            return estimations[1].fee
        }
        guard String(decoding: data, as: UTF8.self).contains("NoEstimateAvailable") else {
            throw WalletError.requestFailed(.stacks, status: response.statusCode)
        }
        let rate = try await http.get(Self.base.appending(path: "v2/fees/transfer"), from: .stacks, as: UInt64.self)
        let (fee, overflow) = rate.multipliedReportingOverflow(by: UInt64(transaction.estimatedLength))
        guard !overflow else { throw WalletError.unreadable(.stacks) }
        return fee
    }

    /// Sends a signed transaction to the network and returns its txid, computed from the signed bytes
    public func broadcast(_ transaction: StacksTransaction) async throws -> String {
        struct Request: Encodable { let tx: String }
        struct Rejection: Decodable {
            let error: String?
            let reason: String?
        }
        let request = try HTTP.jsonRequest(Self.base.appending(path: "v2/transactions"), Request(tx: transaction.serialized.hex))
        let (data, response) = try await http.answer(request, from: .stacks)
        if response.statusCode == 400 {
            // Refused transactions come back as JSON; ones the node can't even read, as plain text
            let rejection = try? JSONDecoder().decode(Rejection.self, from: data)
            throw WalletError.rejected(reason: rejection?.reason ?? rejection?.error ?? String(decoding: data, as: UTF8.self))
        }
        guard (200..<300).contains(response.statusCode) else {
            throw WalletError.requestFailed(.stacks, status: response.statusCode)
        }
        // The network took it, so its answer is only a cross-check: an unreadable one never fails the send
        let answered = try? http.decode(data, from: .stacks, as: String.self)
        let txid = transaction.txid
        if answered != txid && answered != "0x" + txid {
            Log.network.error("Hiro answered txid \(answered ?? "unreadable", privacy: .public), the signed transaction is \(txid, privacy: .public)")
        }
        return txid
    }

    /// The Stacks tip height, for Status
    public func tipHeight() async throws -> Int {
        struct Answer: Decodable { let stacks_tip_height: Int }
        return try await http.get(Self.base.appending(path: "v2/info"), from: .stacks, as: Answer.self).stacks_tip_height
    }

    /// An address's balance on a Blaze subnet, read from the subnet contract's `get-balance`
    public func subnetBalance(subnet: StacksAddress, name: String, of address: StacksAddress) async throws -> Int128 {
        struct Request: Encodable {
            let sender: String
            let arguments: [String]
        }
        struct Answer: Decodable {
            let okay: Bool
            let result: String?
        }
        let url = Self.base.appending(path: "v2/contracts/call-read").appending(path: subnet.description).appending(path: name).appending(path: "get-balance")
        let argument = "0x" + ClarityValue.principal(.standard(address)).serialized.hex
        let answer = try await http.post(url, json: Request(sender: address.description, arguments: [argument]), from: .stacks, as: Answer.self)
        guard answer.okay, let result = answer.result,
              let value = try? ClarityValue(serialized: Data(hex: result)).uintValue,
              let balance = Int128(exactly: value) else {
            throw WalletError.unreadable(.stacks)
        }
        return balance
    }
}
