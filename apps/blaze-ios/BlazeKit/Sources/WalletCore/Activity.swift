import Foundation
import StacksKit

/// One transfer in a transaction, as it went for this account
public struct ActivityMove: Hashable, Sendable {
    /// True when it came to this account, false when it left
    public let incoming: Bool
    /// ".stx", or a token's or NFT's contract id
    public let contractId: String
    /// Smallest units of a token; "1" for an NFT
    public let amount: String
    /// An NFT's token id; nil for STX and tokens
    public let tokenId: String?
}

/// A transaction this account took part in, with the transfers in it
public struct ActivityRow: Hashable, Identifiable, Sendable {
    public enum Status: Sendable { case success, pending, failed }

    public let txid: String
    /// When the transaction was anchored
    public let time: Date
    public let status: Status
    /// The contract function called, or nil for a plain transfer
    public let function: String?
    public let moves: [ActivityMove]

    public var id: String { txid }
}

extension Hiro {
    /// One page of the address's transactions, newest first, with the STX, token and NFT transfers in each. Throws
    /// `WalletError.unreadable` for a transaction with no time, rather than showing it without one.
    public func activity(address: String, offset: Int, limit: Int) async throws -> [ActivityRow] {
        struct Feed: Decodable { let results: [Item] }
        struct Item: Decodable {
            struct Tx: Decodable {
                struct Call: Decodable { let function_name: String }
                let tx_id: String
                let tx_status: String
                let tx_type: String
                let block_time_iso: String
                let contract_call: Call?
            }
            struct FT: Decodable {
                let asset_identifier: String
                let amount: String
                let recipient: String
            }
            struct NFT: Decodable {
                struct Value: Decodable { let repr: String }
                let asset_identifier: String
                let value: Value
                let recipient: String
            }
            let tx: Tx
            let stx_sent: String
            let stx_received: String
            let ft_transfers: [FT]
            let nft_transfers: [NFT]
        }

        var components = URLComponents(
            url: Self.base.appending(path: "extended/v1/address").appending(path: address).appending(path: "transactions_with_transfers"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        guard let url = components?.url else { throw WalletError.unreadable(.stacks) }
        let feed = try await http.get(url, from: .stacks, as: Feed.self)

        return try feed.results.map { item in
            guard let time = try? Date(item.tx.block_time_iso, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) else {
                throw WalletError.unreadable(.stacks)
            }
            var moves: [ActivityMove] = []
            if item.stx_sent != "0" {
                moves.append(ActivityMove(incoming: false, contractId: TokenRow.stx, amount: item.stx_sent, tokenId: nil))
            }
            if item.stx_received != "0" {
                moves.append(ActivityMove(incoming: true, contractId: TokenRow.stx, amount: item.stx_received, tokenId: nil))
            }
            for transfer in item.ft_transfers {
                moves.append(ActivityMove(
                    incoming: transfer.recipient == address,
                    contractId: Self.contractOf(transfer.asset_identifier),
                    amount: transfer.amount,
                    tokenId: nil
                ))
            }
            for transfer in item.nft_transfers {
                moves.append(ActivityMove(
                    incoming: transfer.recipient == address,
                    contractId: Self.contractOf(transfer.asset_identifier),
                    amount: "1",
                    tokenId: String(transfer.value.repr.dropFirst())
                ))
            }
            return ActivityRow(
                txid: item.tx.tx_id,
                time: time,
                status: Self.statusOf(item.tx.tx_status),
                function: item.tx.tx_type == "contract_call" ? item.tx.contract_call?.function_name : nil,
                moves: moves
            )
        }
    }

    /// An asset's identifier is "<contract>::<asset>": the contract is what the token list knows
    private static func contractOf(_ assetIdentifier: String) -> String {
        assetIdentifier.components(separatedBy: "::").first ?? assetIdentifier
    }

    private static func statusOf(_ txStatus: String) -> ActivityRow.Status {
        switch txStatus {
        case "success": return .success
        case "pending": return .pending
        default: return .failed
        }
    }
}
