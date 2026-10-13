import Foundation
import StacksKit
import Testing
@testable import WalletCore

struct SendTests {
    let us = Locale(identifier: "en_US")

    @Test func readsRecipients() throws {
        #expect(try Send.recipient(" \(TestPhrase.account1) ") == .standard(try StacksAddress(TestPhrase.account1)))
        #expect(try Send.recipient("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2").description == "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2")
        for text in [TestPhrase.account1.lowercased(), "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KT", "ST2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.9x", ""] {
            #expect(throws: WalletError.invalidRecipient, "\(text)") { try Send.recipient(text) }
        }
    }

    @Test func amountsMustFitTheStandardBalance() throws {
        let row = TokenRow.make("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", standard: 2_000_000, blaze: 9_000_000)
        #expect(try Send.amount("1.5", row: row, locale: us) == 1_500_000)
        #expect(throws: WalletError.amountNotPositive) { try Send.amount("0", row: row, locale: us) }
        #expect(throws: WalletError.moreThanBalance(available: 2_000_000)) { try Send.amount("2.000001", row: row, locale: us) }
    }

    @Test func theFeeComesOutOfTheSTXBalance() throws {
        let stx = TokenRow.make(TokenRow.stx, standard: 1_000_000, symbol: "STX")
        try Send.checkFee(180, amount: 999_820, row: stx, stxBalance: 1_000_000)
        #expect(throws: WalletError.notEnoughSTXForFee(fee: 180, stxBalance: 1_000_000, mostSendable: 999_820)) {
            try Send.checkFee(180, amount: 1_000_000, row: stx, stxBalance: 1_000_000)
        }
        let token = TokenRow.make("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", standard: 5)
        try Send.checkFee(300, amount: 5, row: token, stxBalance: 300)
        #expect(throws: WalletError.notEnoughSTXForFee(fee: 300, stxBalance: 299, mostSendable: nil)) {
            try Send.checkFee(300, amount: 5, row: token, stxBalance: 299)
        }
    }

    @Test func buildsTheExtensionsTransactions() throws {
        let keys = try AccountKeys.derive(phrase: TestPhrase.twelve, index: 0)
        let recipient = try Principal(TestPhrase.account1)
        let stx = try Send.transaction(row: .make(TokenRow.stx, standard: 9, symbol: "STX"), recipient: recipient, amount: 5, publicKey: keys.publicKey)
        #expect(stx == .stxTransfer(to: recipient, amount: 5, publicKey: keys.publicKey))

        let cha = TokenRow.make("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", standard: 9, asset: "charisma")
        let token = try Send.transaction(row: cha, recipient: recipient, amount: 5, publicKey: keys.publicKey)
        let expected = try StacksTransaction.sip10Transfer(
            token: StacksAddress("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS"), tokenName: "charisma-token", asset: "charisma",
            amount: 5, to: recipient, publicKey: keys.publicKey
        )
        #expect(token == expected)

        let noAsset = TokenRow.make("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", standard: 9, symbol: "CHA", asset: nil)
        #expect(throws: WalletError.missingAssetName(symbol: "CHA")) {
            try Send.transaction(row: noAsset, recipient: recipient, amount: 5, publicKey: keys.publicKey)
        }
    }
}
