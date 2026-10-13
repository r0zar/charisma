# Blaze Wallet, Plan 5: Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what the code reviews found in WalletCore (its second round), the iPhone app (plan 3) and the extension (plan 4), so both are ready for Ross's manual pass.

**Architecture:** Changes only, no new features: three patches, one new SwiftUI file, and four new app strings in all nine languages.

**Tech Stack:** Swift 6, SwiftUI, SafariServices, Swift Testing; TypeScript, React (Plasmo); Node for the checks.

**Specs:** `docs/superpowers/specs/2026-10-12-blaze-wallet-ios-design.md` and `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md`.

**Baseline:** branch `feat/blaze-ios` with plans 1 to 4 done: 56 BlazeKit tests pass, the app builds, and both apps' string checks pass.

---

## Working notes for every task

- **Pre-tested.** Every change was made and checked in copies of both apps before this plan was written:
  - BlazeKit: 56 tests pass, the 7 live ones too, in debug and release builds. The new stream test fails if the stream outlives its reader.
  - The app builds for the simulator with no warnings from its own code, and its strings check passes in all eight languages.
  - The extension's stricter locale check passes, and `tsc --noEmit` reports only the error `main` already has (`wbip_providers`).

  Apply the patches exactly. If `git apply --check` fails, stop and report it.
- **Commands.** Run every command from the repo root, unless a step says `cd`.
- **The extension:** don't install or build it. Ross runs its dev server.
- **Commits:** commit after every task, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: WalletCore, second review

What the review of plan 2's Task 9 found:
- The `Send.review` comment overstated the Swift 6.3 bug's reach and how to avoid it: it is debug builds on arm64, and small wrapper structs are corrupted too. The README now carries the rule.
- A balance-stream error logged a `URLError`, whose description names the URL, which holds the address.
- A broadcast the network accepted (2xx) with a body that couldn't be read failed the send. The answer is only a cross-check now.
- Three live tests couldn't fail. The stream test now watches the connection close. The kept-subnets test asks with an empty list, which only the kept answer can fill. The signing test checks the signature and the fee.

**Files:** Modify `apps/blaze-ios/BlazeKit/Sources/WalletCore/Send.swift`, `apps/blaze-ios/BlazeKit/Sources/WalletCore/Charisma.swift`, `apps/blaze-ios/BlazeKit/Sources/WalletCore/Hiro.swift`, `apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveTests.swift`, `apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveDiagnosticsTests.swift`, `apps/blaze-ios/README.md`

- [ ] **Apply the patch.** Save it as `/tmp/plan5-task1.patch`, then run `git apply --check /tmp/plan5-task1.patch && git apply /tmp/plan5-task1.patch`.

```diff
diff --git a/apps/blaze-ios/BlazeKit/Sources/WalletCore/Charisma.swift b/apps/blaze-ios/BlazeKit/Sources/WalletCore/Charisma.swift
index 69a496a..70a8955 100644
--- a/apps/blaze-ios/BlazeKit/Sources/WalletCore/Charisma.swift
+++ b/apps/blaze-ios/BlazeKit/Sources/WalletCore/Charisma.swift
@@ -101,7 +101,8 @@ public struct Charisma: Sendable {
                         }
                     } catch {
                         if Task.isCancelled { break }
-                        Log.network.error("balance stream: \(error, privacy: .public)")
+                        // A URLError's own description names the URL, which holds the address
+                        Log.network.error("balance stream: \((error as? URLError)?.localizedDescription ?? "\(error)", privacy: .public)")
                         wait = min(wait * 2, 30)
                     }
                     try? await Task.sleep(for: .seconds(wait))
diff --git a/apps/blaze-ios/BlazeKit/Sources/WalletCore/Hiro.swift b/apps/blaze-ios/BlazeKit/Sources/WalletCore/Hiro.swift
index 6289fd9..a7f2314 100644
--- a/apps/blaze-ios/BlazeKit/Sources/WalletCore/Hiro.swift
+++ b/apps/blaze-ios/BlazeKit/Sources/WalletCore/Hiro.swift
@@ -63,10 +63,11 @@ public struct Hiro: Sendable {
         guard (200..<300).contains(response.statusCode) else {
             throw WalletError.requestFailed(.stacks, status: response.statusCode)
         }
-        let answered = try http.decode(data, from: .stacks, as: String.self)
+        // The network took it, so its answer is only a cross-check: an unreadable one never fails the send
+        let answered = try? http.decode(data, from: .stacks, as: String.self)
         let txid = transaction.txid
         if answered != txid && answered != "0x" + txid {
-            Log.network.error("Hiro answered txid \(answered, privacy: .public), the signed transaction is \(txid, privacy: .public)")
+            Log.network.error("Hiro answered txid \(answered ?? "unreadable", privacy: .public), the signed transaction is \(txid, privacy: .public)")
         }
         return txid
     }
diff --git a/apps/blaze-ios/BlazeKit/Sources/WalletCore/Send.swift b/apps/blaze-ios/BlazeKit/Sources/WalletCore/Send.swift
index dc91def..9c31cf3 100644
--- a/apps/blaze-ios/BlazeKit/Sources/WalletCore/Send.swift
+++ b/apps/blaze-ios/BlazeKit/Sources/WalletCore/Send.swift
@@ -61,9 +61,11 @@ public enum Send {
     /// Checks everything a send needs, estimating the network fee. `locale` reads the typed amount. `stx` is the STX row:
     /// the fee comes out of its Standard balance.
     ///
-    /// It takes the STX row, not its balance, because Swift 6.3 can pass an Int128 argument of an async function, and
-    /// the arguments after it, corrupted: a 1 STX balance arrived as a 30-digit number. Async functions here take no
-    /// Int128 arguments; pass the struct that holds the number.
+    /// It takes the STX row, not its balance. Swift 6.3 debug builds on arm64 can corrupt an async function's Int128 or
+    /// UInt128 argument, and the arguments after it, when it comes late in a long argument list (a large return value
+    /// counts as one more): a 1 STX balance arrived as a 33-digit number. A small struct or tuple holding the number is
+    /// corrupted the same way; a large struct such as TokenRow goes by reference and arrives intact. So async functions
+    /// here take no 128-bit argument, bare or wrapped.
     public static func review(
         row: TokenRow, recipient recipientText: String, amount amountText: String, locale: Locale, stx: TokenRow,
         account: Account, hiro: Hiro
diff --git a/apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveDiagnosticsTests.swift b/apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveDiagnosticsTests.swift
index 0d4ac82..1b4d3ac 100644
--- a/apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveDiagnosticsTests.swift
+++ b/apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveDiagnosticsTests.swift
@@ -14,10 +14,7 @@ struct LiveDiagnosticsTests {
         #expect(diagnostics.blockHeight > 0 && diagnostics.tokenCount > 0)
         #expect(diagnostics.subnets.count >= 30)
         #expect(diagnostics.subnets.contains { ($0.balance ?? 0) > 0 })
-        // A second look within a minute is kept, not read again
-        let clock = ContinuousClock()
-        let start = clock.now
-        let kept = try await reader.balances(of: deployer, list: try await Charisma().tokenList())
-        #expect(!kept.isEmpty && start.duration(to: clock.now) < .seconds(5))
+        // A second look within a minute is the kept answer: read again, an empty list would give no subnets at all
+        #expect(try await reader.balances(of: deployer, list: []) == diagnostics.subnets)
     }
 }
diff --git a/apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveTests.swift b/apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveTests.swift
index 3e00ee5..4b18c95 100644
--- a/apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveTests.swift
+++ b/apps/blaze-ios/BlazeKit/Tests/WalletCoreTests/LiveTests.swift
@@ -32,14 +32,17 @@ struct LiveTests {
     }
 
     @Test func theBalanceStreamStopsWithItsReader() async throws {
-        let stream = Charisma().watchBalances(address: TestPhrase.account0)
+        let (ended, connection) = AsyncStream.makeStream(of: URLError.Code?.self)
+        let session = URLSession(configuration: .ephemeral, delegate: ConnectionEnds(connection), delegateQueue: nil)
+        let stream = Charisma(session: session).watchBalances(address: TestPhrase.account0)
         let reader = Task {
             for await _ in stream {}
         }
         try await Task.sleep(for: .seconds(2))
         reader.cancel()
-        // Returns: cancelling the reader ended the stream (the suite's time limit fails it otherwise)
-        await reader.value
+        // The connection itself closes, cancelled, rather than staying open behind a reader that has gone
+        var codes = ended.makeAsyncIterator()
+        #expect(await codes.next() == .cancelled)
     }
 
     @Test func reviewAndSignAgainstTheNetwork() async throws {
@@ -57,9 +60,9 @@ struct LiveTests {
             guard case WalletError.notEnoughSTXForFee(let fee, let stxBalance, let mostSendable) = error else { return false }
             return fee > 100 && stxBalance == 100 && mostSendable == 0
         }
-        // Signed, never broadcast: the txid is known before anything is sent
+        // Signed at the reviewed fee, never broadcast
         let signed = try await Send.sign(review, from: account, hiro: Hiro())
-        #expect(signed.txid.count == 64)
+        #expect(signed.signature != Data(repeating: 0, count: 65) && signed.fee == UInt64(review.fee))
     }
 
     @Test func hiroAnswersAreReadable() async throws {
@@ -87,3 +90,17 @@ struct LiveTests {
         }
     }
 }
+
+/// Tells a test how each of a session's connections ended: nil when it finished cleanly. Tasks made by `bytes(for:)`
+/// don't call the session's didCompleteWithError, but every task's metrics arrive once it has ended.
+private final class ConnectionEnds: NSObject, URLSessionTaskDelegate, Sendable {
+    let ended: AsyncStream<URLError.Code?>.Continuation
+
+    init(_ ended: AsyncStream<URLError.Code?>.Continuation) {
+        self.ended = ended
+    }
+
+    func urlSession(_ session: URLSession, task: URLSessionTask, didFinishCollecting metrics: URLSessionTaskMetrics) {
+        ended.yield((task.error as? URLError)?.code)
+    }
+}
diff --git a/apps/blaze-ios/README.md b/apps/blaze-ios/README.md
index 1ce8105..159e4f4 100644
--- a/apps/blaze-ios/README.md
+++ b/apps/blaze-ios/README.md
@@ -19,6 +19,7 @@ It has no website connections. Specs: `docs/superpowers/specs/2026-10-12-blaze-w
 
 - `swift test --package-path apps/blaze-ios/BlazeKit` runs the StacksKit and WalletCore tests.
 - `BLAZE_LIVE=1 swift test --package-path apps/blaze-ios/BlazeKit --filter Live` runs the same checks against the real servers. They only read.
+- **No 128-bit arguments on async functions,** bare or in a small struct: Swift 6.3 debug builds on arm64 can corrupt them and the arguments after them. Pass a large struct that holds the number instead (see `Send.review`).
 
 ## Regenerate
 
```

- [ ] **Run the tests:** `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`. Expected: `✔ Test run with 56 tests in 14 suites passed`.
- [ ] **Run the live checks** (they only read): `BLAZE_LIVE=1 swift test --package-path apps/blaze-ios/BlazeKit --filter Live 2>&1 | grep -E "✘|error:|Test run with"`. Expected: `✔ Test run with 7 tests in 2 suites passed`. A `429` from Hiro means its rate limit: wait a minute and run it again.
- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit apps/blaze-ios/README.md
git commit -m "fix(blaze-ios): WalletCore's second review: the Int128 rule written down, no addresses in logs, accepted sends never fail, live tests that can fail" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The app, plan 3's review

What the review found, and the fix for each:
- **A signed send could be lost and sent again.**
  - "View on explorer" opened Safari. Leaving the app locks the wallet, which closed the sheet and dropped the signed transaction. Coming back and sending again would sign a new one at the next nonce: paid twice.
  - Explorer links now open inside the app (`SafariView`).
  - Cancel is off while sending, and a signed send can't be swiped away.
  - After a failed broadcast, a line says to check the explorer before sending again.
  - The lock is checked again just before broadcasting, and a double tap can't start a second send.
- **The recipient field capitalized contract names,** which changes the address. It no longer auto-capitalizes.
- **Face ID races.**
  - An unlock or create whose Face ID check ends after the app left (a lock happened) now unlocks nothing.
  - Seed words are read only after Face ID passes.
  - The idle check no longer re-locks a locked wallet, which used to change what the lock screen does on return.
- **Turning off the iPhone's passcode** makes iOS delete the wallet. The lock screen used to get stuck on a Keychain error. Now it goes to Welcome, which explains and suggests importing the seed phrase.
- **Errors the app raised itself skipped the catalog.** An unreadable saved wallet is a `VaultError` with its own words. Anything unexpected shows its own description, not Swift's "error 3".
- **Status:**
  - One check runs at a time.
  - "Check again" no longer brings the next automatic check forward.
  - "Checking…" shows only while a check runs.
  - The tab no longer wraps a model it doesn't own in `@State`.
- **Smaller fixes:**
  - The button says "Show seed phrase", as the spec decided, and the row stacks when a language is too long for it.
  - Unlisted tokens show their letter instead of loading an image from wherever the token's maker chose.
  - A recovered stream clears an old load error.
  - Back clears the review's error.
  - Max has no default decimals.
  - The QR renderer is made once.

**Files:**
- Create: `apps/blaze-ios/BlazeWallet/Shared/SafariView.swift`
- Modify: `apps/blaze-ios/BlazeWallet/Tokens/SendSheet.swift`, `apps/blaze-ios/BlazeWallet/Vault/Vault.swift`, `apps/blaze-ios/BlazeWallet/Vault/Keychain.swift`, `apps/blaze-ios/BlazeWallet/Shared/ErrorText.swift`, `apps/blaze-ios/BlazeWallet/App/WelcomeView.swift`, `apps/blaze-ios/BlazeWallet/Status/StatusModel.swift`, `apps/blaze-ios/BlazeWallet/Status/StatusTab.swift`, `apps/blaze-ios/BlazeWallet/Tokens/TokensModel.swift`, `apps/blaze-ios/BlazeWallet/Tokens/TokenRowView.swift`, `apps/blaze-ios/BlazeWallet/Wallet/WalletTab.swift`, `apps/blaze-ios/BlazeWallet/Wallet/ReceiveSheet.swift`, `apps/blaze-ios/BlazeWallet/Localizable.xcstrings`

- [ ] **Write the in-app web page**

`apps/blaze-ios/BlazeWallet/Shared/SafariView.swift`:

```swift
import SafariServices
import SwiftUI

/// A web page shown inside the app. Opening Safari instead would leave the app, and leaving locks the wallet.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}
```

- [ ] **Apply the patch.** Save it as `/tmp/plan5-task2.patch`, then run `git apply --check /tmp/plan5-task2.patch && git apply /tmp/plan5-task2.patch`.

```diff
diff --git a/apps/blaze-ios/BlazeWallet/App/WelcomeView.swift b/apps/blaze-ios/BlazeWallet/App/WelcomeView.swift
index 11994d0..9a0abeb 100644
--- a/apps/blaze-ios/BlazeWallet/App/WelcomeView.swift
+++ b/apps/blaze-ios/BlazeWallet/App/WelcomeView.swift
@@ -2,6 +2,8 @@ import SwiftUI
 
 /// No wallet on this iPhone yet: make a new seed phrase or bring one
 struct WelcomeView: View {
+    @Environment(Vault.self) private var vault
+
     var body: some View {
         NavigationStack {
             VStack(spacing: 16) {
@@ -12,6 +14,12 @@ struct WelcomeView: View {
                     .multilineTextAlignment(.center)
                     .foregroundStyle(.brand("ink-muted"))
                 Spacer()
+                if vault.walletRemoved {
+                    Text("Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.")
+                        .multilineTextAlignment(.center)
+                        .foregroundStyle(.brand("warning"))
+                        .brandFont(.callout)
+                }
                 NavigationLink { NewSeedFlow(mode: .createWallet) } label: {
                     Text("Create a new wallet").frame(maxWidth: .infinity)
                 }
diff --git a/apps/blaze-ios/BlazeWallet/Shared/ErrorText.swift b/apps/blaze-ios/BlazeWallet/Shared/ErrorText.swift
index b0badef..87574ac 100644
--- a/apps/blaze-ios/BlazeWallet/Shared/ErrorText.swift
+++ b/apps/blaze-ios/BlazeWallet/Shared/ErrorText.swift
@@ -17,7 +17,8 @@ enum ErrorWords {
         case let error as VaultError: vault(error)
         case let error as AppError: app(error)
         case StacksError.randomUnavailable: String(localized: "This iPhone couldn't make random words. Try again.")
-        default: String(localized: "Something went wrong: \(error.localizedDescription)")
+        // Nothing else should reach a screen: its own description, rather than Swift's "error 3"
+        default: String(localized: "Something went wrong: \(String(describing: error))")
         }
     }
 
@@ -75,6 +76,7 @@ enum ErrorWords {
         case .authenticationUnavailable: String(localized: "Face ID and the passcode aren't available on this iPhone right now.")
         case .keychain(let status): String(localized: "This iPhone's Keychain refused (\(String(status))).")
         case .cancelled: String(localized: "Cancelled.")
+        case .unreadable: String(localized: "The wallet saved on this iPhone can't be read.")
         }
     }
 
diff --git a/apps/blaze-ios/BlazeWallet/Status/StatusModel.swift b/apps/blaze-ios/BlazeWallet/Status/StatusModel.swift
index 10df034..9a67e52 100644
--- a/apps/blaze-ios/BlazeWallet/Status/StatusModel.swift
+++ b/apps/blaze-ios/BlazeWallet/Status/StatusModel.swift
@@ -23,7 +23,9 @@ final class StatusModel {
         subnets = SubnetReader(hiro: hiro)
     }
 
+    /// One check at a time: does nothing while one is running
     func check(address: String) async {
+        guard !checking else { return }
         attemptedAt = Date()
         attemptedFor = address
         error = nil
diff --git a/apps/blaze-ios/BlazeWallet/Status/StatusTab.swift b/apps/blaze-ios/BlazeWallet/Status/StatusTab.swift
index 2bdb275..b9e6a9e 100644
--- a/apps/blaze-ios/BlazeWallet/Status/StatusTab.swift
+++ b/apps/blaze-ios/BlazeWallet/Status/StatusTab.swift
@@ -6,7 +6,8 @@ struct StatusTab: View {
     let account: Account
 
     @Environment(Vault.self) private var vault
-    @State private var model: StatusModel
+    /// MainView keeps it for the whole unlock
+    let model: StatusModel
 
     private static let interval: TimeInterval = 5 * 60
 
@@ -15,7 +16,7 @@ struct StatusTab: View {
 
     init(account: Account, model: StatusModel) {
         self.account = account
-        _model = State(initialValue: model)
+        self.model = model
     }
 
     var body: some View {
@@ -25,7 +26,7 @@ struct StatusTab: View {
                     HStack {
                         if let checkedAt = diagnostics?.checkedAt {
                             Text("Checked at \(checkedAt.formatted(date: .omitted, time: .shortened))")
-                        } else {
+                        } else if model.checking {
                             Text("Checking…")
                         }
                         Spacer()
@@ -58,6 +59,13 @@ struct StatusTab: View {
                     if model.attemptedFor == account.stxAddress, let attemptedAt = model.attemptedAt,
                        -attemptedAt.timeIntervalSinceNow < Self.interval {
                         guard (try? await Task.sleep(for: .seconds(Self.interval + attemptedAt.timeIntervalSinceNow))) != nil else { return }
+                        // "Check again" may have run meanwhile: measure from the latest attempt
+                        continue
+                    }
+                    if model.checking {
+                        // "Check again" is running, maybe for the account shown before: look again in a moment
+                        guard (try? await Task.sleep(for: .seconds(1))) != nil else { return }
+                        continue
                     }
                     await model.check(address: account.stxAddress)
                 }
@@ -65,9 +73,11 @@ struct StatusTab: View {
         }
     }
 
-    private var state: (text: LocalizedStringKey, tone: String) {
+    /// The network's state; nothing before the first check has started
+    private var state: (text: LocalizedStringKey, tone: String)? {
         if model.error != nil { return ("Error", "danger") }
-        return diagnostics == nil ? ("Checking", "warning") : ("Live", "success")
+        if diagnostics != nil { return ("Live", "success") }
+        return model.checking ? ("Checking", "warning") : nil
     }
 
     @ViewBuilder private var networkSection: some View {
@@ -78,7 +88,7 @@ struct StatusTab: View {
             HStack {
                 Text("Stacks network")
                 Spacer()
-                Text(state.text).foregroundStyle(.brand(state.tone))
+                if let state { Text(state.text).foregroundStyle(.brand(state.tone)) }
             }
         }
     }
diff --git a/apps/blaze-ios/BlazeWallet/Tokens/SendSheet.swift b/apps/blaze-ios/BlazeWallet/Tokens/SendSheet.swift
index beec1fc..ba733c5 100644
--- a/apps/blaze-ios/BlazeWallet/Tokens/SendSheet.swift
+++ b/apps/blaze-ios/BlazeWallet/Tokens/SendSheet.swift
@@ -20,6 +20,8 @@ struct SendSheet: View {
     @State private var txid: String?
     @State private var busy = false
     @State private var error: Error?
+    /// The explorer page open inside the app
+    @State private var page: URL?
     private let hiro = Hiro()
 
     var body: some View {
@@ -33,17 +35,27 @@ struct SendSheet: View {
             .navigationBarTitleDisplayMode(.inline)
             .toolbar {
                 if txid == nil {
-                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
+                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
                 }
             }
-            .interactiveDismissDisabled(busy)
+            // A signed send stays on screen until it's sent or the person chooses Cancel
+            .interactiveDismissDisabled(busy || (signed != nil && txid == nil))
+            // Links open inside the app: leaving for Safari would lock the wallet and lose the signed send
+            .environment(\.openURL, OpenURLAction { url in
+                page = url
+                return .handled
+            })
+            .sheet(isPresented: Binding(get: { page != nil }, set: { if !$0 { page = nil } })) {
+                if let page { SafariView(url: page).ignoresSafeArea().privacyCover() }
+            }
         }
     }
 
     @ViewBuilder private var form: some View {
         Section("Recipient") {
             TextField(text: $recipient, prompt: Text(verbatim: "SP…")) { EmptyView() }
-                .textInputAutocapitalization(.characters)
+                // Contract names are case-sensitive: capitalizing one changes the address
+                .textInputAutocapitalization(.never)
                 .autocorrectionDisabled()
                 .monoFont(.callout)
         }
@@ -53,7 +65,7 @@ struct SendSheet: View {
                     .keyboardType(.decimalPad)
                     .monoFont(.body)
                 Button("Max") {
-                    amount = Amount.editable(max(row.standard, 0), decimals: row.meta?.decimals ?? 0, locale: .current)
+                    if let meta = row.meta { amount = Amount.editable(max(row.standard, 0), decimals: meta.decimals, locale: .current) }
                 }
                 .buttonStyle(.bordered)
             }
@@ -100,12 +112,19 @@ struct SendSheet: View {
             if let signed {
                 // It may be on the network even though no answer came back: the explorer shows whether it is
                 if error != nil {
+                    Text("It may have gone through already. Check the explorer before you send again.")
+                        .brandFont(.footnote)
+                        .foregroundStyle(.brand("ink-muted"))
                     Link(destination: Format.explorer(signed.txid)) {
                         Label("View on explorer", systemImage: "arrow.up.right.square")
                     }
                 }
             } else {
-                Button("Back") { self.review = nil }.disabled(busy)
+                Button("Back") {
+                    error = nil
+                    self.review = nil
+                }
+                .disabled(busy)
             }
         }
     }
@@ -123,6 +142,8 @@ struct SendSheet: View {
     }
 
     private func check() async {
+        // A second tap before the first one's state reaches the screen
+        guard !busy else { return }
         error = nil
         busy = true
         defer { busy = false }
@@ -137,6 +158,7 @@ struct SendSheet: View {
     }
 
     private func send(_ review: SendReview) async {
+        guard !busy else { return }
         error = nil
         busy = true
         defer { busy = false }
@@ -149,6 +171,8 @@ struct SendSheet: View {
                 transaction = try await Send.sign(review, from: account, hiro: hiro)
                 signed = transaction
             }
+            // Signing waits on the network: if the wallet locked meanwhile, nothing goes out
+            try vault.touch()
             txid = try await Send.broadcast(transaction, hiro: hiro)
         } catch {
             self.error = error
diff --git a/apps/blaze-ios/BlazeWallet/Tokens/TokenRowView.swift b/apps/blaze-ios/BlazeWallet/Tokens/TokenRowView.swift
index 9c7df97..34867ab 100644
--- a/apps/blaze-ios/BlazeWallet/Tokens/TokenRowView.swift
+++ b/apps/blaze-ios/BlazeWallet/Tokens/TokenRowView.swift
@@ -45,12 +45,13 @@ struct TokenRowView: View {
     }
 }
 
-/// The token's image, or its first letter when there's none or it fails to load (as in the extension)
+/// The token's image, or its first letter when there's none or it fails to load (as in the extension). Unlisted tokens
+/// always show the letter: their image address is the token maker's choice, and loading it would tell them who looked.
 struct TokenIcon: View {
     let row: TokenRow
 
     var body: some View {
-        AsyncImage(url: row.meta?.image) { phase in
+        AsyncImage(url: row.listed ? row.meta?.image : nil) { phase in
             if case .success(let image) = phase {
                 image.resizable().scaledToFill()
             } else {
diff --git a/apps/blaze-ios/BlazeWallet/Tokens/TokensModel.swift b/apps/blaze-ios/BlazeWallet/Tokens/TokensModel.swift
index faa8797..8a820cd 100644
--- a/apps/blaze-ios/BlazeWallet/Tokens/TokensModel.swift
+++ b/apps/blaze-ios/BlazeWallet/Tokens/TokensModel.swift
@@ -77,5 +77,7 @@ final class TokensModel {
             lookedUp.formUnion(missing)
         }
         rows = TokenRows.build(sheet: sheet, list: list, lookups: lookups)
+        // Rows are back (the stream recovers on its own): a failed load is no longer the news
+        error = nil
     }
 }
diff --git a/apps/blaze-ios/BlazeWallet/Vault/Keychain.swift b/apps/blaze-ios/BlazeWallet/Vault/Keychain.swift
index 9727d5c..8a7b07a 100644
--- a/apps/blaze-ios/BlazeWallet/Vault/Keychain.swift
+++ b/apps/blaze-ios/BlazeWallet/Vault/Keychain.swift
@@ -9,6 +9,8 @@ enum VaultError: Error, Equatable {
     /// The person dismissed Face ID or the passcode: not an error to show
     case cancelled
     case keychain(OSStatus)
+    /// The saved wallet isn't a wallet this app can read
+    case unreadable
 }
 
 /// The one Keychain item that holds the wallet. Reading it takes Face ID or the passcode (`.userPresence`); it stays
diff --git a/apps/blaze-ios/BlazeWallet/Vault/Vault.swift b/apps/blaze-ios/BlazeWallet/Vault/Vault.swift
index cedcf1f..6be1460 100644
--- a/apps/blaze-ios/BlazeWallet/Vault/Vault.swift
+++ b/apps/blaze-ios/BlazeWallet/Vault/Vault.swift
@@ -17,8 +17,12 @@ final class Vault {
     private(set) var asksOnAppear = true
     /// Why the launch check failed; the root view offers to retry
     private(set) var startError: Error?
+    /// The wallet was there and is gone: iOS deletes it when this iPhone's passcode is turned off. Welcome says so.
+    private(set) var walletRemoved = false
     private var session: Session?
     private var context: LAContext?
+    /// Counts locks, so a Face ID check that ends after one (the app left mid-prompt) unlocks nothing
+    private var locks = 0
 
     /// The unlocked wallet, for views; nil when locked. It lives only in the Session, so locking forgets it.
     var state: WalletState? { try? session?.read() }
@@ -41,19 +45,39 @@ final class Vault {
     func create(name: String, words: String) async throws {
         var state = WalletState()
         try state.addSeedPhrase(name: name, words: words)
+        let locksBefore = locks
         let context = try await Self.authenticate(reason: String(localized: "Create your wallet"))
         try Keychain.add(JSONEncoder().encode(state), context: context)
+        // Saved either way, but if the app left during Face ID the new wallet waits, locked
+        guard locks == locksBefore else {
+            context.invalidate()
+            phase = .locked
+            return
+        }
         begin(state, context)
     }
 
     func unlock() async throws {
+        let locksBefore = locks
         let context = try await Self.authenticate(reason: String(localized: "Unlock your wallet"))
-        let data = try Keychain.read(context: context)
+        guard locks == locksBefore else {
+            context.invalidate()
+            return
+        }
+        let data: Data
         do {
-            begin(try JSONDecoder().decode(WalletState.self, from: data), context)
-        } catch {
-            throw WalletError.unexpected("The saved wallet can't be read: \(error)")
+            data = try Keychain.read(context: context)
+        } catch VaultError.keychain(errSecItemNotFound) {
+            context.invalidate()
+            walletRemoved = true
+            phase = .empty
+            return
         }
+        guard let state = try? JSONDecoder().decode(WalletState.self, from: data) else {
+            context.invalidate()
+            throw VaultError.unreadable
+        }
+        begin(state, context)
     }
 
     /// Changes the wallet, restarts the 15 minutes and saves it. Nothing changes if saving fails.
@@ -74,11 +98,13 @@ final class Vault {
     }
 
     func lockIfIdle() {
-        if session?.isLocked ?? true { lock() }
+        // Only an unlocked wallet that has gone idle: locking again would change what the lock screen does on return
+        if session?.isLocked == true { lock() }
     }
 
     /// Forgets the wallet until the next unlock. `askOnReturn`: the lock screen asks for Face ID by itself.
     func lock(askOnReturn: Bool = false) {
+        locks += 1
         asksOnAppear = askOnReturn
         session = nil
         context?.invalidate()
@@ -88,9 +114,11 @@ final class Vault {
 
     /// A seed phrase's words, after a fresh Face ID check (they go on screen)
     func revealWords(of seedPhraseId: String) async throws -> String {
-        guard let seed = state?.seedPhrases.first(where: { $0.id == seedPhraseId }) else { throw WalletError.seedPhraseNotFound }
         let check = try await Self.authenticate(reason: String(localized: "Show your seed phrase"))
         check.invalidate()
+        // Read after Face ID: if the wallet locked during the prompt, the words stay where they are
+        guard let state else { throw WalletError.locked }
+        guard let seed = state.seedPhrases.first(where: { $0.id == seedPhraseId }) else { throw WalletError.seedPhraseNotFound }
         return seed.phrase
     }
 
@@ -102,6 +130,7 @@ final class Vault {
     }
 
     private func begin(_ state: WalletState, _ context: LAContext) {
+        walletRemoved = false
         session = Session(state: state)
         self.context = context
         phase = .unlocked
diff --git a/apps/blaze-ios/BlazeWallet/Wallet/ReceiveSheet.swift b/apps/blaze-ios/BlazeWallet/Wallet/ReceiveSheet.swift
index 18069ae..862ce67 100644
--- a/apps/blaze-ios/BlazeWallet/Wallet/ReceiveSheet.swift
+++ b/apps/blaze-ios/BlazeWallet/Wallet/ReceiveSheet.swift
@@ -39,12 +39,15 @@ struct ReceiveSheet: View {
         }
     }
 
+    /// One renderer for every redraw
+    private static let renderer = CIContext()
+
     private static func qrCode(_ text: String) -> UIImage? {
         let filter = CIFilter.qrCodeGenerator()
         filter.message = Data(text.utf8)
         filter.correctionLevel = "M"
         guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
-              let image = CIContext().createCGImage(output, from: output.extent) else { return nil }
+              let image = renderer.createCGImage(output, from: output.extent) else { return nil }
         return UIImage(cgImage: image)
     }
 }
diff --git a/apps/blaze-ios/BlazeWallet/Wallet/WalletTab.swift b/apps/blaze-ios/BlazeWallet/Wallet/WalletTab.swift
index 75f0db1..cadfdff 100644
--- a/apps/blaze-ios/BlazeWallet/Wallet/WalletTab.swift
+++ b/apps/blaze-ios/BlazeWallet/Wallet/WalletTab.swift
@@ -118,7 +118,7 @@ struct WalletTab: View {
                 SeedWordsSheet(name: name, words: phrase.split(separator: " ").map(String.init))
             }
         }
-        // Sheets draw above the root's cover: the 24 new words and Show words must never reach a snapshot
+        // Sheets draw above the root's cover: the 24 new words and Show seed phrase must never reach a snapshot
         .privacyCover()
     }
 
@@ -142,7 +142,7 @@ struct WalletTab: View {
     }
 }
 
-/// One seed phrase: its accounts (Use / Active), + Account, Show words and Unlink
+/// One seed phrase: its accounts (Use / Active), + Account, Show seed phrase and Unlink
 private struct SeedPhraseCard: View {
     let seed: SeedPhrase
     let accounts: [Account]
@@ -158,17 +158,27 @@ private struct SeedPhraseCard: View {
             ForEach(accounts) { account in
                 AccountRow(account: account, isActive: account.id == activeAccountId) { use(account) }
             }
-            HStack {
-                Button("+ Account", action: addAccount)
-                Spacer()
-                Button("Show words", action: showWords)
-                Spacer()
-                Button("Unlink", role: .destructive, action: unlink)
+            // In one row when the language fits it, otherwise one under another
+            ViewThatFits {
+                HStack {
+                    actions
+                }
+                VStack(alignment: .leading, spacing: 10) {
+                    actions
+                }
             }
         }
         .buttonStyle(.borderless)
         .padding(.vertical, 4)
     }
+
+    @ViewBuilder private var actions: some View {
+        Button("+ Account", action: addAccount)
+        Spacer()
+        Button("Show seed phrase", action: showWords)
+        Spacer()
+        Button("Unlink", role: .destructive, action: unlink)
+    }
 }
 
 /// "Account N", its short address, and Active or Use
```

- [ ] **Add the new strings to the catalog:** `sh apps/blaze-ios/scripts/sync-strings.sh`. Expected: `Synced 144 lines of keys into BlazeWallet/Localizable.xcstrings`. It adds four keys, and marks "Show words" stale.

- [ ] **Write the four strings' translations** into `/tmp/blaze-review-strings/` (temporary: the catalog keeps them):

`/tmp/blaze-review-strings/ko.json` (Korean):

```json
{
 "It may have gone through already. Check the explorer before you send again.": "이미 처리되었을 수 있습니다. 다시 보내기 전에 탐색기에서 확인하세요.",
 "Show seed phrase": "시드 문구 보기",
 "The wallet saved on this iPhone can't be read.": "이 iPhone에 저장된 지갑을 읽을 수 없습니다.",
 "Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.": "이 iPhone의 암호를 끄면서 지갑이 삭제되었습니다. 시드 문구를 가져와 복원하세요."
}
```

`/tmp/blaze-review-strings/zh-Hans.json` (Simplified Chinese):

```json
{
 "It may have gone through already. Check the explorer before you send again.": "这笔转账可能已经发出。再次发送前，请先在区块浏览器中查看。",
 "Show seed phrase": "显示助记词",
 "The wallet saved on this iPhone can't be read.": "无法读取此 iPhone 上保存的钱包。",
 "Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.": "关闭此 iPhone 的密码后，钱包已被移除。导入你的助记词即可恢复。"
}
```

`/tmp/blaze-review-strings/es.json` (Spanish):

```json
{
 "It may have gone through already. Check the explorer before you send again.": "Puede que ya se haya enviado. Compruébalo en el explorador antes de volver a enviar.",
 "Show seed phrase": "Ver frase semilla",
 "The wallet saved on this iPhone can't be read.": "No se puede leer la billetera guardada en este iPhone.",
 "Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.": "Al desactivar el código de este iPhone se eliminó la billetera. Importa tu frase semilla para restaurarla."
}
```

`/tmp/blaze-review-strings/fr.json` (French):

```json
{
 "It may have gone through already. Check the explorer before you send again.": "Le transfert est peut-être déjà passé. Vérifiez dans l’explorateur avant de renvoyer.",
 "Show seed phrase": "Voir la phrase de récupération",
 "The wallet saved on this iPhone can't be read.": "Impossible de lire le portefeuille enregistré sur cet iPhone.",
 "Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.": "La désactivation du code de cet iPhone a supprimé le portefeuille. Importez votre phrase de récupération pour le restaurer."
}
```

`/tmp/blaze-review-strings/de.json` (German):

```json
{
 "It may have gone through already. Check the explorer before you send again.": "Die Transaktion ist vielleicht schon durchgegangen. Prüfe im Explorer, bevor du erneut sendest.",
 "Show seed phrase": "Seed-Phrase zeigen",
 "The wallet saved on this iPhone can't be read.": "Die auf diesem iPhone gespeicherte Wallet kann nicht gelesen werden.",
 "Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.": "Durch das Ausschalten des Codes dieses iPhone wurde die Wallet entfernt. Importiere deine Seed-Phrase, um sie wiederherzustellen."
}
```

`/tmp/blaze-review-strings/tr.json` (Turkish):

```json
{
 "It may have gone through already. Check the explorer before you send again.": "İşlem zaten gerçekleşmiş olabilir. Yeniden göndermeden önce blok gezgininde kontrol edin.",
 "Show seed phrase": "Kurtarma ifadesini göster",
 "The wallet saved on this iPhone can't be read.": "Bu iPhone'da kayıtlı cüzdan okunamıyor.",
 "Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.": "Bu iPhone'un parolası kapatıldığı için cüzdan kaldırıldı. Geri yüklemek için kurtarma ifadenizi içe aktarın."
}
```

`/tmp/blaze-review-strings/ja.json` (Japanese):

```json
{
 "It may have gone through already. Check the explorer before you send again.": "すでに送金されている可能性があります。もう一度送金する前に、エクスプローラーで確認してください。",
 "Show seed phrase": "シードフレーズを表示",
 "The wallet saved on this iPhone can't be read.": "この iPhone に保存されたウォレットを読み込めません。",
 "Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.": "この iPhone のパスコードをオフにしたため、ウォレットが削除されました。シードフレーズをインポートして復元してください。"
}
```

`/tmp/blaze-review-strings/pt-BR.json` (Brazilian Portuguese):

```json
{
 "It may have gone through already. Check the explorer before you send again.": "Talvez o envio já tenha sido feito. Confira no explorador antes de enviar de novo.",
 "Show seed phrase": "Ver frase de recuperação",
 "The wallet saved on this iPhone can't be read.": "Não é possível ler a carteira salva neste iPhone.",
 "Turning off this iPhone's passcode removed the wallet from it. Import your seed phrase to restore it.": "Desativar o código deste iPhone removeu a carteira. Importe sua frase de recuperação para restaurá-la."
}
```

- [ ] **Import them, sync, and drop the stale key**

```bash
node apps/blaze-ios/scripts/import-translations.mjs /tmp/blaze-review-strings/{ko,zh-Hans,es,fr,de,tr,ja,pt-BR}.json
sh apps/blaze-ios/scripts/sync-strings.sh
node -e 'const fs = require("fs"), path = process.argv[1]; const catalog = JSON.parse(fs.readFileSync(path, "utf8")); for (const [key, entry] of Object.entries(catalog.strings)) if (entry.extractionState === "stale") delete catalog.strings[key]; fs.writeFileSync(path, JSON.stringify(catalog, null, 2) + "\n")' apps/blaze-ios/BlazeWallet/Localizable.xcstrings
node apps/blaze-ios/scripts/check-strings.mjs
sh apps/blaze-ios/scripts/sync-strings.sh
```

Expected:
- `ko: 4 strings`, and the same for each language
- `Synced 144 lines of keys into BlazeWallet/Localizable.xcstrings`
- `All strings are translated into 8 languages`
- `Synced 143 lines of keys into BlazeWallet/Localizable.xcstrings`, and the last sync leaves the catalog unchanged

- [ ] **Build for the simulator**

```bash
cd apps/blaze-ios && xcodegen generate && cd -
xcodebuild -project apps/blaze-ios/BlazeWallet.xcodeproj -scheme BlazeWallet -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/blaze-ios-build -skipPackagePluginValidation build CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:|warning: |BUILD (SUCCEEDED|FAILED)" | grep -v checkouts
```

Expected: `** BUILD SUCCEEDED **`, with no `error:` lines and no `warning:` lines from `BlazeWallet/`.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeWallet
git commit -m "fix(blaze-ios): Plan 3's review: a signed send can't be lost or sent twice, Face ID can't unlock after leaving, a removed wallet says why" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The extension, plan 4's review

What the review found, and the fix for each:
- **The locale check couldn't see 16 keys on the transaction card,** which chose them through variables. A renamed key would have blanked the card.
  - The card names every key outright now.
  - The check fails on any English message the code never asks for by name.
- **Approving after the wallet auto-locked lost the request** (from before this branch). The request was removed before the wallet was kept awake, so the error left a card that could neither approve nor deny. Keeping awake comes first now.
- **Messaging failures** (the background restarted, or its port closed) showed raw English without the "Something went wrong" lead-in. Now they're unexpected errors.
- **Full-width amounts** (`１．５`, typed by a Japanese or Chinese input method) are read as `1.5`.
- **The approval header:** a website's app name can't carry the site's stand-in, and the site is bolded wherever a translation puts `$1`, however many times.
- **Numbers follow Chrome's own language when it's a variant of the page's.** Latin American Spanish (`es-419`) writes `1,234.5` where Spain's writes `1.234,5`. `<html lang>` stays the page's language.

**Files:** Modify `apps/signet/src/background/lib/provider.ts`, `apps/signet/src/shared/context/utils.ts`, `apps/signet/src/tabs/approve.tsx`, `apps/signet/src/shared/tabs/TransferTab.tsx`, `apps/signet/src/shared/approvals/parts/UIComponents.tsx`, `apps/signet/src/shared/approvals/TransactionContent.tsx`, `apps/signet/src/shared/i18n.ts`, `apps/signet/scripts/check-locales.mjs`

- [ ] **Apply the patch.** Save it as `/tmp/plan5-task3.patch`, then run `git apply --check /tmp/plan5-task3.patch && git apply /tmp/plan5-task3.patch`.

```diff
diff --git a/apps/signet/scripts/check-locales.mjs b/apps/signet/scripts/check-locales.mjs
index defee4f..d7dfa5a 100644
--- a/apps/signet/scripts/check-locales.mjs
+++ b/apps/signet/scripts/check-locales.mjs
@@ -5,7 +5,8 @@
  *   - every message fills the same $1…$9 slots as English
  *   - no $word$ pattern anywhere: Chrome reads one as an undefined placeholder and won't load the extension
  *   - extensionDescription is 132 characters or fewer (Chrome's limit, in every language)
- *   - every key the code uses (t, plural, pluralKey, WalletError, and keys in quotes in label tables) exists in English
+ *   - every key the code uses (t, plural, pluralKey, WalletError, and keys in quotes in label tables) exists in English,
+ *     and every English message is one the code visibly uses: a key reached only through a variable can't be checked
  * Run: pnpm --filter signet-signer check:locales (package:store runs it before building)
  */
 import { readFileSync, readdirSync } from "node:fs"
@@ -67,6 +68,11 @@ for (const file of files(join(root, "src"))) {
 for (const key of used) {
   if (!(key in english) && !pluralBases.has(key)) problems.push(`code uses "${key}", which isn't in locales/en`)
 }
+for (const key of Object.keys(english)) {
+  // The manifest's own message
+  if (key === "extensionDescription") continue
+  if (!used.has(key) && !used.has(base(key))) problems.push(`locales/en has "${key}", which the code never asks for by name`)
+}
 
 if (problems.length) {
   console.error(`${problems.join("\n")}\n\n${problems.length} problem${problems.length === 1 ? "" : "s"}`)
diff --git a/apps/signet/src/background/lib/provider.ts b/apps/signet/src/background/lib/provider.ts
index 7f8705b..67f820d 100644
--- a/apps/signet/src/background/lib/provider.ts
+++ b/apps/signet/src/background/lib/provider.ts
@@ -270,9 +270,10 @@ async function handleApproval(message: { action: string; requestId: string; appr
       return { origin: request.origin, method: request.method, params: request.params, unlocked, address: account?.stxAddress ?? null }
     }
     case "decide":
-      pending.delete(message.requestId)
-      // Approving is activity: it keeps the wallet from locking for another 15 minutes
+      // Approving is activity: it keeps the wallet from locking for another 15 minutes. It throws when the wallet has
+      // already locked, so it comes first: the request keeps waiting, to approve after unlocking or to deny.
       if (message.approved) await wallet.keepAwake()
+      pending.delete(message.requestId)
       request.decide(!!message.approved)
       chrome.tabs.sendMessage(request.tabId, { type: "signet-hide-approval", requestId: message.requestId }, { frameId: request.frameId })
       return true
diff --git a/apps/signet/src/shared/approvals/TransactionContent.tsx b/apps/signet/src/shared/approvals/TransactionContent.tsx
index 31619d5..dc3193e 100644
--- a/apps/signet/src/shared/approvals/TransactionContent.tsx
+++ b/apps/signet/src/shared/approvals/TransactionContent.tsx
@@ -21,13 +21,16 @@ const short = (text: string) => (text.length > 16 ? `${text.slice(0, 6)}…${tex
 /** Micro-STX as STX, exactly: an approval never hides part of an amount */
 const stx = (micro: bigint | string | number) => `${formatUnits(BigInt(micro), 6)} STX`
 
-/** Each condition code's sentence, for "you" and for someone else (whole sentences, so word order can change) */
-const FUNGIBLE: Record<FungibleConditionCode, { you: string; they: string }> = {
-  [FungibleConditionCode.Equal]: { you: "pcYouSendExactly", they: "pcTheySendExactly" },
-  [FungibleConditionCode.Greater]: { you: "pcYouSendMoreThan", they: "pcTheySendMoreThan" },
-  [FungibleConditionCode.GreaterEqual]: { you: "pcYouSendAtLeast", they: "pcTheySendAtLeast" },
-  [FungibleConditionCode.Less]: { you: "pcYouSendLessThan", they: "pcTheySendLessThan" },
-  [FungibleConditionCode.LessEqual]: { you: "pcYouSendAtMost", they: "pcTheySendAtMost" },
+/**
+ * Each condition code's sentence, for "you" (`who` is null) and for someone else: whole sentences, so word order can
+ * change. Keys are written out so the locale check sees every one.
+ */
+const FUNGIBLE: Record<FungibleConditionCode, (who: string | null, amount: string) => string> = {
+  [FungibleConditionCode.Equal]: (who, amount) => (who === null ? t("pcYouSendExactly", amount) : t("pcTheySendExactly", who, amount)),
+  [FungibleConditionCode.Greater]: (who, amount) => (who === null ? t("pcYouSendMoreThan", amount) : t("pcTheySendMoreThan", who, amount)),
+  [FungibleConditionCode.GreaterEqual]: (who, amount) => (who === null ? t("pcYouSendAtLeast", amount) : t("pcTheySendAtLeast", who, amount)),
+  [FungibleConditionCode.Less]: (who, amount) => (who === null ? t("pcYouSendLessThan", amount) : t("pcTheySendLessThan", who, amount)),
+  [FungibleConditionCode.LessEqual]: (who, amount) => (who === null ? t("pcYouSendAtMost", amount) : t("pcTheySendAtMost", who, amount)),
 }
 
 /** Who a condition is about: null for the signer ("you"), otherwise an address or contract name */
@@ -41,19 +44,19 @@ function who(principal: PostConditionPrincipalWire, signer: string | null): stri
 /** One post condition as a sentence, e.g. "You send at most 10 STX" */
 function describe(pc: PostConditionWire, signer: string | null) {
   const sender = who(pc.principal, signer)
-  const you = sender === null
-  const fills = (...rest: string[]) => (you ? rest : [sender, ...rest])
   if (pc.conditionType === PostConditionType.STX || pc.conditionType === PostConditionType.Fungible) {
     const amount = pc.conditionType === PostConditionType.STX
       ? stx(pc.amount)
       : t("tokenSmallestUnits", pc.amount.toString(), pc.asset.assetName.content)
-    const keys = FUNGIBLE[pc.conditionCode]
-    return t(you ? keys.you : keys.they, ...fills(amount))
+    return FUNGIBLE[pc.conditionCode](sender, amount)
+  }
+  if (pc.conditionType !== PostConditionType.NonFungible) return t("pcStacking", sender ?? t("pcYou"))
+  const asset = pc.asset.assetName.content
+  const id = Cl.prettyPrint(pc.assetName)
+  if (pc.conditionCode === NonFungibleConditionCode.Sends) {
+    return sender === null ? t("pcYouSendNft", asset, id) : t("pcTheySendNft", sender, asset, id)
   }
-  if (pc.conditionType !== PostConditionType.NonFungible) return t("pcStacking", you ? t("pcYou") : sender)
-  const sends = pc.conditionCode === NonFungibleConditionCode.Sends
-  const key = sends ? (you ? "pcYouSendNft" : "pcTheySendNft") : (you ? "pcYouKeepNft" : "pcTheyKeepNft")
-  return t(key, ...fills(pc.asset.assetName.content, Cl.prettyPrint(pc.assetName)))
+  return sender === null ? t("pcYouKeepNft", asset, id) : t("pcTheyKeepNft", sender, asset, id)
 }
 
 export function TransactionContent({ origin, address, method, params }: {
@@ -68,7 +71,9 @@ export function TransactionContent({ origin, address, method, params }: {
 
   return (
     <div className="w-approval">
-      <RequestHeader level={PermissionLevel.CRITICAL} origin={origin} ask={isTransfer ? "askSendStx" : "askRunTransaction"} />
+      {isTransfer
+        ? <RequestHeader level={PermissionLevel.CRITICAL} origin={origin} ask="askSendStx" />
+        : <RequestHeader level={PermissionLevel.CRITICAL} origin={origin} ask="askRunTransaction" />}
 
       <div className="cx-pane">
         {isTransfer ? (
diff --git a/apps/signet/src/shared/approvals/parts/UIComponents.tsx b/apps/signet/src/shared/approvals/parts/UIComponents.tsx
index 6235510..7cfdbe8 100644
--- a/apps/signet/src/shared/approvals/parts/UIComponents.tsx
+++ b/apps/signet/src/shared/approvals/parts/UIComponents.tsx
@@ -1,7 +1,7 @@
 /**
  * The pieces every approval card shares: the risk pill, the line saying which site asks, and a feature line.
  */
-import type { ReactNode } from 'react';
+import { Fragment, type ReactNode } from 'react';
 import { t } from '~shared/i18n';
 import { PermissionLevel } from './types';
 
@@ -20,11 +20,15 @@ const SITE = '\u0000';
  * bold), and `fills` its other fill-ins ($2…)
  */
 export function RequestHeader({ level, origin, ask, fills = [] }: { level: PermissionLevel; origin: string; ask: string; fills?: (string | number)[] }) {
-  const [before, after] = t(ask, SITE, ...fills).split(SITE);
+  // Fills can come from the website (an app's name): they never carry the stand-in, so only $1 becomes the site
+  const clean = fills.map(fill => (typeof fill === 'string' ? fill.replaceAll(SITE, '') : fill));
+  const parts = t(ask, SITE, ...clean).split(SITE);
   return (
     <>
       <span className={`cx-pill ${RISK[level].pill}`} style={{ alignSelf: 'flex-start' }}>{t(RISK[level].text)}</span>
-      <div className="w-origin">{before}<strong>{origin}</strong>{after}</div>
+      <div className="w-origin">
+        {parts.map((part, i) => <Fragment key={i}>{i > 0 && <strong>{origin}</strong>}{part}</Fragment>)}
+      </div>
     </>
   );
 }
diff --git a/apps/signet/src/shared/context/utils.ts b/apps/signet/src/shared/context/utils.ts
index a0bd833..ef9e625 100644
--- a/apps/signet/src/shared/context/utils.ts
+++ b/apps/signet/src/shared/context/utils.ts
@@ -1,5 +1,5 @@
 import { sendToBackground } from '@plasmohq/messaging'
-import { fromWire } from '~shared/errors'
+import { UnexpectedError, asError, fromWire } from '~shared/errors'
 import { t } from '~shared/i18n'
 import type { HandlerResponse, MessageAction } from './types'
 
@@ -9,7 +9,9 @@ export async function sendMessage<T>(action: MessageAction, data?: any): Promise
     const response = await sendToBackground<{ action: MessageAction, data?: any }, HandlerResponse<T>>({
       name: 'handler',
       body: { action, data }
-    });
+    })
+      // Chrome couldn't reach the background (it restarted, or its port closed): not one of the wallet's worded errors
+      .catch(error => { throw new UnexpectedError(asError(error).message) });
 
     // The background's own errors arrive as keys and are worded here, in this page's language
     if (!response.success) throw fromWire(response.error);
diff --git a/apps/signet/src/shared/i18n.ts b/apps/signet/src/shared/i18n.ts
index eb10c06..7b90aea 100644
--- a/apps/signet/src/shared/i18n.ts
+++ b/apps/signet/src/shared/i18n.ts
@@ -33,11 +33,15 @@ export function pickLanguage(choice: LanguageChoice) {
 }
 
 const choice = readLanguage()
-export const folder: Folder = choice === "auto" ? match(chrome.i18n.getUILanguage()) : choice
-/** For every Intl formatter on the page */
-export const locale = localeOf(folder)
-// Chinese and Japanese draw some shared characters differently: the page says which language it's in
-document.documentElement.lang = locale
+const chromeLanguage = chrome.i18n.getUILanguage()
+export const folder: Folder = choice === "auto" ? match(chromeLanguage) : choice
+/**
+ * For every Intl formatter on the page: Chrome's own language when it's a variant of the page's (Latin American
+ * Spanish writes 1,234.5 where Spain's writes 1.234,5), otherwise the page's language
+ */
+export const locale = chromeLanguage.split("-")[0].toLowerCase() === localeOf(folder).split("-")[0] ? chromeLanguage : localeOf(folder)
+// Chinese and Japanese draw some shared characters differently: the page says which language its text is in
+document.documentElement.lang = localeOf(folder)
 
 /** A message in the page's language, with $1…$9 filled in */
 export const t = (key: string, ...fills: Fill[]) => format(folder, key, fills)
diff --git a/apps/signet/src/shared/tabs/TransferTab.tsx b/apps/signet/src/shared/tabs/TransferTab.tsx
index 42844cf..4d93a44 100644
--- a/apps/signet/src/shared/tabs/TransferTab.tsx
+++ b/apps/signet/src/shared/tabs/TransferTab.tsx
@@ -18,7 +18,8 @@ const LIST_DECIMALS = 6;
 
 /** What someone typed, as raw smallest units, exactly (no floating point): only this language's decimal mark */
 function parseUnits(text: string, decimals: number) {
-  const parts = text.trim().split(decimalMark);
+  // NFKC: a Japanese or Chinese input method in full-width mode types １．５ for 1.5
+  const parts = text.normalize('NFKC').trim().split(decimalMark);
   if (parts.length > 2 || !parts.every(part => /^\d*$/.test(part)) || !parts.some(Boolean)) throw new Error(t('errorAmountLike', `1${decimalMark}5`));
   const [whole, frac = ''] = parts;
   if (frac.length > decimals) throw new Error(plural('errorMaxDecimals', decimals, count(decimals)));
diff --git a/apps/signet/src/tabs/approve.tsx b/apps/signet/src/tabs/approve.tsx
index ab42d13..aad74a4 100644
--- a/apps/signet/src/tabs/approve.tsx
+++ b/apps/signet/src/tabs/approve.tsx
@@ -18,7 +18,7 @@ import "@repo/brand/tokens.css"
 import "@repo/brand/fonts.css"
 import "@repo/brand/components.css"
 import { applySavedTheme } from "~shared/styles/theme"
-import { fromWire } from "~shared/errors"
+import { UnexpectedError, asError, fromWire } from "~shared/errors"
 import { count, plural, t } from "~shared/i18n"
 import { ErrorText } from "~shared/ui"
 import "~shared/styles/style.css"
@@ -78,6 +78,8 @@ function cardFor(details: Details) {
 
 async function ask<T>(action: string, extra: object = {}): Promise<T> {
   const response = await chrome.runtime.sendMessage({ type: "signet-approval", action, requestId, ...extra })
+    // Chrome couldn't reach the background (it restarted, or its port closed): not one of the wallet's worded errors
+    .catch(error => { throw new UnexpectedError(asError(error).message) })
   // The background's own errors arrive as keys and are worded here, in this page's language
   if (!response || response.error) throw fromWire(response?.error)
   return response.result
```

- [ ] **Run the check:** `node apps/signet/scripts/check-locales.mjs`. Expected: `Locales check out: 9 languages, 232 English messages, 223 keys used in the code`.
- [ ] **Commit**

```bash
git add apps/signet
git commit -m "fix(signet): Plan 4's review: every key checked, approving after a lock keeps the request, full-width amounts, regional number formats" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hand-off

- [ ] **Confirm the tree is clean** with `git status`.
- [ ] **Report to Ross.** Both apps are ready for his manual pass. Add these to the passes plans 3, 3b and 4 listed:
  - iPhone:
    - send something, then open "View on explorer": it opens inside the app, and the wallet stays unlocked
    - "+ Account" and "Use" don't ask for Face ID
    - choosing Theme › System follows the phone again
    - the fonts on iOS 18
  - Extension:
    - approve after the wallet auto-locked: the card says it's locked, and after unlocking, Approve and Deny both still work
    - in a Spanish (Latin America) Chrome, amounts read `1,234.5`
