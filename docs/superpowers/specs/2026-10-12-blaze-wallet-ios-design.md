# Blaze Wallet for iOS — Design

Date: 2026-10-12
App: `apps/blaze-ios` (new), a native port of `apps/signet` (Blaze Wallet Chrome extension, v0.4.1)
Status: draft for Ross's review. Scope, structure and testing were approved in conversation; see Decisions at the end

## Summary

A fully native iPhone app, in Swift and SwiftUI, that does what the Blaze Wallet extension's side panel does: hold seed phrases and accounts, show one balance per token across Standard (Stacks) and Blaze (subnets) with USD values, send STX and tokens, and show a Status page. It does not connect to websites. Keys stay on the iPhone in the Keychain, behind Face ID. It ships in nine languages, following `2026-10-12-blaze-wallet-i18n-design.md`.

## Goals

- The same seed phrase gives the same accounts and addresses as the extension.
- Every send is byte-for-byte what `@stacks/transactions` would have built and signed for the same inputs, proven by tests.
- Same backends and the same rules as the extension: balances from Charisma's balance service, tokens checked against Charisma's token list, unknown tokens never guessed.
- Native feel: SwiftUI, SF Symbols, Face ID, pull to refresh, share sheet.
- Nine languages from the first release, with the same wording and rules as the extension (see Languages).

## Non-goals (v1)

- Website connection of any kind: no provider, connect, sign message, order signing or approval screens. Ross finds the usual wallet ⇄ dApp UX bad and will rethink it separately.
- Swap. A native Swap tab comes much later; the tab bar leaves room for it.
- Sending from the Blaze balance (the extension doesn't either; Blaze funds move with Charisma Swap).
- Memos on sends (the extension's send screen has none).
- iPad layout, widgets, push notifications, App Store submission.

## What gets ported

| Extension (side panel) | iOS app |
|---|---|
| Create wallet with a password | Create or import, stored in the Keychain behind Face ID (or the device passcode). No password |
| Unlock with password | Unlock with Face ID |
| New seed phrase: name it, 24 words, "I wrote them down", confirm 3 random words; nothing saved until confirmed | Same |
| Import seed phrase: name + words (the field says "12 or 24 words"; any valid BIP39 length passes), checksum checked | Same |
| Seed phrase names are unique | Same |
| After Generate or Import, a one-button "Create account" step derives the seed's first account | The first account is derived and made active right away (the one-button step is skipped) |
| "+ Account" derives the next account of a seed (next index after the highest) and makes it active | Same |
| Switch the active account ("Use") | Same |
| Unlink a seed phrase (removes it and its accounts; active moves to the first remaining) | Same, with an iOS confirmation |
| Active account card with address and Copy | Same, plus **Receive**: address as a QR code, with Copy and Share (new) |
| Export: an encrypted backup file that opens only with the password | **Show seed phrase** (per seed phrase, behind Face ID). There is no password to open a file with. See Decisions |
| Lock button; auto-lock after 15 idle minutes (only actions count, never reads) | Same, plus lock when the app goes to the background |
| Unlink wallet (removes everything) | Same |
| Theme: System / Light · Bitcoin / Dark · RPG | Same, colours from `@repo/brand` |
| Language: Automatic or one of nine (being added to the extension at the same time) | Follows the phone's language, with no picker in the app. People with 2 or more languages on their iPhone get iOS's own per-app Language row in Settings |
| Tokens: total USD, token count, "N without a price", refresh | Same; refresh is pull to refresh |
| One row per token: Standard + Blaze added up, "X on Blaze" line, USD value | Same; the amount uses SwiftUI's numeric text transition in place of the rolling animation |
| Live balances from the balance service stream | Same, while the Tokens tab is on screen and the app is in the foreground |
| Unlisted tokens collapsed: "not on Charisma's token list, may be scams" | Same |
| Unknown tokens: raw units, not sendable | Same |
| Send: recipient (SP/SM address or contract principal), amount with Max, review (amount, to, "Network fee: set automatically", "Exactly this amount, nothing else" for tokens), send, explorer link | Same, with three fixes. Max fills the exact balance (the extension cuts it to 6 decimals, leaving dust of 8-decimal tokens). The review shows the actual network fee. A send the STX balance can't pay for (fee, plus the amount when sending STX) is stopped at review with the most that can be sent, instead of being rejected by the network |
| Status: Stacks network (block, speed), token list (count, speed), Blaze subnets holding funds, address and auto-lock countdown; checked once per unlock and every 5 minutes while open | Same |

## Structure

```
apps/blaze-ios/
  project.yml              XcodeGen project; the .xcodeproj is generated and git-ignored
  README.md                how to generate, run and test
  BlazeWallet/             the app target (SwiftUI)
    App/                   app entry, root view, lock screen, privacy cover
    Vault/                 Keychain + Face ID storage of the wallet state
    Wallet/                Wallet tab: accounts, seed phrases, settings
    Tokens/                Tokens tab, send, receive
    Status/                Status tab
    Brand/                 generated colour assets, fonts, theme
    Localizable.xcstrings  every string the app shows, in nine languages
    InfoPlist.xcstrings    the Face ID prompt, in nine languages
  BlazeKit/                local Swift package, everything testable with `swift test`
    Sources/StacksKit/     Stacks protocol and crypto, no networking
    Sources/WalletCore/    wallet rules, lock rules, backend clients, balance rows, amounts
    Tests/                 StacksKitTests (with golden vectors), WalletCoreTests
  scripts/brand.mjs        writes Brand/ colours and copies fonts from packages/brand
  scripts/check-strings.mjs  fails when a language is missing or mismatches a string
apps/signet/scripts/ios-vectors.mjs   writes the golden vectors from the extension's own libraries
```

- iOS 18+, Swift 6, SwiftUI with `@Observable` models. Built with Xcode 26.
- Build settings:
  - `project.yml` sets `SWIFT_EMIT_LOC_STRINGS: YES`. Xcode's default and XcodeGen's presets leave it off, and without it SwiftUI text isn't extracted into the String Catalog.
  - BlazeKit's `Package.swift` uses `swift-tools-version: 6.1`, since swift-secp256k1 uses package traits, with platforms `.iOS(.v18), .macOS(.v15)`. `Int128` needs macOS 15 under `swift test`.
- The only third-party dependency is **swift-secp256k1** (21-DOT-DEV, `P256K` product). Everything else is Apple's SDK.
- Bundle id `rocks.charisma.blazewallet`, display name "Blaze Wallet", icon from `apps/signet/src/assets/blaze-flame.svg`.
- `apps/blaze-ios` has no `package.json`, so pnpm and turbo ignore it. Nothing in the JS build changes.

### StacksKit (keys, addresses, transactions)

Pure functions over bytes. It only knows what the wallet needs:

- **Mnemonic**:
  - Generate 24 words (256 bits from `SecRandomCopyBytes`).
  - Validate 12, 15, 18, 21 or 24 English words with their checksum, after the shared seed-word normalization: NFKC (`precomposedStringWithCompatibilityMapping`), Turkish `İ`/`ı` → `i`, lowercase, collapse spaces.
  - Seed via PBKDF2-HMAC-SHA512 (CommonCrypto).
- **HD keys**: BIP32 private derivation (HMAC-SHA512 from CryptoKit, private key tweak-add from P256K) on `m/44'/5757'/0'/0/{index}`, the path `@stacks/wallet-sdk` uses.
- **Hashes CryptoKit lacks**: RIPEMD-160 and SHA-512/256, small implementations checked against their official test vectors.
- **Addresses**: c32check encode and decode. Mainnet single-sig `SP…` from the compressed public key; decode accepts `SP` and `SM` and rejects bad checksums.
- **Clarity values** (only these): uint, standard and contract principal, and `none` for serializing; uint and `(ok uint)` for deserializing (subnet `get-balance`).
- **Transactions** (only these): mainnet, standard single-sig auth, compressed key, anchor mode any.
  - STX transfer: recipient (standard or contract principal), amount, empty memo, post condition mode deny, no post conditions.
  - SIP-010 `transfer(amount, sender, recipient, none)`: post condition mode deny, one fungible post condition "sender sends exactly `amount` of `contract::asset`".
  - Signing: sighash and presign hash as `@stacks/transactions` does, a recoverable ECDSA signature (RFC 6979, low-S) from P256K over the raw 32-byte hash, encoded as recovery id + r + s.
  - Outputs: serialized hex, txid, and the payload hex plus estimated length that fee estimation needs.

### WalletCore (rules and backends)

- **Wallet state**: the extension's shape. Seed phrases `{id, name, phrase, createdAt}`, accounts `{id, name, index, seedPhraseId, stxAddress, privateKey, publicKey, createdAt}`, `activeAccountId`. The same rules as `apps/signet/src/background/lib/wallet/storage.ts`: unique seed names, a new account becomes the active one (the extension's screens always ask for that), unlinking a seed removes its accounts and moves active to the first remaining. Accounts are named "Account N" (N = index + 1).
- **Lock rules (Session)**: holds the unlocked state and the time of the last action, with an injected clock. Locked → every key read throws "Wallet is locked". 15 minutes after the last action it locks. Actions (create, import, add account, switch, unlink, send) extend it; reads don't. `lock()` drops everything held in memory.
- **Errors are typed**: WalletCore throws a `WalletError` enum. Each case carries what the message needs: service and status, fee and balance, the token's symbol. WalletCore holds no user-facing text; the app's String Catalog words each case. Text written by a server or library travels as the `.unexpected(message)` case and shows after a translated lead-in.
- **Backends**: async clients over `URLSession`, `Codable` responses, and a descriptive error on every failure (endpoint and status). No fallbacks or cached guesses. A request that fails throws, and the screen shows it. The only exceptions are the extension's own, where one bad item must not blank the whole screen. The first three are logged with `os.Logger`:
  - a sheet token whose `ready` is null is left out of the rows
  - a failed one-token lookup makes that token unknown
  - a failed subnet read leaves that subnet out of Status's "Holding your funds"
  - the live balance stream reconnects quietly (see the table), and the balances it last delivered stay on screen meanwhile

| What | Request | Notes |
|---|---|---|
| Balance sheet | `GET https://swap.charisma.rocks/api/v1/balances/{address}/sheet` | blaze-sdk `BalanceSheet` shape |
| Live balances | `GET …/balances/{address}/stream` (server-sent events) | Each `sheet` event rebuilds the rows. `problem` events are ignored, as in the extension. Drops reconnect quietly like blaze-sdk `watchBalances`: 1 s, doubling to 30 s on errors, about 1 s after a clean close |
| Token list | `GET https://tokens.charisma.rocks/api/v1/sip10` | Empty or failed → "Charisma's token list is unavailable, so tokens can't be checked against the block list" |
| One token | `GET https://tokens.charisma.rocks/api/v1/sip10/{contractId}` | Only for tokens not on the list. Missing symbol or decimals → unknown token |
| USD prices | `GET https://lakehouse.charisma.rocks/api/token-prices?limit=1000` | Loaded separately. If it fails, balances still show, with "Prices unavailable: …" |
| Nonce | `GET https://api.hiro.so/extended/v1/address/{address}/nonces` | `possible_next_nonce`. Failure throws. This is intentional: `@stacks/transactions` quietly retries `/v2/accounts`, and the app doesn't (no fallbacks) |
| Fee | `POST https://api.hiro.so/v2/fees/transaction` `{transaction_payload, estimated_len}` | `estimations[1].fee`. When Hiro answers `NoEstimateAvailable`: `GET /v2/fees/transfer` (rate) × transaction length. This is exactly what `@stacks/transactions` does (same in 7.3.1 and 7.6.0) |
| Broadcast | `POST https://api.hiro.so/v2/transactions` `{tx}` | Success is the quoted txid. Rejection → "The network rejected the transfer: {reason or error}" |
| Network check | `GET https://api.hiro.so/v2/info` | `stacks_tip_height` and timing |
| Subnet balance | `POST https://api.hiro.so/v2/contracts/call-read/{address}/{name}/get-balance` | Every token-list entry with type `SUBNET`, 4 at a time, kept for a minute. Base `stx` means STX |

All Hiro calls retry on 429: wait for `Retry-After`, otherwise 1 s, 2 s, 4 s, then give up (as `apps/signet/src/background/lib/hiro.ts`).

- **Balance rows**: port of `getWalletBalances`.
  - Each sheet entry with `base` adds its `ready` amount to that base token's Blaze total; the rest add to the Standard total.
  - Rows with both totals zero are dropped, except STX.
  - A token is listed when it's on the token list.
  - Each row carries `asset`, the asset name the send's post condition needs. It's the token list's `identifier` (for example `charisma` for charisma-token), `""` for STX. A listed token without an `identifier` isn't sendable ("Charisma's token list has no asset name for {symbol}"). The extension would build that send with `""`, which isn't a valid asset name. Every list entry has one today.
  - Order: STX (`.stx`) first, then tokens with a Standard balance, then tokens held only on Blaze, each group by contract id. That's the grouping the extension shows today (it keeps the balance service's order, with subnet-only rows at the end). Sorting explicitly keeps rows in place across refreshes and live updates, since a decoded dictionary has no order.
- **Amounts**: smallest units are `Int128` (Swift 6, iOS 18), never floating point. Negatives are allowed, because instant balances can dip below zero.
  - **Locale.** Functions take a `Locale`, and the app passes `Locale.current`: the phone's language plus its region, which is also what the decimal keypad types.
  - **Parsing.** Only that locale's decimal mark is accepted (`1,5` in German, `1.5` in Japanese), with no grouping marks and at most `decimals` places. Otherwise "Enter an amount like 1,5", written with the locale's mark.
  - **Display.** The locale's grouping and decimal mark, and a minus for negatives. Precision depends on the screen, as in the extension:
    - token list: cut (not rounded) to at most 6 decimals
    - Status subnet balances: rounded to 4
    - send review: exact, every decimal
  - **Max** writes the exact balance with the locale's decimal mark and no grouping, so it parses back unchanged.
  - **USD** shows in the locale's currency format, with 4 decimals under $1, else 2.
- **Send**:
  - **Review**: validate the recipient (the extension's pattern, then c32 decode) and the amount (> 0, ≤ the Standard balance). Then estimate the fee from the payload and estimated length; no nonce is needed yet. The fee must fit the Standard STX balance, plus the amount when sending STX. Otherwise review stops with "Not enough STX for the network fee":
    - sending STX: it shows the most that can be sent (balance − fee), with a button that uses it
    - sending a token: it shows the fee and the STX balance
  - **Send**: fetch the nonce, build with the reviewed fee, sign, broadcast and return the txid.

### Vault (app target)

- One Keychain generic-password item holds the wallet state as JSON. Access: `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` with `.userPresence` (Face ID, or the device passcode). It's never in backups and never moves to another device; a new phone means importing the seed phrase again.
- No passcode set on the iPhone → creating fails with "Set a passcode on this iPhone to use Blaze Wallet".
- One `LAContext` per unlocked session. Lock invalidates it.
  - **Create**, the end of Welcome's create or import: the context is evaluated (Face ID), the item is added with it, and the Session starts with it.
  - **Unlock**: the context is evaluated, then the item is read with it.
  - While unlocked, the state lives in the Session and every write reuses the same context, so adding an account or switching never asks for Face ID again.
  - The one exception: **Show seed phrase** always asks for Face ID once more, with a fresh context, because it puts the words on screen.
- Checking whether a wallet exists (launch, root view) reads the item's attributes only, with interaction not allowed, so it never asks for Face ID:
  - `errSecItemNotFound` → no wallet (Welcome)
  - success or `errSecInteractionNotAllowed` → a wallet exists (Lock screen)
  - any other status throws, naming the status
- The app locks on the 15-minute rule and whenever it goes to the background. While it's inactive (app switcher, Control Centre) a cover hides the screen, so snapshots never show balances or words.
- The Keychain survives deleting the app. On the first launch of a fresh install (no marker in `UserDefaults`), any leftover wallet item is deleted. Deleting the app removes the wallet, as removing the extension does.
- `NSFaceIDUsageDescription`: "Blaze Wallet uses Face ID to unlock your wallet."

### Screens

- **Root**: no wallet → Welcome (Create a new wallet / Import a seed phrase). Wallet but locked → Lock screen, which asks for Face ID on appear and has an Unlock button. Unlocked with an active account → tabs **Wallet, Tokens, Status**, with Lock in the toolbar. Unlocked without an active account (every seed unlinked) → only the Wallet tab, showing "No active account" with Generate new / Import, as the extension does.
- **Wallet**: active account (name, address, Copy, Receive). Seed phrases, each with its accounts (Use / Active), + Account, Show seed phrase, Unlink. Generate new / Import. A Vault section: "Keys: on this iPhone only, behind Face ID", "Auto-lock: after 15 idle minutes", Theme, Lock, Unlink wallet.
- **Seed words** (import, and the confirmation step of a new seed phrase): fields use the ASCII-capable keyboard with autocapitalization and autocorrection off. Answers are compared after the shared seed-word normalization, so a pasted `İ` or full-width word still matches.
- **Tokens**: total value card, token rows, unlisted section. Tapping a sendable row opens Send as a sheet (form → review → sent, with "View on explorer" → `https://explorer.hiro.so/txid/0x{txid}?chain=mainnet`). The send form shows the extension's note when the token also has a Blaze balance. Blaze-only, unlisted and unknown tokens aren't sendable, and say why.
- **Status**: the four cards from the extension, with Check again.
- **Brand**:
  - `scripts/brand.mjs` turns `packages/brand/tokens.json` colours into an asset catalog, with light and dark values per token. It resolves alias values such as `{accent-soft}`. It copies only DM Mono and Ysabeau Infant, not Matter, until Decision 2 is settled.
  - Its output in `BlazeWallet/Brand/` is committed, so opening the project needs no Node. Re-run the script when `tokens.json` changes.
  - The Theme setting maps to `preferredColorScheme`.
  - Fonts: DM Mono for numbers and addresses, Ysabeau Infant for Dark. For Light, see Decisions.
  - Icons are SF Symbols.
  - App icon: a 1024×1024 opaque PNG, rendered once from `blaze-flame.svg` and committed: the flame centred on the Dark `bg` colour (`#0b0606`).

## Languages

The app follows the shared rules in `2026-10-12-blaze-wallet-i18n-design.md`: the nine languages, what is and isn't translated, numbers, seed-word entry, the wallet terms list, plurals, fonts. iOS specifics:

- **Strings.**
  - Every string the app shows lives in `Localizable.xcstrings`. SwiftUI `Text` literals are extracted into it automatically, and strings built in code use `String(localized:)`.
  - Plurals use the catalog's plural variations.
  - The Face ID prompt (`NSFaceIDUsageDescription`) is in `InfoPlist.xcstrings`.
  - The display name stays "Blaze Wallet".
  - The `WalletError` cases are worded here too, so there is one catalog to translate and check.
- **Apple's words.** Strings that name Face ID, the passcode or Settings use Apple's own term in each language.
- **No language picker.** The app follows the phone's language through Apple's own matching (`Bundle.preferredLocalizations`). A phone set to Traditional Chinese gets English.
  - People with 2 or more preferred languages also get iOS's own per-app Language row on Blaze Wallet's page in Settings.
  - Changing the language there relaunches the app. The Keychain item is untouched, so the wallet is just locked.
- **Formatting.** Every amount, USD value and time uses `Locale.current`. WalletCore functions take the `Locale` as a parameter, so tests can pass any language and region.
- **Fonts.** For Korean, Japanese and Chinese, CoreText falls back from the brand fonts to the system's fonts automatically.
- **Check.** `scripts/check-strings.mjs` (Node, no dependencies) reads both catalogs. It fails when any key is missing a language, isn't marked translated, is empty, or has format specifiers (`%@`, `%lld`) that differ from English.

## Errors

Every backend or vault call either returns real data or throws an error that names what failed ("Couldn't load balances (503)"). Each screen shows the message where the action happened, in the active language, with a way to retry. No placeholders, mock data or silent defaults. A token icon that fails to load shows the token's first letter, as in the extension.

## Testing

- **Golden vectors**: `apps/signet/scripts/ios-vectors.mjs` runs the extension's own `@stacks/wallet-sdk` and `@stacks/transactions`, at the versions `pnpm-lock.yaml` gives `apps/signet` (`@stacks/transactions` 7.6.0 today), and checks those versions itself. Plan 1, Task 1 shows how to run it without `pnpm install` rewriting the lockfile. It writes `BlazeKit/Tests/StacksKitTests/vectors.json`, committed so `swift test` doesn't need Node. It covers:
  - a 12-word and a 24-word phrase → private key, public key and address for accounts 0–4
  - STX and SIP-010 transfers, each to a standard and to a contract principal, with fixed nonce and fee → payload hex, estimated length, signed hex and txid
  - c32 decode of `SP` and `SM` addresses
  - Clarity hex for a principal argument and for `u…` and `(ok u…)` results

  StacksKit must match every byte.
- **StacksKit unit tests**: RIPEMD-160 and SHA-512/256 official vectors; bad checksum word, wrong word count, malformed or bad-checksum addresses → errors, never a signature.
- **WalletCore unit tests**:
  - wallet state rules
  - Session: locked refuses keys, 15-minute idle lock, actions extend it, reads don't, `lock()` clears
  - balance rows from a sheet: totals, order, `asset`, sendability
  - send review: fee fits or not, the most that can be sent, a missing asset name
  - amount parsing and formatting in `en_US`, `de_DE`, `tr_TR` and `ja_JP`: `1,5` accepted in German and rejected in Japanese, grouping rejected, the token list cut while review is exact, Max round-trips
- **StacksKit normalization tests**: `İ`, `ı` and full-width input normalize into valid words.
- **Strings check**: `node apps/blaze-ios/scripts/check-strings.mjs` passes.
- **Two commands, no simulator needed:**
  - `swift test` in `apps/blaze-ios/BlazeKit` runs every Swift test above.
  - `node apps/blaze-ios/scripts/check-strings.mjs` runs the strings check.
- **Manual, once, by Ross**: import a seed already used in the extension and compare addresses; send 1 STX and a small amount of one token between his own accounts and check both land; Face ID unlock, background lock and the privacy cover on a real iPhone; fonts render on the iOS 18 simulator (CoreText loads the woff2 files on macOS 26, still to confirm on iOS 18).
- SwiftUI screens get a manual pass in the simulator, in English, German (longest text) and Japanese (system fonts), using the scheme's App Language option. No UI tests in v1.

## Decisions for Ross

1. **Export → Show seed phrase.** The extension's Export is an encrypted file that opens only with the wallet password, and the iOS app has no password. Recommended: replace it with Show seed phrase behind Face ID, since the words are the real backup and work in any Stacks wallet.
2. **Matter font in Light.** Matter is a commercial font (Displaay), and web licences often don't cover apps. If Ross's licence covers apps, bundle it. Until then Light uses SF Pro, the next font in the brand's own Light stack (`"Matter", -apple-system, …`).
3. **Apple team.** The simulator needs nothing. Running on Ross's iPhone needs his Apple Developer team ID in `project.yml`.

## Later

- Native Swap tab (Charisma swap features in the app).
- A better-than-usual way for websites to ask for signatures (not the traditional connect flow).
- App Store or TestFlight distribution. App Store rules require wallets to be published from an organization developer account.
