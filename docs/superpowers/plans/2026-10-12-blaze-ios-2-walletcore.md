# Blaze Wallet iOS, Plan 2: WalletCore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build WalletCore, the second BlazeKit target. It holds the wallet's rules and its server clients: the wallet state, the 15-minute lock, amounts in the person's locale, token rows, the send flow and Status's checks. The iOS app (plan 3) adds only screens, the Face ID vault and words.

**Architecture:** Plain Swift over StacksKit (plan 1), with no UI and no user-facing text: it throws `WalletError` cases that the app's String Catalog words. Rules are pure value types with unit tests. Server clients are `Sendable` structs over `URLSession`, checked against the real servers by opt-in live tests, with no mocks.

**Tech Stack:** Swift 6, Swift Testing, Foundation (`URLSession`, `Decimal.FormatStyle`), `os.Logger`, StacksKit.

**Spec:** `docs/superpowers/specs/2026-10-12-blaze-wallet-ios-design.md`, section "WalletCore" (and "Errors", "Testing"). Also `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md`, section "Numbers".

**Baseline:** branch `feat/blaze-ios` with plan 1 done (StacksKit, 24 tests passing, Task 10's review fixes included).

---

## Working notes for every task

- **The code is pre-tested.** Every file in this plan was compiled and tested before the plan was written: 50 tests in 14 suites. The plan was then replayed task by task in a fresh folder, and every count below matched. The opt-in live checks passed against the real servers on 2026-10-12. Copy the code exactly.
- **Commands.** Run every command from the repo root. Swift commands take `--package-path apps/blaze-ios/BlazeKit`.
- **No mock data, no fallbacks.**
  - Unit tests feed the pure rules hand-built inputs, such as a `BalanceSheet` value.
  - Server code is checked only against the real servers, by tests that run when `BLAZE_LIVE=1` is set and are skipped otherwise. Each live suite has a one-minute limit.
  - The live tests only read. Their one broadcast is a never-signed transaction, which the network can only refuse.
- **The extension's per-item rules are the only quiet failures.** Each one is logged:
  - a sheet token that can't be read is left out
  - a failed one-token lookup leaves that token unknown (`Charisma.lookUp`)
  - a subnet that can't be read is left out of "Holding your funds"
- **One change from the spec:** `Account` keeps no `name`. The app shows "Account N" (N = index + 1) in the person's language, which a stored English name would block.
- **Commits:** commit after every task, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

All paths are inside `apps/blaze-ios/BlazeKit`.

| File | Responsibility |
|---|---|
| `Package.swift` | Adds the `WalletCore` library and its test target |
| `Sources/WalletCore/WalletError.swift` | Every failure, typed; `Service` names the server |
| `Sources/WalletCore/Log.swift` | `os.Logger`s for developer-only problems |
| `Sources/WalletCore/WalletState.swift` | `SeedPhrase`, `Account`, `WalletState` and the extension's rules |
| `Sources/WalletCore/Session.swift` | The unlocked state and the 15-minute idle lock (injected clock); reads never mutate |
| `Sources/WalletCore/Amount.swift` | Exact `Int128` amounts to and from locale text; USD |
| `Sources/WalletCore/Models.swift` | The server answers WalletCore reads (`BalanceSheet`, `TokenInfo`) |
| `Sources/WalletCore/TokenRows.swift` | `TokenMeta`, `TokenRow`, `Unsendable`, and building rows from a sheet |
| `Sources/WalletCore/HTTP.swift` | JSON over HTTPS, errors per service, Hiro's 429 retry, cancellation passed through |
| `Sources/WalletCore/Charisma.swift` | Balance sheet, live balance stream, token list, one-token lookups, prices |
| `Sources/WalletCore/Hiro.swift` | Nonce, fee estimate, broadcast, tip height, subnet `get-balance` |
| `Sources/WalletCore/Send.swift` | Recipient, amount and fee checks; review; sign and broadcast |
| `Sources/WalletCore/Diagnostics.swift` | Status's checks, and the subnet reader that keeps answers for a minute |
| `Tests/WalletCoreTests/Fixtures.swift`, `Tests/WalletCoreTests/RowFixtures.swift` | Test phrases, a test clock, a row builder |
| `Tests/WalletCoreTests/*Tests.swift` | One test file per area; `Live*Tests.swift` are opt-in |

---

### Task 1: The target, errors and wallet state

**Files:**
- Modify: `Package.swift` (whole file below)
- Create: `Sources/WalletCore/WalletError.swift`, `Sources/WalletCore/Log.swift`, `Sources/WalletCore/WalletState.swift`
- Test: `Tests/WalletCoreTests/Fixtures.swift`, `Tests/WalletCoreTests/WalletStateTests.swift`

- [ ] **Make the source folder:** `mkdir -p apps/blaze-ios/BlazeKit/Sources/WalletCore`

- [ ] **Replace `Package.swift`**

```swift
// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "BlazeKit",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "StacksKit", targets: ["StacksKit"]),
        .library(name: "WalletCore", targets: ["WalletCore"]),
    ],
    dependencies: [
        .package(url: "https://github.com/21-DOT-DEV/swift-secp256k1", exact: "0.23.2"),
    ],
    targets: [
        .target(
            name: "StacksKit",
            dependencies: [.product(name: "P256K", package: "swift-secp256k1")]
        ),
        .target(
            name: "WalletCore",
            dependencies: ["StacksKit"]
        ),
        .testTarget(
            name: "StacksKitTests",
            dependencies: ["StacksKit"],
            resources: [.copy("vectors.json")]
        ),
        .testTarget(
            name: "WalletCoreTests",
            dependencies: ["WalletCore", "StacksKit"]
        ),
    ]
)
```

- [ ] **Write the fixtures and the failing tests**

`Tests/WalletCoreTests/Fixtures.swift`:

```swift
import Foundation

@testable import WalletCore

/// Public BIP39 test phrases: never send funds to their addresses
enum TestPhrase {
    static let twelve = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    static let twentyFour = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"
    /// Account 0 and 1 of `twelve`, as @stacks/wallet-sdk derives them (StacksKit's vectors)
    static let account0 = "SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J"
    static let account1 = "SP3XHES5990FYDV5BHBZCJRFYFD2Z4X3FMD2N3MGH"
}

/// A clock tests move by hand
final class TestClock: @unchecked Sendable {
    var now = Date(timeIntervalSince1970: 1_800_000_000)
    func advance(minutes: Double) { now = now.addingTimeInterval(minutes * 60) }
}
```

`Tests/WalletCoreTests/WalletStateTests.swift`:

```swift
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
```

- [ ] **Write the errors and the log first**

SwiftPM won't load a library target with no source files in it. So these two come before the red step, which then fails on the missing `WalletState` as intended.

`Sources/WalletCore/WalletError.swift`:

```swift
import Foundation

/// The servers the wallet talks to, named in errors
public enum Service: String, Sendable {
    /// Charisma's balance service, swap.charisma.rocks
    case balances
    /// Charisma's token list, tokens.charisma.rocks
    case tokenList
    /// Charisma's price feed, lakehouse.charisma.rocks
    case prices
    /// The Stacks network, through Hiro (api.hiro.so)
    case stacks
}

/// Everything WalletCore can fail with. WalletCore has no words for people: the app's String Catalog words each case.
public enum WalletError: Error, Equatable, Sendable {
    // The wallet
    case locked
    case invalidSeedPhrase
    case seedPhraseNameTaken(String)
    case seedPhraseNotFound
    case accountNotFound

    // Servers
    /// The server answered with this HTTP status
    case requestFailed(Service, status: Int)
    /// The server couldn't be reached (offline, timed out)
    case unreachable(Service)
    /// The server answered with something WalletCore can't read
    case unreadable(Service)
    /// The token list came back empty, so tokens can't be checked against its block list
    case tokenListUnavailable

    // Sending
    case invalidRecipient
    /// Not a number in the locale's format; the app shows an example with the locale's decimal mark
    case invalidAmount
    case tooManyDecimals(max: Int)
    case amountNotPositive
    /// More than the Standard balance, which is what sends spend (`available` in smallest units)
    case moreThanBalance(available: Int128)
    /// The token list has no asset name for this token, so the send's post condition can't be written
    case missingAssetName(symbol: String)
    /// The fee, plus the amount for an STX send, doesn't fit the STX balance. `mostSendable` is set for STX sends.
    case notEnoughSTXForFee(fee: Int128, stxBalance: Int128, mostSendable: Int128?)
    /// The network refused the transaction; `reason` is the node's own text
    case rejected(reason: String)

    /// Text from a server or library that has no case of its own; the app shows it after a translated lead-in
    case unexpected(String)
}
```

`Sources/WalletCore/Log.swift`:

```swift
import os

/// Problems for developers, not news for the person: visible in Console.app under rocks.charisma.blazewallet
enum Log {
    static let balances = Logger(subsystem: "rocks.charisma.blazewallet", category: "balances")
    static let network = Logger(subsystem: "rocks.charisma.blazewallet", category: "network")
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "error:" | head`
Expected: the build fails because `WalletState` doesn't exist yet.

- [ ] **Write the wallet state**

`Sources/WalletCore/WalletState.swift`:

```swift
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
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 29 tests in 8 suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit
git commit -m "feat(blaze-ios): WalletCore with the extension's wallet rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The 15-minute lock

**Files:**
- Create: `Sources/WalletCore/Session.swift`
- Test: `Tests/WalletCoreTests/SessionTests.swift`

- [ ] **Write the failing tests**

```swift
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
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "error:" | head`
Expected: the build fails because `Session` doesn't exist yet.

- [ ] **Write the session**

```swift
import Foundation

/// The unlocked wallet, and the rule that locks it: 15 minutes after the last thing the person did. Reads never
/// count, so a screen left open can't keep the wallet unlocked (as the extension's vault).
public struct Session: Sendable {
    public static let idleLimit: TimeInterval = 15 * 60

    private var state: WalletState?
    private var lastAction: Date
    private let now: @Sendable () -> Date

    public init(state: WalletState, now: @escaping @Sendable () -> Date = { Date() }) {
        self.state = state
        self.now = now
        self.lastAction = now()
    }

    /// True once locked by hand or by the idle limit
    public var isLocked: Bool { state == nil || now() >= lastAction.addingTimeInterval(Self.idleLimit) }

    /// When the wallet locks if nothing else happens; nil once locked
    public var locksAt: Date? { isLocked ? nil : lastAction.addingTimeInterval(Self.idleLimit) }

    /// The wallet as it is. Doesn't restart the 15 minutes, and changes nothing.
    public func read() throws -> WalletState {
        guard !isLocked, let state else { throw WalletError.locked }
        return state
    }

    /// Changes the wallet and restarts the 15 minutes. Returns what `change` returns.
    @discardableResult
    public mutating func act<T>(_ change: (inout WalletState) throws -> T) throws -> T {
        expireIfIdle()
        guard var current = state else { throw WalletError.locked }
        let result = try change(&current)
        state = current
        lastAction = now()
        return result
    }

    /// Counts as activity without changing anything (a send)
    public mutating func touch() throws {
        try act { _ in }
    }

    /// Forgets the wallet until the next unlock
    public mutating func lock() {
        state = nil
    }

    private mutating func expireIfIdle() {
        if isLocked { lock() }
    }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 33 tests in 9 suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit
git commit -m "feat(blaze-ios): The wallet locks 15 minutes after the last action, never extended by reads" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Amounts in the person's locale

**Files:**
- Create: `Sources/WalletCore/Amount.swift`
- Test: `Tests/WalletCoreTests/AmountTests.swift`

- [ ] **Write the failing tests**

```swift
import Foundation
import Testing
@testable import WalletCore

struct AmountTests {
    let us = Locale(identifier: "en_US")
    let germany = Locale(identifier: "de_DE")
    let turkey = Locale(identifier: "tr_TR")
    let japan = Locale(identifier: "ja_JP")

    @Test func parsesOnlyTheLocalesDecimalMark() throws {
        #expect(try Amount.parse("1.5", decimals: 6, locale: us) == 1_500_000)
        #expect(try Amount.parse("1,5", decimals: 6, locale: germany) == 1_500_000)
        #expect(try Amount.parse("1,5", decimals: 6, locale: turkey) == 1_500_000)
        #expect(try Amount.parse(",5", decimals: 6, locale: germany) == 500_000)
        #expect(try Amount.parse("2", decimals: 0, locale: japan) == 2)
        #expect(throws: WalletError.invalidAmount) { try Amount.parse("1,5", decimals: 6, locale: japan) }
        #expect(throws: WalletError.invalidAmount) { try Amount.parse("1.5", decimals: 6, locale: germany) }
    }

    @Test func rejectsGroupingSignsAndJunk() {
        for text in ["1,000.5", "1.000,5", "-1", "+1", "", ".", "1.2.3", "1e5", "١"] {
            #expect(throws: WalletError.invalidAmount, "\(text)") { try Amount.parse(text, decimals: 6, locale: us) }
        }
        #expect(throws: WalletError.tooManyDecimals(max: 6)) { try Amount.parse("0.0000001", decimals: 6, locale: us) }
        #expect(throws: WalletError.invalidAmount) { try Amount.parse(String(repeating: "9", count: 40), decimals: 6, locale: us) }
    }

    @Test func formatsWithEachScreensPrecision() {
        let amount: Int128 = 1_234_567_890_123 // 1,234,567.890123 at 6 decimals
        #expect(Amount.format(amount, decimals: 6, precision: .cut(6), locale: us) == "1,234,567.890123")
        #expect(Amount.format(amount, decimals: 6, precision: .cut(6), locale: germany) == "1.234.567,890123")
        #expect(Amount.format(amount, decimals: 6, precision: .cut(6), locale: japan) == "1,234,567.890123")
        // The token list cuts, Status rounds, review is exact
        #expect(Amount.format(199_999_999, decimals: 8, precision: .cut(6), locale: us) == "1.999999")
        #expect(Amount.format(199_999_999, decimals: 8, precision: .rounded(4), locale: us) == "2")
        #expect(Amount.format(1, decimals: 8, precision: .exact, locale: us) == "0.00000001")
        #expect(Amount.format(1, decimals: 8, precision: .cut(6), locale: us) == "0")
        #expect(Amount.format(-1_500_000, decimals: 6, precision: .cut(6), locale: us) == "-1.5")
    }

    @Test func maxRoundTripsExactly() throws {
        for locale in [us, germany, turkey, japan] {
            for (raw, decimals) in [(Int128(1), 8), (123_456_789, 8), (1_500_000, 6), (42, 0), (0, 6)] as [(Int128, Int)] {
                let text = Amount.editable(raw, decimals: decimals, locale: locale)
                #expect(try Amount.parse(text, decimals: decimals, locale: locale) == raw, "\(text) \(locale.identifier)")
            }
        }
        #expect(Amount.editable(1_500_000, decimals: 6, locale: germany) == "1,5")
        #expect(Amount.editable(1, decimals: 8, locale: us) == "0.00000001")
    }

    @Test func formatsDollars() {
        #expect(Amount.usd(1234.5, locale: us) == "$1,234.50")
        #expect(Amount.usd(0.012345, locale: us) == "$0.0123")
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "error:" | head`
Expected: the build fails because `Amount` doesn't exist yet.

- [ ] **Write the amounts**

```swift
import Foundation

/// Token amounts are exact integers in the token's smallest unit (`Int128`, never floating point). These turn them into
/// text in the person's locale and back. The app passes `Locale.current`: the phone's language plus its region, which
/// is also what the decimal keypad types.
public enum Amount {
    public enum Precision: Sendable {
        /// At most this many decimals, the rest cut off, not rounded (the token list)
        case cut(Int)
        /// Rounded to at most this many decimals (Status)
        case rounded(Int)
        /// Every decimal the token has (send review)
        case exact
    }

    /// `raw` smallest units as text: the locale's grouping and decimal marks, and a minus when negative
    public static func format(_ raw: Int128, decimals: Int, precision: Precision, locale: Locale) -> String {
        let style = Decimal.FormatStyle(locale: locale)
        let styled = switch precision {
        case .cut(let places): style.precision(.fractionLength(0...min(places, decimals))).rounded(rule: .towardZero)
        case .rounded(let places): style.precision(.fractionLength(0...min(places, decimals))).rounded(rule: .toNearestOrAwayFromZero)
        case .exact: style.precision(.fractionLength(0...decimals))
        }
        return decimal(raw, decimals: decimals).formatted(styled)
    }

    /// What someone typed, as smallest units, exactly. Accepts digits and at most one of the locale's decimal mark:
    /// no grouping marks, no sign.
    public static func parse(_ text: String, decimals: Int, locale: Locale) throws -> Int128 {
        let parts = text.trimmingCharacters(in: .whitespaces).components(separatedBy: decimalMark(locale))
        guard parts.count <= 2, parts.contains(where: { !$0.isEmpty }),
              parts.allSatisfy({ $0.allSatisfy { $0.isASCII && $0.isNumber } }) else { throw WalletError.invalidAmount }
        let fraction = parts.count == 2 ? parts[1] : ""
        guard fraction.count <= decimals else { throw WalletError.tooManyDecimals(max: decimals) }
        guard let whole = Int128(parts[0].isEmpty ? "0" : parts[0]),
              let part = Int128(fraction.isEmpty ? "0" : fraction.padding(toLength: decimals, withPad: "0", startingAt: 0)) else {
            throw WalletError.invalidAmount
        }
        let (scaled, overflow) = whole.multipliedReportingOverflow(by: power(decimals))
        guard !overflow, case let (total, sumOverflow) = scaled.addingReportingOverflow(part), !sumOverflow else {
            throw WalletError.invalidAmount
        }
        return total
    }

    /// The exact amount with the locale's decimal mark and no grouping, so `parse` reads it back unchanged (Max)
    public static func editable(_ raw: Int128, decimals: Int, locale: Locale) -> String {
        let digits = String(raw.magnitude)
        let sign = raw < 0 ? "-" : ""
        guard decimals > 0 else { return sign + digits }
        let padded = String(repeating: "0", count: max(0, decimals + 1 - digits.count)) + digits
        var fraction = String(padded.suffix(decimals))
        while fraction.last == "0" { fraction.removeLast() }
        let whole = String(padded.dropLast(decimals))
        return sign + (fraction.isEmpty ? whole : whole + decimalMark(locale) + fraction)
    }

    /// Whole tokens, for pricing only (display always uses `format`)
    public static func units(_ raw: Int128, decimals: Int) -> Double {
        Double(raw) / pow(10, Double(decimals))
    }

    /// US dollars in the locale's currency format: 4 decimals under $1, else 2
    public static func usd(_ value: Double, locale: Locale) -> String {
        value.formatted(.currency(code: "USD").locale(locale).precision(.fractionLength(value < 1 ? 2...4 : 2...2)))
    }

    /// The locale's decimal mark, for example text such as "1,5"
    public static func decimalMark(_ locale: Locale) -> String { locale.decimalSeparator ?? "." }

    private static func decimal(_ raw: Int128, decimals: Int) -> Decimal {
        // Decimal is base 10, so this is exact for every amount under 38 digits
        Decimal(string: String(raw), locale: Locale(identifier: "en_US_POSIX"))! / pow(Decimal(10), decimals)
    }

    private static func power(_ decimals: Int) -> Int128 {
        (0..<decimals).reduce(Int128(1)) { value, _ in value * 10 }
    }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 38 tests in 10 suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit
git commit -m "feat(blaze-ios): Exact amounts in the person's locale, with each screen's precision" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Token rows

**Files:**
- Create: `Sources/WalletCore/Models.swift`, `Sources/WalletCore/TokenRows.swift`
- Test: `Tests/WalletCoreTests/RowFixtures.swift`, `Tests/WalletCoreTests/TokenRowsTests.swift`

- [ ] **Write the row fixture and the failing tests**

`Tests/WalletCoreTests/RowFixtures.swift`:

```swift
import Foundation
@testable import WalletCore

extension TokenRow {
    /// A row as TokenRows.build would make it
    static func make(_ contractId: String, standard: Int128, blaze: Int128 = 0, symbol: String = "TKN", decimals: Int = 6, listed: Bool = true, asset: String? = "token") -> TokenRow {
        TokenRow(
            contractId: contractId, standard: standard, blaze: blaze,
            meta: TokenMeta(TokenInfo(contractId: contractId, name: symbol, symbol: symbol, decimals: decimals, identifier: asset)),
            listed: listed, asset: contractId == TokenRow.stx ? "" : asset
        )
    }
}
```

`Tests/WalletCoreTests/TokenRowsTests.swift`:

```swift
import Foundation
import Testing
@testable import WalletCore

struct TokenRowsTests {
    let cha = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"
    let welsh = "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token"
    let sbtc = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
    let airdrop = "SP000000000000000000002Q6VF78.airdrop"

    var list: [TokenInfo] {
        [
            TokenInfo(contractId: ".stx", name: "Stacks Token", symbol: "STX", decimals: 6, identifier: "STX"),
            TokenInfo(contractId: cha, name: "Charisma", symbol: "CHA", decimals: 6, identifier: "charisma"),
            TokenInfo(contractId: welsh, name: "Welsh", symbol: "WELSH", decimals: 6, identifier: ""),
            TokenInfo(contractId: sbtc, name: "sBTC", symbol: "sBTC", decimals: 8, identifier: "sbtc-token"),
        ]
    }

    var sheet: BalanceSheet {
        BalanceSheet(address: TestPhrase.account0, tokens: [
            ".stx": .init(ready: "5000000"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-subnet": .init(base: ".stx", ready: "1000000"),
            cha: .init(ready: "250"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1": .init(base: cha, ready: "50"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-subnet": .init(base: sbtc, ready: "7"),
            welsh: .init(ready: "9"),
            airdrop: .init(ready: "1000"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.empty": .init(ready: "0"),
            "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.broken": .init(ready: nil, error: "chain read failed"),
        ])
    }

    @Test func foldsBlazeIntoItsBaseTokenAndOrdersRows() {
        let rows = TokenRows.build(sheet: sheet, list: list, lookups: [:])
        #expect(rows.map(\.contractId) == [".stx", airdrop, cha, welsh, sbtc])
        let stx = rows[0]
        #expect((stx.standard, stx.blaze, stx.asset, stx.listed) == (5_000_000, 1_000_000, "", true))
        let charisma = rows.first { $0.contractId == cha }!
        #expect((charisma.standard, charisma.blaze, charisma.total, charisma.asset) == (250, 50, 300, "charisma"))
    }

    @Test func saysWhyARowCantBeSent() {
        let rows = Dictionary(uniqueKeysWithValues: TokenRows.build(sheet: sheet, list: list, lookups: [:]).map { ($0.contractId, $0) })
        #expect(rows[".stx"]!.unsendable == nil)
        #expect(rows[cha]!.unsendable == nil)
        #expect(rows[airdrop]!.unsendable == .unlisted)
        #expect(rows[welsh]!.unsendable == .missingAssetName)
        #expect(rows[sbtc]!.unsendable == .onlyOnBlaze)
        // A new wallet's empty STX row has nothing to send, rather than being "on Blaze"
        let empty = TokenRows.build(sheet: BalanceSheet(address: TestPhrase.account0, tokens: [:]), list: list, lookups: [:])
        #expect(empty.map(\.contractId) == [".stx"])
        #expect(empty[0].unsendable == .nothingToSend)
    }

    @Test func unlistedTokensAreLookedUpButStayUnlisted() {
        // Only tokens that become rows: the empty and the unreadable ones don't
        #expect(TokenRows.unlisted(sheet: sheet, list: list) == [airdrop])
        let lookups = [airdrop: TokenInfo(contractId: nil, name: "Airdrop", symbol: "AIR", decimals: 0, identifier: "air")]
        let row = TokenRows.build(sheet: sheet, list: list, lookups: lookups).first { $0.contractId == airdrop }!
        #expect(row.meta?.symbol == "AIR")
        #expect(row.listed == false && row.unsendable == .unlisted)
        // Without a lookup it's unknown
        #expect(TokenRows.build(sheet: sheet, list: list, lookups: [:]).first { $0.contractId == airdrop }!.meta == nil)
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "error:" | head`
Expected: the build fails because `TokenRow` doesn't exist yet.

- [ ] **Write the models and the rows**

`Sources/WalletCore/Models.swift`:

```swift
import Foundation

/// Charisma's balance sheet for an address (blaze-sdk `BalanceSheet`), only the fields the wallet reads
public struct BalanceSheet: Decodable, Sendable {
    public struct Token: Decodable, Sendable {
        /// The on-chain token a subnet holds (".stx" for STX); nil for a token on Stacks itself
        public let base: String?
        /// Smallest units, counting what's on its way; nil when the chain couldn't be read
        public let ready: String?
        /// Why `ready` is nil
        public let error: String?

        public init(base: String? = nil, ready: String?, error: String? = nil) {
            self.base = base
            self.ready = ready
            self.error = error
        }
    }

    public let address: String
    public let tokens: [String: Token]

    public init(address: String, tokens: [String: Token]) {
        self.address = address
        self.tokens = tokens
    }
}

/// A token as Charisma's token list describes it (`/api/v1/sip10`), only the fields the wallet reads
public struct TokenInfo: Decodable, Hashable, Sendable {
    /// Always set in the list; one-token lookups may leave it out
    public let contractId: String?
    public let name: String?
    public let symbol: String?
    public let decimals: Int?
    public let image: String?
    /// The fungible token's asset name, which post conditions need
    public let identifier: String?
    /// "SUBNET" for Blaze subnets
    public let type: String?
    /// For a subnet: the on-chain token it holds
    public let base: String?

    public init(
        contractId: String?, name: String?, symbol: String?, decimals: Int?, image: String? = nil,
        identifier: String?, type: String? = nil, base: String? = nil
    ) {
        self.contractId = contractId
        self.name = name
        self.symbol = symbol
        self.decimals = decimals
        self.image = image
        self.identifier = identifier
        self.type = type
        self.base = base
    }
}
```

`Sources/WalletCore/TokenRows.swift`:

```swift
import Foundation

/// What the wallet knows about a token. Without all three of name, symbol and decimals a token is unknown: shown in
/// raw units and never sendable, never guessed.
public struct TokenMeta: Hashable, Sendable {
    public let name: String
    public let symbol: String
    public let decimals: Int
    public let image: URL?

    init?(_ info: TokenInfo) {
        guard let name = info.name, let symbol = info.symbol, let decimals = info.decimals else { return nil }
        self.name = name
        self.symbol = symbol
        self.decimals = decimals
        self.image = info.image.flatMap { $0.isEmpty ? nil : URL(string: $0) }
    }
}

/// Why a row can't be sent from the wallet
public enum Unsendable: Sendable {
    /// Not on Charisma's token list (blocked as a scam, or an unknown airdrop)
    case unlisted
    /// Name, symbol or decimals unknown
    case unknown
    /// On the list, but without the asset name a post condition needs
    case missingAssetName
    /// Everything is on Blaze; sends spend the Standard balance (move Blaze funds with Charisma Swap)
    case onlyOnBlaze
    /// Nothing on Standard or Blaze (STX's row is always shown, even empty)
    case nothingToSend
}

/// One token the active account holds: its Standard (on Stacks) and Blaze (all its subnets) balances
public struct TokenRow: Hashable, Identifiable, Sendable {
    public static let stx = ".stx"

    /// Contract id, or ".stx"
    public let contractId: String
    /// On Stacks, counting what's on its way: what sends spend
    public let standard: Int128
    /// Its subnets added up, counting what's on its way
    public let blaze: Int128
    public let meta: TokenMeta?
    public let listed: Bool
    /// The asset name post conditions need: "" for STX, nil when the token list has none
    public let asset: String?

    public var id: String { contractId }
    public var isSTX: Bool { contractId == Self.stx }
    public var total: Int128 { standard + blaze }

    public var unsendable: Unsendable? {
        if !listed { return .unlisted }
        if meta == nil { return .unknown }
        if asset == nil { return .missingAssetName }
        if standard <= 0 { return blaze > 0 ? .onlyOnBlaze : .nothingToSend }
        return nil
    }
}

/// The extension's getWalletBalances (apps/signet/src/background/lib/tokens.ts)
public enum TokenRows {
    /// Contract ids that will become rows but aren't on the list: look them up (`Charisma.lookUp`) before `build`
    public static func unlisted(sheet: BalanceSheet, list: [TokenInfo]) -> [String] {
        let listed = Set(list.compactMap(\.contractId)).union([TokenRow.stx])
        return totals(sheet).keys.filter { !listed.contains($0) }.sorted()
    }

    /// Blaze balances fold into their base token's row. STX is always there; other rows with nothing on either side
    /// are dropped. Order: STX, then tokens with a Standard balance, then tokens held only on Blaze, each by contract
    /// id, so rows stay put across refreshes and live updates. `lookups` holds what `unlisted` asked for; a token
    /// missing from it is unknown.
    public static func build(sheet: BalanceSheet, list: [TokenInfo], lookups: [String: TokenInfo]) -> [TokenRow] {
        let byId = Dictionary(list.compactMap { info in info.contractId.map { ($0, info) } }, uniquingKeysWith: { first, _ in first })
        let rows = totals(sheet).map { id, total -> TokenRow in
            let info = byId[id] ?? lookups[id]
            let isSTX = id == TokenRow.stx
            return TokenRow(
                contractId: id, standard: total.standard, blaze: total.blaze,
                meta: info.flatMap(TokenMeta.init), listed: isSTX || byId[id] != nil,
                asset: isSTX ? "" : info?.identifier.flatMap { $0.isEmpty ? nil : $0 }
            )
        }
        return rows.sorted { a, b in
            let rank = { (row: TokenRow) in row.isSTX ? 0 : row.standard != 0 ? 1 : 2 }
            return (rank(a), a.contractId) < (rank(b), b.contractId)
        }
    }

    /// Each row's Standard and Blaze totals: STX always, others only when something is on either side. A token whose
    /// balance the service couldn't read is left out and logged (the extension's rule).
    private static func totals(_ sheet: BalanceSheet) -> [String: (standard: Int128, blaze: Int128)] {
        var totals: [String: (standard: Int128, blaze: Int128)] = [TokenRow.stx: (0, 0)]
        for (id, token) in sheet.tokens {
            guard let ready = token.ready, let amount = Int128(ready) else {
                Log.balances.error("Couldn't read \(id, privacy: .public)'s balance: \(token.error ?? "no amount", privacy: .public)")
                continue
            }
            let base = token.base ?? id
            var row = totals[base] ?? (0, 0)
            if token.base == nil { row.standard += amount } else { row.blaze += amount }
            totals[base] = row
        }
        return totals.filter { id, total in id == TokenRow.stx || total.standard != 0 || total.blaze != 0 }
    }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 41 tests in 11 suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit
git commit -m "feat(blaze-ios): One row per token, Standard and Blaze added up, in a stable order" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Charisma's and Hiro's servers

**Files:**
- Create: `Sources/WalletCore/HTTP.swift`, `Sources/WalletCore/Charisma.swift`, `Sources/WalletCore/Hiro.swift`
- Test: `Tests/WalletCoreTests/LiveTests.swift`

- [ ] **Write the live tests** (opt-in; they read real servers)

```swift
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
        let found = await charisma.lookUp(["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welshcorgicoin-token"])
        #expect(found["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"]?.symbol == "CHA")
    }

    @Test func theBalanceStreamSendsASheet() async throws {
        var stream = Charisma().watchBalances(address: TestPhrase.account0).makeAsyncIterator()
        let sheet = await stream.next()
        #expect(sheet?.address == TestPhrase.account0)
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
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "error:" | head`
Expected: the build fails because `Charisma` doesn't exist yet.

- [ ] **Write the clients**

`Sources/WalletCore/HTTP.swift`:

```swift
import Foundation

/// JSON over HTTPS. Every failure is a `WalletError` that names the service.
struct HTTP: Sendable {
    let session: URLSession

    func get<T: Decodable>(_ url: URL, from service: Service, as: T.Type = T.self) async throws -> T {
        try decode(try await send(URLRequest(url: url), to: service), from: service)
    }

    func post<T: Decodable>(_ url: URL, json: some Encodable, from service: Service, as: T.Type = T.self) async throws -> T {
        try decode(try await send(Self.jsonRequest(url, json), to: service), from: service)
    }

    /// The body of a 2xx answer. Hiro rate limits (429) are waited out: its Retry-After, otherwise 1, 2 then 4 seconds.
    func send(_ request: URLRequest, to service: Service) async throws -> Data {
        let (data, response) = try await answer(request, from: service)
        guard (200..<300).contains(response.statusCode) else {
            Log.network.error("\(request.url?.absoluteString ?? "?", privacy: .public) answered \(response.statusCode)")
            throw WalletError.requestFailed(service, status: response.statusCode)
        }
        return data
    }

    /// Any answer, with its status, for callers that read error bodies (broadcast, fee estimate)
    func answer(_ request: URLRequest, from service: Service) async throws -> (Data, HTTPURLResponse) {
        var request = request
        request.cachePolicy = .reloadIgnoringLocalCacheData
        var attempt = 0
        while true {
            let data: Data, response: URLResponse
            do {
                (data, response) = try await session.data(for: request)
            } catch let error as URLError where error.code == .cancelled {
                // SwiftUI cancels work it no longer needs (a tab or account switch): not a failure to show
                throw CancellationError()
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                Log.network.error("\(request.url?.absoluteString ?? "?", privacy: .public): \(error.localizedDescription, privacy: .public)")
                throw WalletError.unreachable(service)
            }
            guard let http = response as? HTTPURLResponse else { throw WalletError.unreadable(service) }
            if http.statusCode == 429, service == .stacks, attempt < 3 {
                let retryAfter = http.value(forHTTPHeaderField: "Retry-After").flatMap(Double.init) ?? 0
                try await Task.sleep(for: .seconds(retryAfter > 0 ? retryAfter : pow(2, Double(attempt))))
                attempt += 1
                continue
            }
            return (data, http)
        }
    }

    func decode<T: Decodable>(_ data: Data, from service: Service, as: T.Type = T.self) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            Log.network.error("\(service.rawValue, privacy: .public): unreadable answer: \(error, privacy: .public)")
            throw WalletError.unreadable(service)
        }
    }

    static func jsonRequest(_ url: URL, _ body: some Encodable) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(body)
        return request
    }
}
```

`Sources/WalletCore/Charisma.swift`:

```swift
import Foundation

/// Charisma's servers: balances (the same service Swap and Meme Roulette use), the token list and USD prices
public struct Charisma: Sendable {
    static let balances = URL(string: "https://swap.charisma.rocks/api/v1/balances")!
    static let tokens = URL(string: "https://tokens.charisma.rocks/api/v1/sip10")!
    static let prices = URL(string: "https://lakehouse.charisma.rocks/api/token-prices?limit=1000")!

    let http: HTTP

    public init(session: URLSession = .shared) {
        http = HTTP(session: session)
    }

    public func balanceSheet(address: String) async throws -> BalanceSheet {
        try await http.get(Self.balances.appending(path: address).appending(path: "sheet"), from: .balances)
    }

    /// Charisma's token list. Blocking a token (a scam) takes it off this list, so an empty list is an error.
    public func tokenList() async throws -> [TokenInfo] {
        let list = try await http.get(Self.tokens, from: .tokenList, as: [TokenInfo].self)
        guard !list.isEmpty else { throw WalletError.tokenListUnavailable }
        return list
    }

    /// One token's details, for tokens that aren't on the list
    public func token(_ contractId: String) async throws -> TokenInfo {
        struct Answer: Decodable { let data: TokenInfo }
        return try await http.get(Self.tokens.appending(path: contractId), from: .tokenList, as: Answer.self).data
    }

    /// Details for tokens that aren't on the list, all at once. A failed lookup is logged and left out, so that token
    /// shows as unknown (the extension's rule): one bad token never blanks the Tokens tab.
    public func lookUp(_ contractIds: [String]) async -> [String: TokenInfo] {
        await withTaskGroup(of: (String, TokenInfo?).self) { group in
            for id in contractIds {
                group.addTask {
                    do {
                        return (id, try await token(id))
                    } catch {
                        Log.balances.error("Couldn't look up \(id, privacy: .public): \(error, privacy: .public)")
                        return (id, nil)
                    }
                }
            }
            var found: [String: TokenInfo] = [:]
            for await (id, info) in group {
                if let info { found[id] = info }
            }
            return found
        }
    }

    /// USD per whole token, by contract id (".stx" for STX)
    public func usdPrices() async throws -> [String: Double] {
        struct Price: Decodable {
            let token_contract_id: String
            let usd_price: Double
        }
        struct Answer: Decodable { let prices: [Price] }
        let prices = try await http.get(Self.prices, from: .prices, as: Answer.self).prices
        return Dictionary(prices.map { ($0.token_contract_id, $0.usd_price) }, uniquingKeysWith: { first, _ in first })
    }

    /// The address's balance sheet now and every time it changes, pushed by the service (no polling). Reconnects on
    /// its own like blaze-sdk's watchBalances: about a second after the service closes a stream (it does every few
    /// minutes), and 1 s doubling to 30 s after errors. `problem` events are ignored, as in the extension. Stops when
    /// the consuming task is cancelled.
    public func watchBalances(address: String) -> AsyncStream<BalanceSheet> {
        let request = {
            var request = URLRequest(url: Self.balances.appending(path: address).appending(path: "stream"))
            request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
            request.cachePolicy = .reloadIgnoringLocalCacheData
            return request
        }()
        let session = http.session
        return AsyncStream { continuation in
            let task = Task {
                var wait: Double = 1
                while !Task.isCancelled {
                    do {
                        let (bytes, response) = try await session.bytes(for: request)
                        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                        guard status == 200 else { throw WalletError.requestFailed(.balances, status: status) }
                        wait = 1
                        // Each event is one `event:` line and one `data:` line (`lines` skips the blank line between)
                        var event = ""
                        for try await line in bytes.lines {
                            if line.hasPrefix("event:") {
                                event = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
                            } else if line.hasPrefix("data:"), event == "sheet" {
                                let data = Data(line.dropFirst(5).trimmingCharacters(in: .whitespaces).utf8)
                                continuation.yield(try JSONDecoder().decode(BalanceSheet.self, from: data))
                                event = ""
                            }
                        }
                    } catch {
                        if Task.isCancelled { break }
                        Log.network.error("balance stream: \(error, privacy: .public)")
                        wait = min(wait * 2, 30)
                    }
                    try? await Task.sleep(for: .seconds(wait))
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
```

`Sources/WalletCore/Hiro.swift`:

```swift
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
        let request = HTTP.jsonRequest(
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
        return rate * UInt64(transaction.estimatedLength)
    }

    /// Sends a signed transaction to the network and returns its txid
    public func broadcast(_ transaction: StacksTransaction) async throws -> String {
        struct Request: Encodable { let tx: String }
        struct Rejection: Decodable {
            let error: String?
            let reason: String?
        }
        let request = HTTP.jsonRequest(Self.base.appending(path: "v2/transactions"), Request(tx: transaction.serialized.hex))
        let (data, response) = try await http.answer(request, from: .stacks)
        if response.statusCode == 400 {
            // Refused transactions come back as JSON; ones the node can't even read, as plain text
            let rejection = try? JSONDecoder().decode(Rejection.self, from: data)
            throw WalletError.rejected(reason: rejection?.reason ?? rejection?.error ?? String(decoding: data, as: UTF8.self))
        }
        guard (200..<300).contains(response.statusCode) else {
            throw WalletError.requestFailed(.stacks, status: response.statusCode)
        }
        let txid = try http.decode(data, from: .stacks, as: String.self)
        guard txid.count == 64 || txid.count == 66 else { throw WalletError.unreadable(.stacks) }
        return txid.hasPrefix("0x") ? String(txid.dropFirst(2)) : txid
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
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 45 tests in 12 suites passed`, and no `✘` lines.

- [ ] **Run the live checks** (needs the network)

Run: `BLAZE_LIVE=1 swift test --package-path apps/blaze-ios/BlazeKit --filter LiveTests 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 4 tests in 1 suite passed`. If one fails, read the real answer with `curl` (the URLs are in the clients), fix the decoder to match it, and say what changed in the commit message.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit
git commit -m "feat(blaze-ios): Clients for Charisma's balances, token list and prices, and Hiro" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sending

**Files:**
- Create: `Sources/WalletCore/Send.swift`
- Test: `Tests/WalletCoreTests/SendTests.swift`

- [ ] **Write the failing tests**

```swift
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
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "error:" | head`
Expected: the build fails because `Send` doesn't exist yet.

- [ ] **Write the send flow**

```swift
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
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 49 tests in 13 suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit
git commit -m "feat(blaze-ios): Sends checked like the extension's, plus the STX-for-fee check" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Status's checks

**Files:**
- Create: `Sources/WalletCore/Diagnostics.swift`
- Test: `Tests/WalletCoreTests/LiveDiagnosticsTests.swift`

- [ ] **Write the live test**

```swift
import Foundation
import StacksKit
import Testing
@testable import WalletCore

/// Status's checks against the real servers. Opt in: BLAZE_LIVE=1 swift test --filter LiveDiagnosticsTests
@Suite(.enabled(if: ProcessInfo.processInfo.environment["BLAZE_LIVE"] == "1"), .timeLimit(.minutes(1)))
struct LiveDiagnosticsTests {
    @Test func statusChecksEverything() async throws {
        let hiro = Hiro()
        let deployer = try StacksAddress("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS")
        let reader = SubnetReader(hiro: hiro)
        let diagnostics = try await Diagnostics.check(address: deployer, charisma: Charisma(), hiro: hiro, subnets: reader)
        #expect(diagnostics.blockHeight > 0 && diagnostics.tokenCount > 0)
        #expect(diagnostics.subnets.count >= 30)
        #expect(diagnostics.subnets.contains { ($0.balance ?? 0) > 0 })
        // A second look within a minute is kept, not read again
        let clock = ContinuousClock()
        let start = clock.now
        _ = await reader.balances(of: deployer, list: try await Charisma().tokenList())
        #expect(start.duration(to: clock.now) < .seconds(5))
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "error:" | head`
Expected: the build fails because `Diagnostics` doesn't exist yet.

- [ ] **Write the diagnostics**

```swift
import Foundation
import StacksKit

/// An address's balance on one Blaze subnet, for Status
public struct SubnetBalance: Hashable, Identifiable, Sendable {
    public let contractId: String
    public let symbol: String
    public let decimals: Int
    /// The on-chain token it holds (".stx" for STX), when the token list says
    public let base: String?
    /// Smallest units; nil when the read failed (logged for developers, left out of "Holding your funds")
    public let balance: Int128?

    public var id: String { contractId }
}

/// Status's real checks: the Stacks network, Charisma's token list and every Blaze subnet (the extension's
/// background/lib/diagnostics.ts)
public struct Diagnostics: Sendable {
    public let checkedAt: Date
    public let blockHeight: Int
    public let networkLatency: Duration
    public let tokenCount: Int
    public let tokenListLatency: Duration
    public let subnets: [SubnetBalance]

    public static func check(address: StacksAddress, charisma: Charisma, hiro: Hiro, subnets: SubnetReader) async throws -> Diagnostics {
        let clock = ContinuousClock()
        async let network = clock.measured { try await hiro.tipHeight() }
        async let tokens = clock.measured { try await charisma.tokenList() }
        let (height, networkLatency) = try await network
        let (list, tokenListLatency) = try await tokens
        return Diagnostics(
            checkedAt: Date(), blockHeight: height, networkLatency: networkLatency,
            tokenCount: list.count, tokenListLatency: tokenListLatency,
            subnets: await subnets.balances(of: address, list: list)
        )
    }
}

/// Reads an address's balance on every subnet in the token list, four at a time (Hiro rate-limits), keeping the
/// answer for a minute so Status doesn't ask ~37 contracts again on every visit
public actor SubnetReader {
    private let hiro: Hiro
    private var kept: (address: StacksAddress, at: Date, balances: [SubnetBalance])?

    public init(hiro: Hiro) {
        self.hiro = hiro
    }

    public func balances(of address: StacksAddress, list: [TokenInfo]) async -> [SubnetBalance] {
        if let kept, kept.address == address, Date().timeIntervalSince(kept.at) < 60 { return kept.balances }
        let subnets = list.filter { info in
            guard info.type == "SUBNET" else { return false }
            guard info.contractId != nil, info.symbol != nil, info.decimals != nil else {
                // Without these its balance can't be shown honestly: a token-list data problem for developers
                Log.balances.error("Subnet \(info.contractId ?? "?", privacy: .public) has no contract id, symbol or decimals on the token list")
                return false
            }
            return true
        }
        var balances: [SubnetBalance] = []
        for start in stride(from: 0, to: subnets.count, by: 4) {
            let batch = subnets[start..<min(start + 4, subnets.count)]
            balances += await withTaskGroup(of: (Int, SubnetBalance).self) { group in
                for (offset, info) in batch.enumerated() {
                    group.addTask { [hiro] in (offset, await Self.read(info, of: address, hiro: hiro)) }
                }
                var results: [(Int, SubnetBalance)] = []
                for await result in group { results.append(result) }
                return results.sorted { $0.0 < $1.0 }.map(\.1)
            }
        }
        kept = (address, Date(), balances)
        return balances
    }

    /// `info` has a contract id, symbol and decimals (checked by `balances`)
    private static func read(_ info: TokenInfo, of address: StacksAddress, hiro: Hiro) async -> SubnetBalance {
        let id = info.contractId!
        // The token list calls STX's base "stx"; the wallet calls it ".stx"
        let base = info.base.map { $0 == "stx" ? TokenRow.stx : $0 }
        var balance: Int128?
        do {
            guard case .contract(let subnet, let name) = try Principal(id) else { throw WalletError.unexpected(id) }
            balance = try await hiro.subnetBalance(subnet: subnet, name: name, of: address)
        } catch {
            // A subnet that can't be read is a token-list data problem for developers, not news for the person
            Log.balances.error("Couldn't read subnet \(id, privacy: .public): \(error, privacy: .public)")
        }
        return SubnetBalance(contractId: id, symbol: info.symbol!, decimals: info.decimals!, base: base, balance: balance)
    }
}

private extension ContinuousClock {
    /// The work's result and how long it took
    func measured<T>(_ work: () async throws -> T) async rethrows -> (T, Duration) {
        let start = now
        let value = try await work()
        return (value, start.duration(to: now))
    }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 50 tests in 14 suites passed`, and no `✘` lines.

- [ ] **Run the live check**

Run: `BLAZE_LIVE=1 swift test --package-path apps/blaze-ios/BlazeKit --filter LiveDiagnosticsTests 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 1 test in 1 suite passed`

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit
git commit -m "feat(blaze-ios): Status checks the network, the token list and every Blaze subnet" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Hand-off check

- [ ] **Run everything from a clean build, live checks included**

```bash
rm -rf apps/blaze-ios/BlazeKit/.build && BLAZE_LIVE=1 swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|warning:|Test run with"
```

Expected: `✔ Test run with 50 tests in 14 suites passed`, with no errors and no warnings from `Sources/`.

- [ ] **Confirm the tree is clean** with `git status`, and report the last commit to Ross.
