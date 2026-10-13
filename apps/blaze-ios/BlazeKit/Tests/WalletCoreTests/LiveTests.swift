import Foundation
import StacksKit
import Testing
@testable import WalletCore

/// Real reads from Charisma's servers and Hiro (no mocks), to check WalletCore reads their answers. Opt in, since they
/// need the network: BLAZE_LIVE=1 swift test --filter LiveTests
@Suite(.enabled(if: ProcessInfo.processInfo.environment["BLAZE_LIVE"] == "1"), .timeLimit(.minutes(1)))
struct LiveTests {
    /// Charisma's deployer, which holds many tokens and subnet balances
    let deployer = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS"

    @Test func charismaAnswersAreReadable() async throws {
        let charisma = Charisma()
        let list = try await charisma.tokenList()
        #expect(list.contains { $0.contractId == TokenRow.stx })
        #expect(list.contains { $0.type == "SUBNET" })
        let sheet = try await charisma.balanceSheet(address: deployer)
        #expect(sheet.tokens[TokenRow.stx] != nil)
        let rows = TokenRows.build(sheet: sheet, list: list, lookups: [:])
        #expect(rows.first?.isSTX == true)
        #expect(try await charisma.usdPrices()[TokenRow.stx] ?? 0 > 0)
        #expect(try await charisma.token("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token").symbol == "CHA")
        let found = try await charisma.lookUp(["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welshcorgicoin-token"])
        #expect(found["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"]?.symbol == "CHA")
    }

    @Test func theBalanceStreamSendsASheet() async throws {
        var stream = Charisma().watchBalances(address: TestPhrase.account0).makeAsyncIterator()
        let sheet = await stream.next()
        #expect(sheet?.address == TestPhrase.account0)
    }

    @Test func theBalanceStreamStopsWithItsReader() async throws {
        let stream = Charisma().watchBalances(address: TestPhrase.account0)
        let reader = Task {
            for await _ in stream {}
        }
        try await Task.sleep(for: .seconds(2))
        reader.cancel()
        // Returns: cancelling the reader ended the stream (the suite's time limit fails it otherwise)
        await reader.value
    }

    @Test func reviewAndSignAgainstTheNetwork() async throws {
        var state = WalletState()
        let account = try state.addSeedPhrase(name: "Main", words: TestPhrase.twelve)
        let stx = TokenRow.make(TokenRow.stx, standard: 1_000_000, symbol: "STX")
        let us = Locale(identifier: "en_US")
        let review = try await Send.review(row: stx, recipient: TestPhrase.account1, amount: "0.5", locale: us, stx: stx, account: account, hiro: Hiro())
        #expect(review.amount == 500_000 && review.fee > 0)
        // The balance reaches the fee check intact: 100 micro-STX can't pay any real fee
        let poor = TokenRow.make(TokenRow.stx, standard: 100, symbol: "STX")
        await #expect {
            try await Send.review(row: poor, recipient: TestPhrase.account1, amount: "0.00001", locale: us, stx: poor, account: account, hiro: Hiro())
        } throws: { error in
            guard case WalletError.notEnoughSTXForFee(let fee, let stxBalance, let mostSendable) = error else { return false }
            return fee > 100 && stxBalance == 100 && mostSendable == 0
        }
        // Signed, never broadcast: the txid is known before anything is sent
        let signed = try await Send.sign(review, from: account, hiro: Hiro())
        #expect(signed.txid.count == 64)
    }

    @Test func hiroAnswersAreReadable() async throws {
        let hiro = Hiro()
        #expect(try await hiro.tipHeight() > 0)
        #expect(try await hiro.nextNonce(address: deployer) > 0)
        let keys = try AccountKeys.derive(phrase: TestPhrase.twelve, index: 0)
        let stx = StacksTransaction.stxTransfer(to: try Principal(TestPhrase.account1), amount: 1, publicKey: keys.publicKey)
        #expect(try await hiro.estimateFee(for: stx) > 0)
        let balance = try await hiro.subnetBalance(
            subnet: StacksAddress(deployer), name: "charisma-token-subnet-v1", of: StacksAddress(deployer)
        )
        #expect(balance >= 0)
    }

    @Test func aBadTransactionIsRejectedWithTheNodesReason() async throws {
        let keys = try AccountKeys.derive(phrase: TestPhrase.twelve, index: 0)
        // Never signed (an all-zero signature), so the network can only refuse it: nothing can ever move
        let unsigned = StacksTransaction.stxTransfer(to: try Principal(TestPhrase.account1), amount: 1, publicKey: keys.publicKey, nonce: 0, fee: 180)
        await #expect {
            try await Hiro().broadcast(unsigned)
        } throws: { error in
            guard case WalletError.rejected(let reason) = error else { return false }
            return !reason.isEmpty
        }
    }
}
