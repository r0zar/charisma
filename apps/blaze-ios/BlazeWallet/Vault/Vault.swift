import Foundation
import LocalAuthentication
import Observation
import WalletCore

/// The wallet behind Face ID. One Keychain item holds the wallet state; one authenticated LAContext per unlocked
/// session reads and writes it, so Face ID is asked once per unlock (and again only to show seed words).
@MainActor @Observable
final class Vault {
    enum Phase: Equatable {
        case checking, empty, locked, unlocked
    }

    private(set) var phase: Phase = .checking
    /// Whether the lock screen asks for Face ID by itself: at launch and after leaving the app, not after the person
    /// tapped Lock (they'd be unlocked again at once) or after the idle lock (they may be away)
    private(set) var asksOnAppear = true
    /// Why the launch check failed; the root view offers to retry
    private(set) var startError: Error?
    private var session: Session?
    private var context: LAContext?

    /// The unlocked wallet, for views; nil when locked. It lives only in the Session, so locking forgets it.
    var state: WalletState? { try? session?.read() }

    /// When the wallet locks if nothing else happens
    var locksAt: Date? { session?.locksAt }

    /// The launch check: is there a wallet? Never asks for Face ID.
    func start() {
        startError = nil
        do {
            try Keychain.forgetPreviousInstall()
            phase = try Keychain.exists() ? .locked : .empty
        } catch {
            startError = error
        }
    }

    /// The end of Welcome: Face ID once, then the wallet is created with its first seed phrase, unlocked
    func create(name: String, words: String) async throws {
        var state = WalletState()
        try state.addSeedPhrase(name: name, words: words)
        let context = try await Self.authenticate(reason: String(localized: "Create your wallet"))
        try Keychain.add(JSONEncoder().encode(state), context: context)
        begin(state, context)
    }

    func unlock() async throws {
        let context = try await Self.authenticate(reason: String(localized: "Unlock your wallet"))
        let data = try Keychain.read(context: context)
        do {
            begin(try JSONDecoder().decode(WalletState.self, from: data), context)
        } catch {
            throw WalletError.unexpected("The saved wallet can't be read: \(error)")
        }
    }

    /// Changes the wallet, restarts the 15 minutes and saves it. Nothing changes if saving fails.
    @discardableResult
    func act<T>(_ change: (inout WalletState) throws -> T) throws -> T {
        guard var session, let context else { throw WalletError.locked }
        let result = try session.act(change)
        try Keychain.update(JSONEncoder().encode(session.read()), context: context)
        self.session = session
        return result
    }

    /// A send counts as activity
    func touch() throws {
        guard var session else { throw WalletError.locked }
        try session.touch()
        self.session = session
    }

    func lockIfIdle() {
        if session?.isLocked ?? true { lock() }
    }

    /// Forgets the wallet until the next unlock. `askOnReturn`: the lock screen asks for Face ID by itself.
    func lock(askOnReturn: Bool = false) {
        asksOnAppear = askOnReturn
        session = nil
        context?.invalidate()
        context = nil
        if phase == .unlocked { phase = .locked }
    }

    /// A seed phrase's words, after a fresh Face ID check (they go on screen)
    func revealWords(of seedPhraseId: String) async throws -> String {
        guard let seed = state?.seedPhrases.first(where: { $0.id == seedPhraseId }) else { throw WalletError.seedPhraseNotFound }
        let check = try await Self.authenticate(reason: String(localized: "Show your seed phrase"))
        check.invalidate()
        return seed.phrase
    }

    /// Removes the wallet from this iPhone; its funds stay on the blockchain
    func unlinkWallet() throws {
        try Keychain.delete()
        lock()
        phase = .empty
    }

    private func begin(_ state: WalletState, _ context: LAContext) {
        session = Session(state: state)
        self.context = context
        phase = .unlocked
    }

    /// Face ID, or the passcode when Face ID isn't set up or fails
    private static func authenticate(reason: String) async throws -> LAContext {
        let context = LAContext()
        var problem: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &problem) else {
            throw (problem as? LAError)?.code == .passcodeNotSet ? VaultError.passcodeNotSet : VaultError.authenticationUnavailable
        }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { passed, error in
                if passed {
                    continuation.resume()
                } else if let error = error as? LAError, [.userCancel, .appCancel, .systemCancel, .notInteractive].contains(error.code) {
                    continuation.resume(throwing: VaultError.cancelled)
                } else {
                    continuation.resume(throwing: VaultError.authenticationUnavailable)
                }
            }
        }
        return context
    }
}
