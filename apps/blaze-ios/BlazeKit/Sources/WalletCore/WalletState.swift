import Foundation
import StacksKit

/// A seed phrase the wallet keeps. `phrase` is normalized (see `Mnemonic.normalize`).
public struct SeedPhrase: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let phrase: String
    public let createdAt: Date
}

/// One account of a seed phrase. The app shows it as "Account N", N being `index + 1`, in the person's language.
public struct Account: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let index: UInt32
    public let seedPhraseId: String
    public let stxAddress: String
    /// 33 bytes as hex, the 01 suffix included, as @stacks/wallet-sdk's `stxPrivateKey`
    public let privateKey: String
    /// 33-byte compressed public key as hex
    public let publicKey: String
    public let createdAt: Date
}

/// Everything the vault keeps, with the extension's rules (apps/signet/src/background/lib/wallet/storage.ts)
public struct WalletState: Codable, Equatable, Sendable {
    public private(set) var seedPhrases: [SeedPhrase] = []
    public private(set) var accounts: [Account] = []
    public private(set) var activeAccountId: String?

    public init() {}

    public var activeAccount: Account? { accounts.first { $0.id == activeAccountId } }

    public func accounts(of seedPhraseId: String) -> [Account] {
        accounts.filter { $0.seedPhraseId == seedPhraseId }
    }

    /// Keeps typed or pasted words under a unique name, then derives its first account and makes it active
    @discardableResult
    public mutating func addSeedPhrase(name: String, words: String, now: Date = Date()) throws -> Account {
        let phrase = Mnemonic.normalize(words)
        guard Mnemonic.isValid(phrase) else { throw WalletError.invalidSeedPhrase }
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !seedPhrases.contains(where: { $0.name == name }) else { throw WalletError.seedPhraseNameTaken(name) }
        let seed = SeedPhrase(id: "seed_\(UUID().uuidString.lowercased())", name: name, phrase: phrase, createdAt: now)
        let account = try Self.account(of: seed, index: 0, now: now)
        seedPhrases.append(seed)
        accounts.append(account)
        activeAccountId = account.id
        return account
    }

    /// Derives the seed phrase's next account (one past its highest index) and makes it active
    @discardableResult
    public mutating func addAccount(seedPhraseId: String, now: Date = Date()) throws -> Account {
        guard let seed = seedPhrases.first(where: { $0.id == seedPhraseId }) else { throw WalletError.seedPhraseNotFound }
        let index = accounts(of: seedPhraseId).map(\.index).max().map { $0 + 1 } ?? 0
        let account = try Self.account(of: seed, index: index, now: now)
        accounts.append(account)
        activeAccountId = account.id
        return account
    }

    public mutating func activate(accountId: String) throws {
        guard accounts.contains(where: { $0.id == accountId }) else { throw WalletError.accountNotFound }
        activeAccountId = accountId
    }

    /// Removes a seed phrase and its accounts. If the active account went with it, the first one left takes over.
    public mutating func unlinkSeedPhrase(id: String) {
        seedPhrases.removeAll { $0.id == id }
        accounts.removeAll { $0.seedPhraseId == id }
        if !accounts.contains(where: { $0.id == activeAccountId }) { activeAccountId = accounts.first?.id }
    }

    private static func account(of seed: SeedPhrase, index: UInt32, now: Date) throws -> Account {
        let keys: AccountKeys
        do {
            keys = try AccountKeys.derive(phrase: seed.phrase, index: index)
        } catch {
            throw WalletError.unexpected(String(describing: error))
        }
        return Account(
            id: "account_\(UUID().uuidString.lowercased())", index: index, seedPhraseId: seed.id,
            stxAddress: keys.address.description, privateKey: keys.privateKey.hex, publicKey: keys.publicKey.hex, createdAt: now
        )
    }
}
