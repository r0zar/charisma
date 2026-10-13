import Foundation
import StacksKit

/// A send that passed review: what the review screen shows, ready to sign
public struct SendReview: Hashable, Sendable {
    public let row: TokenRow
    public let recipient: Principal
    /// Smallest units of the row's token
    public let amount: Int128
    /// Micro-STX
    public let fee: Int128
}

/// Sending from the Standard balance, as the extension's sendToken does (apps/signet/src/background/lib/tokens.ts):
/// STX directly, SIP-010 tokens through `transfer` with a post condition that exactly the amount leaves
public enum Send {
    /// The extension's recipient pattern (SP or SM, then a contract name if any), then a checksum check
    public static func recipient(_ text: String) throws -> Principal {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.wholeMatch(of: /S[PM][0-9A-Z]{38,40}(\.[a-zA-Z][a-zA-Z0-9_-]*)?/) != nil,
              let principal = try? Principal(text) else { throw WalletError.invalidRecipient }
        return principal
    }

    /// The typed amount in smallest units: more than zero and no more than the Standard balance
    public static func amount(_ text: String, row: TokenRow, locale: Locale) throws -> Int128 {
        guard let meta = row.meta else { throw WalletError.invalidAmount }
        let amount = try Amount.parse(text, decimals: meta.decimals, locale: locale)
        guard amount > 0 else { throw WalletError.amountNotPositive }
        guard amount <= row.standard else { throw WalletError.moreThanBalance(available: max(row.standard, 0)) }
        return amount
    }

    /// The fee comes out of the Standard STX balance, and so does the amount when sending STX
    public static func checkFee(_ fee: Int128, amount: Int128, row: TokenRow, stxBalance: Int128) throws {
        let needed = row.isSTX ? amount + fee : fee
        guard needed <= stxBalance else {
            throw WalletError.notEnoughSTXForFee(fee: fee, stxBalance: stxBalance, mostSendable: row.isSTX ? max(stxBalance - fee, 0) : nil)
        }
    }

    /// The transaction for this send, signed or not
    public static func transaction(
        row: TokenRow, recipient: Principal, amount: Int128, publicKey: Data, nonce: UInt64 = 0, fee: UInt64 = 0
    ) throws -> StacksTransaction {
        guard let micro = UInt64(exactly: amount) else { throw WalletError.invalidAmount }
        if row.isSTX {
            return .stxTransfer(to: recipient, amount: micro, publicKey: publicKey, nonce: nonce, fee: fee)
        }
        guard let asset = row.asset else { throw WalletError.missingAssetName(symbol: row.meta?.symbol ?? row.contractId) }
        guard case .contract(let token, let name) = try? Principal(row.contractId) else { throw WalletError.unexpected(row.contractId) }
        do {
            return try .sip10Transfer(token: token, tokenName: name, asset: asset, amount: micro, to: recipient, publicKey: publicKey, nonce: nonce, fee: fee)
        } catch {
            throw WalletError.missingAssetName(symbol: row.meta?.symbol ?? row.contractId)
        }
    }

    /// Checks everything a send needs, estimating the network fee. `stxBalance` is the Standard STX balance.
    public static func review(
        row: TokenRow, recipient recipientText: String, amount amountText: String, stxBalance: Int128,
        account: Account, locale: Locale, hiro: Hiro
    ) async throws -> SendReview {
        if row.unsendable == .missingAssetName { throw WalletError.missingAssetName(symbol: row.meta?.symbol ?? row.contractId) }
        let recipient = try recipient(recipientText)
        let amount = try amount(amountText, row: row, locale: locale)
        let publicKey = try Self.publicKey(of: account)
        let fee = Int128(try await hiro.estimateFee(for: transaction(row: row, recipient: recipient, amount: amount, publicKey: publicKey)))
        try checkFee(fee, amount: amount, row: row, stxBalance: stxBalance)
        return SendReview(row: row, recipient: recipient, amount: amount, fee: fee)
    }

    /// Signs with the account's key at its next nonce and broadcasts. Returns the txid.
    public static func send(_ review: SendReview, from account: Account, hiro: Hiro) async throws -> String {
        let nonce = try await hiro.nextNonce(address: account.stxAddress)
        guard let fee = UInt64(exactly: review.fee) else { throw WalletError.invalidAmount }
        let unsigned = try transaction(row: review.row, recipient: review.recipient, amount: review.amount, publicKey: try publicKey(of: account), nonce: nonce, fee: fee)
        let signed: StacksTransaction
        do {
            signed = try unsigned.signed(privateKey: Data(hex: account.privateKey))
        } catch {
            throw WalletError.unexpected(String(describing: error))
        }
        return try await hiro.broadcast(signed)
    }

    private static func publicKey(of account: Account) throws -> Data {
        do {
            return try Data(hex: account.publicKey)
        } catch {
            throw WalletError.unexpected(String(describing: error))
        }
    }
}
