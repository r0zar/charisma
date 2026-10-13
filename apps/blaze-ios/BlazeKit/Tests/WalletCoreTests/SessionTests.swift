import Foundation
import Testing
@testable import WalletCore

struct SessionTests {
    private func unlocked() throws -> (Session, TestClock) {
        var state = WalletState()
        try state.addSeedPhrase(name: "Main", words: TestPhrase.twelve)
        let clock = TestClock()
        return (Session(state: state, now: { clock.now }), clock)
    }

    @Test func locksFifteenMinutesAfterTheLastAction() throws {
        var (session, clock) = try unlocked()
        clock.advance(minutes: 14)
        #expect(try session.read().accounts.count == 1)
        clock.advance(minutes: 1)
        #expect(session.isLocked)
        #expect(throws: WalletError.locked) { try session.read() }
    }

    @Test func actionsRestartTheTimerAndReadsDont() throws {
        var (session, clock) = try unlocked()
        clock.advance(minutes: 10)
        try session.touch()
        clock.advance(minutes: 10)
        _ = try session.read()
        #expect(session.locksAt == clock.now.addingTimeInterval(5 * 60))
        clock.advance(minutes: 5)
        #expect(throws: WalletError.locked) { try session.act { _ in } }
    }

    @Test func changesGoThroughAct() throws {
        var (session, _) = try unlocked()
        let seedId = try session.read().seedPhrases[0].id
        let account = try session.act { try $0.addAccount(seedPhraseId: seedId) }
        #expect(try session.read().activeAccount == account)
    }

    @Test func lockForgetsTheWallet() throws {
        var (session, _) = try unlocked()
        session.lock()
        #expect(session.isLocked && session.locksAt == nil)
        #expect(throws: WalletError.locked) { try session.read() }
    }
}
