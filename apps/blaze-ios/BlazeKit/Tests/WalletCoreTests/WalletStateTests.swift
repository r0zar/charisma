import Foundation
import Testing
@testable import WalletCore

struct WalletStateTests {
    @Test func addingASeedPhraseDerivesItsFirstAccountAndMakesItActive() throws {
        var state = WalletState()
        let account = try state.addSeedPhrase(name: " Main ", words: "  ABANDON abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about")
        #expect(state.seedPhrases.map(\.name) == ["Main"])
        #expect(state.seedPhrases[0].phrase == TestPhrase.twelve)
        #expect(account.index == 0)
        #expect(account.stxAddress == TestPhrase.account0)
        #expect(state.activeAccount == account)
    }

    @Test func refusesBadWordsAndTakenNames() throws {
        var state = WalletState()
        #expect(throws: WalletError.invalidSeedPhrase) { try state.addSeedPhrase(name: "Main", words: "abandon abandon") }
        try state.addSeedPhrase(name: "Main", words: TestPhrase.twelve)
        #expect(throws: WalletError.seedPhraseNameTaken("Main")) { try state.addSeedPhrase(name: "Main", words: TestPhrase.twentyFour) }
        #expect(state.seedPhrases.count == 1)
    }

    @Test func newAccountsTakeTheNextIndexAndBecomeActive() throws {
        var state = WalletState()
        let first = try state.addSeedPhrase(name: "Main", words: TestPhrase.twelve)
        let second = try state.addAccount(seedPhraseId: first.seedPhraseId)
        #expect(second.index == 1)
        #expect(second.stxAddress == TestPhrase.account1)
        #expect(state.activeAccountId == second.id)
        try state.activate(accountId: first.id)
        #expect(state.activeAccount == first)
        #expect(throws: WalletError.accountNotFound) { try state.activate(accountId: "nope") }
        #expect(throws: WalletError.seedPhraseNotFound) { try state.addAccount(seedPhraseId: "nope") }
    }

    @Test func unlinkingMovesTheActiveAccountToTheFirstLeft() throws {
        var state = WalletState()
        let main = try state.addSeedPhrase(name: "Main", words: TestPhrase.twelve)
        let other = try state.addSeedPhrase(name: "Other", words: TestPhrase.twentyFour)
        #expect(state.activeAccountId == other.id)
        state.unlinkSeedPhrase(id: other.seedPhraseId)
        #expect(state.activeAccountId == main.id)
        state.unlinkSeedPhrase(id: main.seedPhraseId)
        #expect(state.accounts.isEmpty && state.activeAccount == nil)
    }

    @Test func survivesTheVaultsJSON() throws {
        var state = WalletState()
        try state.addSeedPhrase(name: "Main", words: TestPhrase.twelve)
        let decoded = try JSONDecoder().decode(WalletState.self, from: JSONEncoder().encode(state))
        #expect(decoded == state)
    }
}
