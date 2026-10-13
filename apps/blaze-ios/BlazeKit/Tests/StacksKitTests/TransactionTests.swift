import Foundation
import Testing
@testable import StacksKit

struct TransactionTests {
    @Test(arguments: Vectors.all.transactions.map(\.name))
    func matchesStacksTransactions(name: String) throws {
        let vector = Vectors.all.transactions.first { $0.name == name }!
        let keys = try AccountKeys(privateKey: Data(hex: vector.senderKey))
        let recipient = try Principal(vector.recipient)
        let amount = UInt64(vector.amount)!
        let nonce = UInt64(vector.nonce)!
        let fee = UInt64(vector.fee)!

        let unsigned: StacksTransaction
        switch vector.kind {
        case "stx":
            unsigned = .stxTransfer(to: recipient, amount: amount, publicKey: keys.publicKey, nonce: nonce, fee: fee)
        default:
            guard case .contract(let token, let tokenName) = try Principal(vector.contract!) else {
                Issue.record("\(name): the token isn't a contract")
                return
            }
            unsigned = try .sip10Transfer(
                token: token, tokenName: tokenName, asset: vector.asset!, amount: amount, to: recipient,
                publicKey: keys.publicKey, nonce: nonce, fee: fee
            )
        }

        #expect(unsigned.payloadHex == vector.payload)
        #expect(unsigned.estimatedLength == vector.estimatedLength)
        #expect(unsigned.presignHash.hex == vector.presign)

        let signed = try unsigned.signed(privateKey: keys.privateKey)
        #expect(signed.serialized.hex == vector.serialized)
        #expect(signed.txid == vector.txid)
    }

    @Test func refusesAKeyThatIsntTheSenders() throws {
        let accounts = Vectors.all.phrases[0].accounts
        let sender = try AccountKeys(privateKey: Data(hex: accounts[0].privateKey))
        let other = try Data(hex: accounts[1].privateKey)
        let transaction = StacksTransaction.stxTransfer(to: .standard(sender.address), amount: 1, publicKey: sender.publicKey)
        #expect(throws: StacksError.invalidKey) { try transaction.signed(privateKey: other) }
    }

    @Test func refusesBadTokenAndAssetNames() throws {
        let sender = try AccountKeys(privateKey: Data(hex: Vectors.all.phrases[0].accounts[0].privateKey))
        let token = try StacksAddress("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS")
        for asset in ["", "char isma", "1charisma"] {
            #expect(throws: StacksError.invalidAssetName, "\(asset)") {
                try StacksTransaction.sip10Transfer(token: token, tokenName: "charisma-token", asset: asset, amount: 1,
                                                    to: .standard(sender.address), publicKey: sender.publicKey)
            }
        }
        #expect(throws: StacksError.invalidContractName) {
            try StacksTransaction.sip10Transfer(token: token, tokenName: "9token", asset: "charisma", amount: 1,
                                                to: .standard(sender.address), publicKey: sender.publicKey)
        }
    }
}
