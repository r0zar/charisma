# Blaze Wallet iOS, Plan 1: StacksKit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build StacksKit, the Swift package that turns seed phrases into Stacks accounts and signs STX and SIP-010 transfers byte-for-byte as the Blaze Wallet extension's libraries do.

**Architecture:** A local Swift package, `apps/blaze-ios/BlazeKit`, whose first target is `StacksKit`. It holds pure functions over bytes and does no networking. One dependency, swift-secp256k1 (`P256K`), handles the secp256k1 maths. RIPEMD-160 and SHA-512/256 are written here because CryptoKit lacks them. A Node script in `apps/signet` runs the extension's own `@stacks/*` libraries to write golden vectors that every StacksKit test checks against.

**Tech Stack:** Swift 6 (tools 6.1), Swift Testing, CryptoKit, CommonCrypto, swift-secp256k1 0.23.2, Node with `@stacks/transactions` 7.6.0, `@stacks/wallet-sdk` 7.1.2 and `@scure/bip39` 1.6.0 (pnpm-lock versions for `apps/signet`).

**Spec:** `docs/superpowers/specs/2026-10-12-blaze-wallet-ios-design.md`, sections "StacksKit" and "Testing". Also `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md`, section "Seed word entry".

**Baseline:** main at `c451b657`. Branch: `feat/blaze-ios`.

**Plans after this one:** 2 WalletCore (rules, amounts, backends), 3 the iOS app (vault, screens, brand, strings), 4 extension translations.

---

## Working notes for every task

- Every file in this plan was compiled and tested before the plan was written. With the extension's libraries at the locked versions, the suite passes: 23 tests in 7 suites. Copy the code exactly. If a vector test fails, the bug is in the Swift, never in the vectors.
- Run every command from the repo root. Swift commands take `--package-path apps/blaze-ios/BlazeKit`, so `git add` paths stay relative to the root. The first `swift test` downloads swift-secp256k1, which takes a minute or two.
- Files that import both CryptoKit and P256K must write `CryptoKit.SHA256`, `CryptoKit.HMAC` and so on, because P256K defines its own `SHA256`. The code below already does.
- No mock data and no fallbacks. StacksKit has no user-facing text: it throws `StacksError` cases, and the app words them (plan 3).
- Building is part of this work: `swift test` builds the package. It doesn't touch any of the JS apps or their dev servers.
- Commit after every task, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

| File | Responsibility |
|---|---|
| `apps/signet/scripts/ios-vectors.mjs` | Runs the extension's libraries and writes the golden vectors plus the BIP39 word list for Swift |
| `apps/blaze-ios/.gitignore` | Keeps SwiftPM build output out of git |
| `apps/blaze-ios/BlazeKit/Package.swift` | The package: platforms, the P256K dependency, the StacksKit target and its tests |
| `Sources/StacksKit/BIP39English.swift` | Generated: the 2048 English words |
| `Sources/StacksKit/StacksError.swift` | Every way StacksKit refuses input |
| `Sources/StacksKit/Bytes.swift` | Hex, big-endian bytes, a bounds-checked byte reader |
| `Sources/StacksKit/SHA512_256.swift`, `RIPEMD160.swift`, `Hashing.swift` | The hashes; `Hashing` has sha256 and hash160 |
| `Sources/StacksKit/C32.swift`, `Address.swift` | c32 encoding; `StacksAddress` and `Principal` |
| `Sources/StacksKit/Mnemonic.swift` | Seed phrases: normalize, generate, validate, seed |
| `Sources/StacksKit/HDKey.swift`, `AccountKeys.swift` | BIP32 derivation, and one account's keys and address |
| `Sources/StacksKit/Clarity.swift` | The few Clarity values the wallet writes and reads |
| `Sources/StacksKit/Transaction.swift` | STX and SIP-010 transfers: serialize, presign hash, sign, txid |
| `Tests/StacksKitTests/vectors.json` | Generated golden vectors |
| `Tests/StacksKitTests/*.swift` | One test file per source area, plus `Vectors.swift`, which loads the JSON |

(`Sources/…` and `Tests/…` are inside `apps/blaze-ios/BlazeKit`.)

---

### Task 1: Golden vectors from the extension's libraries

**Files:**
- Create: `apps/signet/scripts/ios-vectors.mjs`
- Create: `apps/blaze-ios/.gitignore`
- Generated: `apps/blaze-ios/BlazeKit/Tests/StacksKitTests/vectors.json`, `apps/blaze-ios/BlazeKit/Sources/StacksKit/BIP39English.swift`

- [ ] **Create the branch**

```bash
git checkout -b feat/blaze-ios
```

- [ ] **Write the vectors script**

```js
/**
 * Golden test vectors for the iOS app's StacksKit, made with the extension's own libraries (@stacks/wallet-sdk,
 * @stacks/transactions, @scure/bip39) at the versions pnpm-lock.yaml gives apps/signet. StacksKit must match every byte.
 *
 * Run from the repo root: node apps/signet/scripts/ios-vectors.mjs
 * It needs @stacks/transactions 7.6.0, @stacks/wallet-sdk 7.1.2, @stacks/network 7.6.0 and @scure/bip39 1.6.0 to
 * resolve from apps/signet (its own node_modules, or a throwaway install linked there).
 * Writes two committed files:
 *   apps/blaze-ios/BlazeKit/Tests/StacksKitTests/vectors.json
 *   apps/blaze-ios/BlazeKit/Sources/StacksKit/BIP39English.swift
 * The seed phrases are public BIP39 test phrases: never send funds to their addresses.
 */
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { mnemonicToSeedSync } from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english"
import { STACKS_MAINNET } from "@stacks/network"
import {
  AuthType,
  Cl,
  Pc,
  addressFromVersionHash,
  addressToString,
  createAddress,
  estimateTransactionByteLength,
  makeContractCall,
  makeSTXTokenTransfer,
  privateKeyToPublic,
  serializePayload,
  sigHashPreSign
} from "@stacks/transactions"
import { generateNewAccount, generateWallet, getStxAddress } from "@stacks/wallet-sdk"

const kit = join(dirname(fileURLToPath(import.meta.url)), "../../blaze-ios/BlazeKit")

const PHRASES = [
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"
]

/** Accounts 0–4 of a phrase, exactly as the extension creates them (background/lib/wallet/seed.ts) */
async function accountsOf(phrase) {
  let wallet = await generateWallet({ secretKey: phrase, password: "" })
  while (wallet.accounts.length < 5) wallet = generateNewAccount(wallet)
  return wallet.accounts.map(account => ({
    index: account.index,
    privateKey: account.stxPrivateKey,
    publicKey: privateKeyToPublic(account.stxPrivateKey),
    address: getStxAddress(account, STACKS_MAINNET)
  }))
}

const phrases = []
for (const phrase of PHRASES) {
  phrases.push({ phrase, seed: Buffer.from(mnemonicToSeedSync(phrase)).toString("hex"), accounts: await accountsOf(phrase) })
}

const sender = phrases[0].accounts[0]
const STANDARD = phrases[0].accounts[1].address
const CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2"
const TOKEN = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"
const ASSET = "charisma"
const NONCE = 7n
const FEE = 180n

/** Everything StacksKit has to reproduce for one transaction, intermediate hashes included for debugging */
function vector(name, fields, tx) {
  const sighash = tx.signBegin()
  return {
    name,
    ...fields,
    senderKey: sender.privateKey,
    nonce: NONCE.toString(),
    fee: FEE.toString(),
    payload: serializePayload(tx.payload),
    estimatedLength: estimateTransactionByteLength(tx),
    sighash,
    presign: sigHashPreSign(sighash, AuthType.Standard, FEE, NONCE),
    serialized: tx.serialize(),
    txid: tx.txid()
  }
}

/** As background/lib/tokens.ts sendToken builds an STX send */
async function stxTransfer(name, recipient, amount) {
  const tx = await makeSTXTokenTransfer({ recipient, amount, memo: "", senderKey: sender.privateKey, network: "mainnet", nonce: NONCE, fee: FEE })
  return vector(name, { kind: "stx", recipient, amount: amount.toString() }, tx)
}

/** As background/lib/tokens.ts sendToken builds a SIP-010 send */
async function sip10Transfer(name, recipient, amount) {
  const [contractAddress, contractName] = TOKEN.split(".")
  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName: "transfer",
    functionArgs: [Cl.uint(amount), Cl.principal(sender.address), Cl.principal(recipient), Cl.none()],
    postConditions: [Pc.principal(sender.address).willSendEq(amount).ft(TOKEN, ASSET)],
    postConditionMode: "deny",
    senderKey: sender.privateKey,
    network: "mainnet",
    nonce: NONCE,
    fee: FEE
  })
  return vector(name, { kind: "sip10", contract: TOKEN, asset: ASSET, recipient, amount: amount.toString() }, tx)
}

const transactions = [
  await stxTransfer("stx-to-standard", STANDARD, 1_000_000n),
  await stxTransfer("stx-to-contract", CONTRACT, 2_500_000n),
  await sip10Transfer("sip10-to-standard", STANDARD, 123_456_789n),
  await sip10Transfer("sip10-to-contract", CONTRACT, 42n)
]

const addresses = [
  "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
  addressToString(addressFromVersionHash(20, "a46ff88886c2ef9762d970b4d2c63678835bd39d")),
  addressToString(addressFromVersionHash(22, "0000000000000000000000000000000000000000"))
].map(address => {
  const { version, hash160 } = createAddress(address)
  return { address, version, hash160 }
})

const UINT_MAX = 2n ** 128n - 1n
const clarity = [
  { name: "uint", hex: Cl.serialize(Cl.uint(123_456_789n)), value: "123456789" },
  { name: "uint-max", hex: Cl.serialize(Cl.uint(UINT_MAX)), value: UINT_MAX.toString() },
  { name: "ok-uint", hex: Cl.serialize(Cl.ok(Cl.uint(42n))), value: "42" },
  { name: "none", hex: Cl.serialize(Cl.none()) },
  { name: "principal-standard", hex: Cl.serialize(Cl.principal(sender.address)), value: sender.address },
  { name: "principal-contract", hex: Cl.serialize(Cl.principal(CONTRACT)), value: CONTRACT }
]

writeFileSync(join(kit, "Tests/StacksKitTests/vectors.json"), `${JSON.stringify({ phrases, transactions, addresses, clarity }, null, 2)}\n`)
writeFileSync(
  join(kit, "Sources/StacksKit/BIP39English.swift"),
  "// Generated by apps/signet/scripts/ios-vectors.mjs from @scure/bip39's English list. Don't edit by hand.\n\n" +
    "/// The 2048 BIP39 English words, in order\n" +
    `let bip39English: [String] = [\n${wordlist.map(word => `    "${word}",`).join("\n")}\n]\n`
)
console.log(`Wrote ${phrases.length} phrases, ${transactions.length} transactions, ${addresses.length} addresses, ${clarity.length} Clarity values, ${wordlist.length} words`)
```

- [ ] **Ignore SwiftPM output**

```gitignore
# SwiftPM build output
BlazeKit/.build/
BlazeKit/.swiftpm/
```

Save as `apps/blaze-ios/.gitignore`.

- [ ] **Make the extension's libraries resolvable from `apps/signet`, then run the script**

Don't run `pnpm install` in the repo for this. The repo pins pnpm 10.5.2 but Ross's machine has pnpm 9.15.0, which rewrites `pnpm-lock.yaml` on install. So if `apps/signet/node_modules` doesn't exist, install the four locked versions into a throwaway folder and link it there for the run:

```bash
mkdir -p apps/blaze-ios/BlazeKit/Tests/StacksKitTests apps/blaze-ios/BlazeKit/Sources/StacksKit
if [ -e apps/signet/node_modules ]; then
  echo "Using the existing apps/signet/node_modules"
else
  VEC=$(mktemp -d)
  (cd "$VEC" && pnpm init >/dev/null && pnpm add --ignore-scripts @stacks/transactions@7.6.0 @stacks/wallet-sdk@7.1.2 @stacks/network@7.6.0 @scure/bip39@1.6.0)
  ln -s "$VEC/node_modules" apps/signet/node_modules && LINKED=1
fi
for p in @stacks/transactions @stacks/wallet-sdk @stacks/network @scure/bip39; do printf "%s " $p; node -p "require('./apps/signet/node_modules/$p/package.json').version"; done
node apps/signet/scripts/ios-vectors.mjs
[ -n "$LINKED" ] && rm apps/signet/node_modules
```

Expected:
- the versions print as `7.6.0`, `7.1.2`, `7.6.0` and `1.6.0`
- then `Wrote 2 phrases, 4 transactions, 3 addresses, 6 Clarity values, 2048 words`

If a version differs, stop and tell Ross: the vectors must come from the versions the extension ships.

- [ ] **Spot-check the vectors**

Run: `grep -m1 '"address"' apps/blaze-ios/BlazeKit/Tests/StacksKitTests/vectors.json`
Expected: `"address": "SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J"` (account 0 of the `abandon … about` test phrase).
`git status` must show no change to `pnpm-lock.yaml`, and no `apps/signet/node_modules`.

- [ ] **Commit**

```bash
git add apps/signet/scripts/ios-vectors.mjs apps/blaze-ios/.gitignore apps/blaze-ios/BlazeKit/Tests/StacksKitTests/vectors.json apps/blaze-ios/BlazeKit/Sources/StacksKit/BIP39English.swift docs/superpowers/specs/2026-10-12-blaze-wallet-*.md docs/superpowers/plans/2026-10-12-blaze-ios-*.md
git commit -m "feat(blaze-ios): Specs, plans and golden test vectors from the extension's own Stacks libraries" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The package, errors and bytes

**Files:**
- Create: `apps/blaze-ios/BlazeKit/Package.swift`
- Create: `Sources/StacksKit/StacksError.swift`, `Sources/StacksKit/Bytes.swift`
- Test: `Tests/StacksKitTests/Vectors.swift`, `Tests/StacksKitTests/BytesTests.swift`

- [ ] **Write the package manifest**

```swift
// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "BlazeKit",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "StacksKit", targets: ["StacksKit"]),
    ],
    dependencies: [
        .package(url: "https://github.com/21-DOT-DEV/swift-secp256k1", exact: "0.23.2"),
    ],
    targets: [
        .target(
            name: "StacksKit",
            dependencies: [.product(name: "P256K", package: "swift-secp256k1")]
        ),
        .testTarget(
            name: "StacksKitTests",
            dependencies: ["StacksKit"],
            resources: [.copy("vectors.json")]
        ),
    ]
)
```

- [ ] **Write the vectors loader and the failing tests**

`Tests/StacksKitTests/Vectors.swift`:

```swift
import Foundation

/// vectors.json, written by apps/signet/scripts/ios-vectors.mjs from the extension's own libraries
struct Vectors: Decodable {
    struct Account: Decodable {
        let index: UInt32
        let privateKey: String
        let publicKey: String
        let address: String
    }

    struct Phrase: Decodable {
        let phrase: String
        let seed: String
        let accounts: [Account]
    }

    struct Transaction: Decodable {
        let name: String
        let kind: String
        let contract: String?
        let asset: String?
        let recipient: String
        let amount: String
        let senderKey: String
        let nonce: String
        let fee: String
        let payload: String
        let estimatedLength: Int
        let sighash: String
        let presign: String
        let serialized: String
        let txid: String
    }

    struct Address: Decodable {
        let address: String
        let version: UInt8
        let hash160: String
    }

    struct Clarity: Decodable {
        let name: String
        let hex: String
        let value: String?
    }

    let phrases: [Phrase]
    let transactions: [Transaction]
    let addresses: [Address]
    let clarity: [Clarity]

    static let all: Vectors = {
        let url = Bundle.module.url(forResource: "vectors", withExtension: "json")!
        return try! JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url))
    }()
}
```

`Tests/StacksKitTests/BytesTests.swift`:

```swift
import Foundation
import Testing
@testable import StacksKit

struct BytesTests {
    @Test func hexRoundTripsAndRejectsJunk() throws {
        #expect(try Data(hex: "0x00ff10").hex == "00ff10")
        #expect(try Data(hex: "").isEmpty)
        #expect(throws: StacksError.invalidHex) { try Data(hex: "abc") }
        #expect(throws: StacksError.invalidHex) { try Data(hex: "+f") }
        #expect(throws: StacksError.invalidHex) { try Data(hex: "zz") }
    }

    @Test func bigEndianBytes() {
        #expect(UInt32(1).bigEndianData.hex == "00000001")
        #expect(UInt64(180).bigEndianData.hex == "00000000000000b4")
        #expect(UInt128(42).bigEndianData.hex == "0000000000000000000000000000002a")
    }

    @Test func vectorsLoad() {
        #expect(Vectors.all.phrases.count == 2)
        #expect(Vectors.all.transactions.count == 4)
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit`
Expected: the build fails because `Data(hex:)` doesn't exist yet.

- [ ] **Write the errors and the byte helpers**

`Sources/StacksKit/StacksError.swift`:

```swift
/// Everything StacksKit can refuse. StacksKit has no words for people: the app turns each case into a message.
public enum StacksError: Error, Equatable, Sendable {
    /// Not hex, or an odd number of digits
    case invalidHex
    /// A word not on the list, the wrong number of words, or a checksum that doesn't match
    case invalidSeedPhrase
    /// The system couldn't provide randomness for a new seed phrase
    case randomUnavailable
    /// Not a c32check Stacks address, or its checksum doesn't match (the SP/SM-only rule is WalletCore's recipient check)
    case invalidAddress
    /// Not a valid contract name (a letter, then letters, digits, - or _, at most 128 characters)
    case invalidContractName
    /// A private key that isn't 32 bytes (or 33 ending in 01), or isn't a valid secp256k1 key
    case invalidKey
    /// Bytes that aren't one of the Clarity values StacksKit reads
    case invalidClarityValue
}
```

`Sources/StacksKit/Bytes.swift`:

```swift
import Foundation

extension Data {
    /// Lowercase hex, two digits per byte
    public var hex: String { map { String(format: "%02x", $0) }.joined() }

    /// Bytes from hex, with or without a `0x` prefix
    public init(hex: String) throws {
        let digits = hex.hasPrefix("0x") ? hex.dropFirst(2) : Substring(hex)
        guard digits.count % 2 == 0, digits.allSatisfy(\.isHexDigit) else { throw StacksError.invalidHex }
        var bytes = [UInt8]()
        bytes.reserveCapacity(digits.count / 2)
        var index = digits.startIndex
        while index < digits.endIndex {
            let next = digits.index(index, offsetBy: 2)
            bytes.append(UInt8(digits[index..<next], radix: 16)!)
            index = next
        }
        self.init(bytes)
    }
}

extension FixedWidthInteger {
    /// The integer's bytes, most significant first
    var bigEndianData: Data { withUnsafeBytes(of: bigEndian) { Data($0) } }
}

/// Reads bytes front to back; every read past the end throws
struct ByteReader {
    private let bytes: [UInt8]
    private var offset = 0

    init(_ data: Data) { bytes = [UInt8](data) }

    var isAtEnd: Bool { offset == bytes.count }

    mutating func read(_ count: Int) throws -> [UInt8] {
        guard count >= 0, offset + count <= bytes.count else { throw StacksError.invalidClarityValue }
        defer { offset += count }
        return Array(bytes[offset..<offset + count])
    }

    mutating func byte() throws -> UInt8 { try read(1)[0] }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 3 tests in … suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit/Package.swift apps/blaze-ios/BlazeKit/Package.resolved apps/blaze-ios/BlazeKit/Sources apps/blaze-ios/BlazeKit/Tests
git commit -m "feat(blaze-ios): StacksKit package with errors and byte helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: SHA-512/256, RIPEMD-160 and hash160

**Files:**
- Create: `Sources/StacksKit/SHA512_256.swift`, `Sources/StacksKit/RIPEMD160.swift`, `Sources/StacksKit/Hashing.swift`
- Test: `Tests/StacksKitTests/HashingTests.swift`

- [ ] **Write the failing tests** (official vectors: NIST for SHA-512/256, the RIPEMD-160 paper)

```swift
import Foundation
import Testing
@testable import StacksKit

/// Official test vectors: NIST (SHA-512/256) and the RIPEMD-160 paper
struct HashingTests {
    @Test(arguments: [
        ("", "c672b8d1ef56ed28ab87c3622c5114069bdd3ad7b8f9737498d0c01ecef0967a"),
        ("abc", "53048e2681941ef99b2e29b76b4c7dabe4c2d0c634fc6d46e0e2f13107e7af23"),
        ("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
         "3928e184fb8690f840da3988121d31be65cb9d3ef83ee6146feac861e19b563a"),
    ])
    func sha512_256(input: String, expected: String) {
        #expect(SHA512_256.hash(Data(input.utf8)).hex == expected)
    }

    @Test func sha512_256OfAMillionAs() {
        let input = Data(repeating: UInt8(ascii: "a"), count: 1_000_000)
        #expect(SHA512_256.hash(input).hex == "9a59a052930187a97038cae692f30708aa6491923ef5194394dc68d56c74fb21")
    }

    @Test(arguments: [
        ("", "9c1185a5c5e9fc54612808977ee8f548b2258d31"),
        ("abc", "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"),
        ("message digest", "5d0689ef49d2fae572b881b123a85ffa21595f36"),
        ("abcdefghijklmnopqrstuvwxyz", "f71c27109c692c1b56bbdceb5b9d2865b3708dbc"),
        ("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "12a053384a9c0c88e405a06c27dcf49ada62eb2b"),
        (String(repeating: "1234567890", count: 8), "9b752e45573d4b39f4dbd3323cab82bf63326bfb"),
    ])
    func ripemd160(input: String, expected: String) {
        #expect(RIPEMD160.hash(Data(input.utf8)).hex == expected)
    }

    @Test func ripemd160OfAMillionAs() {
        let input = Data(repeating: UInt8(ascii: "a"), count: 1_000_000)
        #expect(RIPEMD160.hash(input).hex == "52783243c1697bdbe16d37f97f68f08325dc1528")
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit`
Expected: the build fails because `SHA512_256` doesn't exist yet.

- [ ] **Write the hashes**

`Sources/StacksKit/SHA512_256.swift`:

```swift
import Foundation

/// SHA-512/256 (FIPS 180-4): SHA-512 with its own initial values, cut to 32 bytes. Stacks uses it for txids and
/// signature hashes. CryptoKit has SHA-512 but no way to change its initial values.
public enum SHA512_256 {
    public static func hash(_ data: Data) -> Data {
        var h: [UInt64] = [
            0x2231_2194_FC2B_F72C, 0x9F55_5FA3_C84C_64C2, 0x2393_B86B_6F53_B151, 0x9638_7719_5940_EABD,
            0x9628_3EE2_A88E_FFE3, 0xBE5E_1E25_5386_3992, 0x2B01_99FC_2C85_B8AA, 0x0EB7_2DDC_81C5_2CA2,
        ]
        var message = [UInt8](data)
        let bitLength = UInt64(data.count) &* 8
        message.append(0x80)
        while message.count % 128 != 112 { message.append(0) }
        message += [UInt8](repeating: 0, count: 8)
        for shift in stride(from: 56, through: 0, by: -8) { message.append(UInt8(truncatingIfNeeded: bitLength >> UInt64(shift))) }
        var w = [UInt64](repeating: 0, count: 80)
        for chunk in stride(from: 0, to: message.count, by: 128) {
            for t in 0..<16 {
                var word: UInt64 = 0
                for b in 0..<8 { word = word << 8 | UInt64(message[chunk + t * 8 + b]) }
                w[t] = word
            }
            for t in 16..<80 {
                let s0 = rotr(w[t - 15], 1) ^ rotr(w[t - 15], 8) ^ (w[t - 15] >> 7)
                let s1 = rotr(w[t - 2], 19) ^ rotr(w[t - 2], 61) ^ (w[t - 2] >> 6)
                w[t] = w[t - 16] &+ s0 &+ w[t - 7] &+ s1
            }
            var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7]
            for t in 0..<80 {
                let s1 = rotr(e, 14) ^ rotr(e, 18) ^ rotr(e, 41)
                let ch = (e & f) ^ (~e & g)
                let temp1 = hh &+ s1 &+ ch &+ k[t] &+ w[t]
                let s0 = rotr(a, 28) ^ rotr(a, 34) ^ rotr(a, 39)
                let maj = (a & b) ^ (a & c) ^ (b & c)
                let temp2 = s0 &+ maj
                hh = g; g = f; f = e; e = d &+ temp1; d = c; c = b; b = a; a = temp1 &+ temp2
            }
            h[0] &+= a; h[1] &+= b; h[2] &+= c; h[3] &+= d; h[4] &+= e; h[5] &+= f; h[6] &+= g; h[7] &+= hh
        }
        var out = Data()
        for word in h.prefix(4) {
            for shift in stride(from: 56, through: 0, by: -8) { out.append(UInt8(truncatingIfNeeded: word >> UInt64(shift))) }
        }
        return out
    }

    private static func rotr(_ x: UInt64, _ n: UInt64) -> UInt64 { (x >> n) | (x << (64 - n)) }

    private static let k: [UInt64] = [
        0x428A_2F98_D728_AE22, 0x7137_4491_23EF_65CD, 0xB5C0_FBCF_EC4D_3B2F, 0xE9B5_DBA5_8189_DBBC,
        0x3956_C25B_F348_B538, 0x59F1_11F1_B605_D019, 0x923F_82A4_AF19_4F9B, 0xAB1C_5ED5_DA6D_8118,
        0xD807_AA98_A303_0242, 0x1283_5B01_4570_6FBE, 0x2431_85BE_4EE4_B28C, 0x550C_7DC3_D5FF_B4E2,
        0x72BE_5D74_F27B_896F, 0x80DE_B1FE_3B16_96B1, 0x9BDC_06A7_25C7_1235, 0xC19B_F174_CF69_2694,
        0xE49B_69C1_9EF1_4AD2, 0xEFBE_4786_384F_25E3, 0x0FC1_9DC6_8B8C_D5B5, 0x240C_A1CC_77AC_9C65,
        0x2DE9_2C6F_592B_0275, 0x4A74_84AA_6EA6_E483, 0x5CB0_A9DC_BD41_FBD4, 0x76F9_88DA_8311_53B5,
        0x983E_5152_EE66_DFAB, 0xA831_C66D_2DB4_3210, 0xB003_27C8_98FB_213F, 0xBF59_7FC7_BEEF_0EE4,
        0xC6E0_0BF3_3DA8_8FC2, 0xD5A7_9147_930A_A725, 0x06CA_6351_E003_826F, 0x1429_2967_0A0E_6E70,
        0x27B7_0A85_46D2_2FFC, 0x2E1B_2138_5C26_C926, 0x4D2C_6DFC_5AC4_2AED, 0x5338_0D13_9D95_B3DF,
        0x650A_7354_8BAF_63DE, 0x766A_0ABB_3C77_B2A8, 0x81C2_C92E_47ED_AEE6, 0x9272_2C85_1482_353B,
        0xA2BF_E8A1_4CF1_0364, 0xA81A_664B_BC42_3001, 0xC24B_8B70_D0F8_9791, 0xC76C_51A3_0654_BE30,
        0xD192_E819_D6EF_5218, 0xD699_0624_5565_A910, 0xF40E_3585_5771_202A, 0x106A_A070_32BB_D1B8,
        0x19A4_C116_B8D2_D0C8, 0x1E37_6C08_5141_AB53, 0x2748_774C_DF8E_EB99, 0x34B0_BCB5_E19B_48A8,
        0x391C_0CB3_C5C9_5A63, 0x4ED8_AA4A_E341_8ACB, 0x5B9C_CA4F_7763_E373, 0x682E_6FF3_D6B2_B8A3,
        0x748F_82EE_5DEF_B2FC, 0x78A5_636F_4317_2F60, 0x84C8_7814_A1F0_AB72, 0x8CC7_0208_1A64_39EC,
        0x90BE_FFFA_2363_1E28, 0xA450_6CEB_DE82_BDE9, 0xBEF9_A3F7_B2C6_7915, 0xC671_78F2_E372_532B,
        0xCA27_3ECE_EA26_619C, 0xD186_B8C7_21C0_C207, 0xEADA_7DD6_CDE0_EB1E, 0xF57D_4F7F_EE6E_D178,
        0x06F0_67AA_7217_6FBA, 0x0A63_7DC5_A2C8_98A6, 0x113F_9804_BEF9_0DAE, 0x1B71_0B35_131C_471B,
        0x28DB_77F5_2304_7D84, 0x32CA_AB7B_40C7_2493, 0x3C9E_BE0A_15C9_BEBC, 0x431D_67C4_9C10_0D4C,
        0x4CC5_D4BE_CB3E_42B6, 0x597F_299C_FC65_7E2A, 0x5FCB_6FAB_3AD6_FAEC, 0x6C44_198C_4A47_5817,
    ]
}
```

`Sources/StacksKit/RIPEMD160.swift`:

```swift
import Foundation

/// RIPEMD-160 (Dobbertin, Bosselaers, Preneel 1996), for hash160. CryptoKit and CommonCrypto have none.
public enum RIPEMD160 {
    public static func hash(_ data: Data) -> Data {
        var h: [UInt32] = [0x6745_2301, 0xEFCD_AB89, 0x98BA_DCFE, 0x1032_5476, 0xC3D2_E1F0]
        var message = [UInt8](data)
        let bitLength = UInt64(data.count) &* 8
        message.append(0x80)
        while message.count % 64 != 56 { message.append(0) }
        for shift in stride(from: 0, through: 56, by: 8) { message.append(UInt8(truncatingIfNeeded: bitLength >> UInt64(shift))) }
        var x = [UInt32](repeating: 0, count: 16)
        for chunk in stride(from: 0, to: message.count, by: 64) {
            for i in 0..<16 {
                let at = chunk + i * 4
                x[i] = UInt32(message[at]) | UInt32(message[at + 1]) << 8 | UInt32(message[at + 2]) << 16 | UInt32(message[at + 3]) << 24
            }
            var al = h[0], bl = h[1], cl = h[2], dl = h[3], el = h[4]
            var ar = h[0], br = h[1], cr = h[2], dr = h[3], er = h[4]
            for j in 0..<80 {
                let round = j / 16
                var t = rotl(al &+ f(j, bl, cl, dl) &+ x[r[j]] &+ kl[round], s[j]) &+ el
                al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t
                t = rotl(ar &+ f(79 - j, br, cr, dr) &+ x[rr[j]] &+ kr[round], sr[j]) &+ er
                ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t
            }
            let t = h[1] &+ cl &+ dr
            h[1] = h[2] &+ dl &+ er
            h[2] = h[3] &+ el &+ ar
            h[3] = h[4] &+ al &+ br
            h[4] = h[0] &+ bl &+ cr
            h[0] = t
        }
        var out = Data()
        for word in h { for shift in stride(from: 0, through: 24, by: 8) { out.append(UInt8(truncatingIfNeeded: word >> UInt32(shift))) } }
        return out
    }

    private static func rotl(_ x: UInt32, _ n: UInt32) -> UInt32 { (x << n) | (x >> (32 - n)) }

    private static func f(_ j: Int, _ x: UInt32, _ y: UInt32, _ z: UInt32) -> UInt32 {
        switch j {
        case 0..<16: return x ^ y ^ z
        case 16..<32: return (x & y) | (~x & z)
        case 32..<48: return (x | ~y) ^ z
        case 48..<64: return (x & z) | (y & ~z)
        default: return x ^ (y | ~z)
        }
    }

    private static let kl: [UInt32] = [0x0000_0000, 0x5A82_7999, 0x6ED9_EBA1, 0x8F1B_BCDC, 0xA953_FD4E]
    private static let kr: [UInt32] = [0x50A2_8BE6, 0x5C4D_D124, 0x6D70_3EF3, 0x7A6D_76E9, 0x0000_0000]
    private static let r: [Int] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
        3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
        1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
        4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
    ]
    private static let rr: [Int] = [
        5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
        6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
        15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
        8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
        12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
    ]
    private static let s: [UInt32] = [
        11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
        7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
        11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
        11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
        9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
    ]
    private static let sr: [UInt32] = [
        8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
        9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
        9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
        15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
        8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
    ]
}
```

`Sources/StacksKit/Hashing.swift`:

```swift
import CryptoKit
import Foundation

/// The hashes Stacks addresses and transactions are built from
enum Hashing {
    static func sha256(_ data: Data) -> Data { Data(CryptoKit.SHA256.hash(data: data)) }

    /// RIPEMD-160 of SHA-256: what a Stacks address commits to
    static func hash160(_ data: Data) -> Data { RIPEMD160.hash(sha256(data)) }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 7 tests in … suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit/Sources apps/blaze-ios/BlazeKit/Tests
git commit -m "feat(blaze-ios): SHA-512/256 and RIPEMD-160, checked against their official vectors" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Addresses and principals

**Files:**
- Create: `Sources/StacksKit/C32.swift`, `Sources/StacksKit/Address.swift`
- Test: `Tests/StacksKitTests/AddressTests.swift`

- [ ] **Write the failing tests**

```swift
import Foundation
import Testing
@testable import StacksKit

struct AddressTests {
    @Test func decodesAndReencodesTheVectors() throws {
        for vector in Vectors.all.addresses {
            let address = try StacksAddress(vector.address)
            #expect(address.version == vector.version)
            #expect(address.hash160.hex == vector.hash160)
            #expect(address.description == vector.address)
        }
    }

    @Test(arguments: [
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KT", // last character changed: bad checksum
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55K",  // one character short
        "ST2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // testnet version, checksum no longer matches
        "XP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // doesn't start with S
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55U",  // U isn't in the c32 alphabet
        "",
    ])
    func rejectsBadAddresses(text: String) {
        #expect(throws: StacksError.invalidAddress) { try StacksAddress(text) }
    }

    @Test func readsPrincipals() throws {
        #expect(try Principal("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token").description
            == "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token")
        #expect(throws: StacksError.invalidContractName) { try Principal("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.1token") }
        #expect(throws: StacksError.invalidContractName) { try Principal("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.") }
        #expect(throws: StacksError.invalidAddress) { try Principal("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.a.b") }
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit`
Expected: the build fails because `StacksAddress` doesn't exist yet.

- [ ] **Write c32 and the address types**

`Sources/StacksKit/C32.swift`:

```swift
import Foundation

/// Crockford-style base 32, as the c32check library writes Stacks addresses
enum C32 {
    static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")

    /// The bytes as one big number in base 32, plus one leading "0" per leading zero byte
    static func encode(_ data: Data) -> String {
        let bytes = [UInt8](data)
        let zeroBytes = bytes.prefix { $0 == 0 }.count
        var digits: [Character] = []
        var buffer: UInt32 = 0
        var bits: UInt32 = 0
        for byte in bytes.reversed() {
            buffer |= UInt32(byte) << bits
            bits += 8
            while bits >= 5 {
                digits.append(alphabet[Int(buffer & 31)])
                buffer >>= 5
                bits -= 5
            }
        }
        if bits > 0 { digits.append(alphabet[Int(buffer & 31)]) }
        while digits.last == "0" { digits.removeLast() }
        return String(repeating: "0", count: zeroBytes) + String(digits.reversed())
    }

    /// The inverse of `encode`. Throws on a character outside the alphabet (after `normalize`).
    static func decode(_ text: String) throws -> Data {
        let chars = Array(normalize(text))
        let zeroChars = chars.prefix { $0 == "0" }.count
        var bytes: [UInt8] = []
        var buffer: UInt32 = 0
        var bits: UInt32 = 0
        for char in chars.reversed() {
            guard let value = alphabet.firstIndex(of: char) else { throw StacksError.invalidAddress }
            buffer |= UInt32(value) << bits
            bits += 5
            if bits >= 8 {
                bytes.append(UInt8(buffer & 0xFF))
                buffer >>= 8
                bits -= 8
            }
        }
        if buffer != 0 { bytes.append(UInt8(buffer)) }
        while bytes.last == 0 { bytes.removeLast() }
        return Data(repeating: 0, count: zeroChars) + Data(bytes.reversed())
    }

    /// c32check reads O as 0 and I, L as 1, in either case
    static func normalize(_ text: String) -> String {
        text.uppercased()
            .replacingOccurrences(of: "O", with: "0")
            .replacingOccurrences(of: "I", with: "1")
            .replacingOccurrences(of: "L", with: "1")
    }
}
```

`Sources/StacksKit/Address.swift`:

```swift
import Foundation

/// A Stacks address: a version and the hash160 of a public key (or script), written in c32check
public struct StacksAddress: Hashable, Sendable, CustomStringConvertible {
    /// Mainnet single-signature addresses start with SP
    public static let mainnetSingleSig: UInt8 = 22
    /// Mainnet multi-signature addresses start with SM
    public static let mainnetMultiSig: UInt8 = 20

    public let version: UInt8
    public let hash160: Data

    public init(version: UInt8, hash160: Data) {
        precondition(version < 32 && hash160.count == 20, "A Stacks address is a version under 32 and 20 bytes")
        self.version = version
        self.hash160 = Data(hash160)
    }

    /// Reads an address like `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS`, checking its checksum
    public init(_ text: String) throws {
        let chars = Array(C32.normalize(text))
        guard chars.count > 5, chars[0] == "S", let version = C32.alphabet.firstIndex(of: chars[1]) else {
            throw StacksError.invalidAddress
        }
        let data = try C32.decode(String(chars.dropFirst(2)))
        guard data.count == 24 else { throw StacksError.invalidAddress }
        let hash160 = Data(data.prefix(20))
        guard Self.checksum(version: UInt8(version), hash160: hash160) == Data(data.suffix(4)) else {
            throw StacksError.invalidAddress
        }
        self.init(version: UInt8(version), hash160: hash160)
    }

    /// The mainnet single-sig address of a compressed public key
    public init(publicKey: Data) {
        self.init(version: Self.mainnetSingleSig, hash160: Hashing.hash160(publicKey))
    }

    public var description: String {
        "S" + String(C32.alphabet[Int(version)]) + C32.encode(hash160 + Self.checksum(version: version, hash160: hash160))
    }

    private static func checksum(version: UInt8, hash160: Data) -> Data {
        Data(Hashing.sha256(Hashing.sha256(Data([version]) + hash160)).prefix(4))
    }
}

/// Who can hold tokens: an address, or a contract deployed by one (`SP….contract-name`)
public enum Principal: Hashable, Sendable, CustomStringConvertible {
    case standard(StacksAddress)
    case contract(StacksAddress, name: String)

    /// Reads `SP…` or `SP….contract-name`
    public init(_ text: String) throws {
        let parts = text.split(separator: ".", omittingEmptySubsequences: false)
        switch parts.count {
        case 1:
            self = .standard(try StacksAddress(String(parts[0])))
        case 2:
            let name = String(parts[1])
            guard Self.isContractName(name) else { throw StacksError.invalidContractName }
            self = .contract(try StacksAddress(String(parts[0])), name: name)
        default:
            throw StacksError.invalidAddress
        }
    }

    public var description: String {
        switch self {
        case .standard(let address): address.description
        case .contract(let address, let name): "\(address).\(name)"
        }
    }

    /// A letter, then letters, digits, - or _: the extension's recipient pattern; at most 128 bytes on the wire
    static func isContractName(_ name: String) -> Bool {
        guard let first = name.unicodeScalars.first, name.utf8.count <= 128,
              CharacterSet.letters.contains(first), first.isASCII else { return false }
        return name.unicodeScalars.allSatisfy { $0.isASCII && (CharacterSet.alphanumerics.contains($0) || $0 == "-" || $0 == "_") }
    }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 10 tests in … suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit/Sources apps/blaze-ios/BlazeKit/Tests
git commit -m "feat(blaze-ios): Stacks addresses and principals in c32check" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Seed phrases

**Files:**
- Create: `Sources/StacksKit/Mnemonic.swift`
- Test: `Tests/StacksKitTests/MnemonicTests.swift`

- [ ] **Write the failing tests**

```swift
import Foundation
import Testing
@testable import StacksKit

struct MnemonicTests {
    @Test func seedsMatchScureBip39() throws {
        for vector in Vectors.all.phrases {
            #expect(Mnemonic.isValid(vector.phrase))
            #expect(try Mnemonic.seed(vector.phrase).hex == vector.seed)
        }
    }

    @Test func generatesValid24WordPhrases() throws {
        let phrase = try Mnemonic.generate()
        #expect(phrase.split(separator: " ").count == 24)
        #expect(Mnemonic.isValid(phrase))
        #expect(try Mnemonic.generate() != phrase)
    }

    @Test func allZeroEntropyGivesTheStandardTestPhrases() {
        #expect(Mnemonic.phrase(entropy: Data(repeating: 0, count: 16)) == Vectors.all.phrases[0].phrase)
        #expect(Mnemonic.phrase(entropy: Data(repeating: 0, count: 32)) == Vectors.all.phrases[1].phrase)
    }

    @Test func rejectsBadPhrases() {
        let words = Vectors.all.phrases[0].phrase.split(separator: " ").map(String.init)
        // Wrong checksum word, wrong count, and a word that isn't on the list
        #expect(!Mnemonic.isValid((words.dropLast() + ["abandon"]).joined(separator: " ")))
        #expect(!Mnemonic.isValid(words.dropLast().joined(separator: " ")))
        #expect(!Mnemonic.isValid((words.dropLast() + ["wallet!"]).joined(separator: " ")))
        #expect(throws: StacksError.invalidSeedPhrase) { try Mnemonic.seed("abandon abandon") }
    }

    @Test func normalizesWhatPeopleTypeOrPaste() {
        let phrase = Vectors.all.phrases[0].phrase
        // Capitals, extra and full-width spaces, full-width letters, Turkish dotted and dotless i
        #expect(Mnemonic.normalize("  ABANDON abandon\u{3000}abandon  abandon abandon abandon abandon abandon abandon abandon abandon ａｂｏｕｔ ") == phrase)
        #expect(Mnemonic.normalize("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about") == phrase)
        #expect(Mnemonic.normalize("İnch ınch") == "inch inch")
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit`
Expected: the build fails because `Mnemonic` doesn't exist yet.

- [ ] **Write the seed phrase code**

```swift
import CommonCrypto
import Foundation
import Security

/// BIP39 seed phrases with the English word list, as @scure/bip39 and @stacks/wallet-sdk use them
public enum Mnemonic {
    /// The cleanup for every typed or pasted seed phrase (translations spec, "Seed word entry"). Full-width letters
    /// and spaces become normal ones (NFKC), Turkish İ and ı become i, then lowercase without a locale (a Turkish
    /// locale would turn I into ı) and single spaces between words.
    public static func normalize(_ text: String) -> String {
        text.precomposedStringWithCompatibilityMapping
            .replacingOccurrences(of: "İ", with: "i")
            .replacingOccurrences(of: "ı", with: "i")
            .lowercased()
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }

    /// A new 24-word phrase from 256 bits of system randomness
    public static func generate() throws -> String {
        var entropy = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, entropy.count, &entropy) == errSecSuccess else {
            throw StacksError.randomUnavailable
        }
        return phrase(entropy: Data(entropy))
    }

    /// Whether `phrase` (already normalized) is 12, 15, 18, 21 or 24 listed words with a matching checksum
    public static func isValid(_ phrase: String) -> Bool { (try? entropy(of: phrase)) != nil }

    /// The 64-byte BIP39 seed of a valid, normalized phrase: PBKDF2-HMAC-SHA512, 2048 rounds, no passphrase
    public static func seed(_ phrase: String) throws -> Data {
        _ = try entropy(of: phrase)
        let password = phrase.decomposedStringWithCompatibilityMapping
        let salt = Array("mnemonic".utf8)
        var seed = [UInt8](repeating: 0, count: 64)
        let status = CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2), password, password.utf8.count, salt, salt.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA512), 2048, &seed, seed.count
        )
        guard status == Int32(kCCSuccess) else { throw StacksError.invalidSeedPhrase }
        return Data(seed)
    }

    /// The words for 16 to 32 bytes of entropy: 11 bits per word, the checksum taken from SHA-256 of the entropy
    static func phrase(entropy: Data) -> String {
        let hash = Hashing.sha256(entropy)
        let bits = Self.bits(of: entropy) + Self.bits(of: hash).prefix(entropy.count / 4)
        return stride(from: 0, to: bits.count, by: 11)
            .map { bip39English[Self.number(bits[$0..<$0 + 11])] }
            .joined(separator: " ")
    }

    static func entropy(of phrase: String) throws -> Data {
        let words = phrase.split(separator: " ")
        guard [12, 15, 18, 21, 24].contains(words.count) else { throw StacksError.invalidSeedPhrase }
        var bits: [Bool] = []
        for word in words {
            guard let index = wordIndex[String(word)] else { throw StacksError.invalidSeedPhrase }
            bits += (0..<11).reversed().map { index >> $0 & 1 == 1 }
        }
        let checksumBits = words.count / 3
        let entropyBits = bits.count - checksumBits
        let entropy = Data(stride(from: 0, to: entropyBits, by: 8).map { UInt8(Self.number(bits[$0..<$0 + 8])) })
        guard Array(Self.bits(of: Hashing.sha256(entropy)).prefix(checksumBits)) == Array(bits.suffix(checksumBits)) else {
            throw StacksError.invalidSeedPhrase
        }
        return entropy
    }

    private static let wordIndex = Dictionary(uniqueKeysWithValues: bip39English.enumerated().map { ($1, $0) })

    private static func bits(of data: Data) -> [Bool] {
        data.flatMap { byte in (0..<8).reversed().map { byte >> $0 & 1 == 1 } }
    }

    private static func number(_ bits: ArraySlice<Bool>) -> Int {
        bits.reduce(0) { $0 << 1 | ($1 ? 1 : 0) }
    }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 15 tests in … suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit/Sources apps/blaze-ios/BlazeKit/Tests
git commit -m "feat(blaze-ios): BIP39 seed phrases, with the cleanup typed and pasted words need" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Account keys

**Files:**
- Create: `Sources/StacksKit/HDKey.swift`, `Sources/StacksKit/AccountKeys.swift`
- Test: `Tests/StacksKitTests/AccountKeysTests.swift`

- [ ] **Write the failing tests**

```swift
import Foundation
import Testing
@testable import StacksKit

struct AccountKeysTests {
    @Test func accountsMatchWalletSDK() throws {
        for vector in Vectors.all.phrases {
            for account in vector.accounts {
                let keys = try AccountKeys.derive(phrase: vector.phrase, index: account.index)
                #expect(keys.privateKey.hex == account.privateKey)
                #expect(keys.publicKey.hex == account.publicKey)
                #expect(keys.address.description == account.address)
            }
        }
    }

    @Test func readsStoredKeysWithOrWithoutTheSuffix() throws {
        let account = Vectors.all.phrases[0].accounts[0]
        let stored = try Data(hex: account.privateKey)
        #expect(try AccountKeys(privateKey: stored).address.description == account.address)
        #expect(try AccountKeys(privateKey: stored.prefix(32)).address.description == account.address)
        #expect(throws: StacksError.invalidKey) { try AccountKeys(privateKey: Data(repeating: 0, count: 32)) }
        #expect(throws: StacksError.invalidKey) { try AccountKeys(privateKey: Data(repeating: 1, count: 31)) }
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit`
Expected: the build fails because `AccountKeys` doesn't exist yet.

- [ ] **Write the derivation**

`Sources/StacksKit/HDKey.swift`:

```swift
import CryptoKit
import Foundation
import P256K

/// BIP32 private-key derivation, only as far as Stacks accounts need it
struct HDKey {
    static let hardened: UInt32 = 0x8000_0000

    /// 32-byte secp256k1 private key
    let privateKey: Data
    let chainCode: Data

    /// The master key of a BIP39 seed
    init(seed: Data) throws {
        let digest = Self.hmac(key: Data("Bitcoin seed".utf8), data: seed)
        try self.init(privateKey: digest.prefix(32), chainCode: digest.suffix(32))
    }

    private init(privateKey: Data, chainCode: Data) throws {
        // Throws when the key is zero or not below the curve order
        _ = try Self.signingKey(privateKey)
        self.privateKey = Data(privateKey)
        self.chainCode = Data(chainCode)
    }

    /// The child at `index`; indexes from `hardened` up are hardened
    func child(_ index: UInt32) throws -> HDKey {
        let key = try Self.signingKey(privateKey)
        let parent = index >= Self.hardened ? Data([0]) + privateKey : key.publicKey.dataRepresentation
        let digest = Self.hmac(key: chainCode, data: parent + index.bigEndianData)
        do {
            return try HDKey(privateKey: try key.add(Array(digest.prefix(32))).dataRepresentation, chainCode: digest.suffix(32))
        } catch {
            throw StacksError.invalidKey
        }
    }

    func derive(_ path: [UInt32]) throws -> HDKey {
        try path.reduce(self) { try $0.child($1) }
    }

    static func signingKey(_ privateKey: Data) throws -> P256K.Signing.PrivateKey {
        do {
            return try P256K.Signing.PrivateKey(dataRepresentation: privateKey, format: .compressed)
        } catch {
            throw StacksError.invalidKey
        }
    }

    private static func hmac(key: Data, data: Data) -> Data {
        Data(CryptoKit.HMAC<CryptoKit.SHA512>.authenticationCode(for: data, using: CryptoKit.SymmetricKey(data: key)))
    }
}
```

`Sources/StacksKit/AccountKeys.swift`:

```swift
import Foundation

/// One Stacks account's keys and address, derived as @stacks/wallet-sdk does: m/44'/5757'/0'/0/{index}
public struct AccountKeys: Hashable, Sendable {
    /// 33 bytes: the private key with the 0x01 "compressed" suffix, as wallet-sdk's `stxPrivateKey`
    public let privateKey: Data
    /// 33-byte compressed public key
    public let publicKey: Data
    /// Mainnet single-sig address (SP…)
    public let address: StacksAddress

    /// Account `index` (0 is "Account 1") of a valid, normalized seed phrase
    public static func derive(phrase: String, index: UInt32) throws -> AccountKeys {
        guard index < HDKey.hardened else { throw StacksError.invalidKey }
        let path = [44 | HDKey.hardened, 5757 | HDKey.hardened, 0 | HDKey.hardened, 0, index]
        let child = try HDKey(seed: Mnemonic.seed(phrase)).derive(path)
        return try AccountKeys(privateKey: child.privateKey)
    }

    /// From a stored private key: 32 bytes, or 33 ending in 01
    public init(privateKey: Data) throws {
        let key = Data(privateKey)
        guard key.count == 32 || (key.count == 33 && key.last == 0x01) else { throw StacksError.invalidKey }
        let secret = Data(key.prefix(32))
        self.privateKey = secret + Data([0x01])
        self.publicKey = try HDKey.signingKey(secret).publicKey.dataRepresentation
        self.address = StacksAddress(publicKey: publicKey)
    }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 17 tests in … suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit/Sources apps/blaze-ios/BlazeKit/Tests
git commit -m "feat(blaze-ios): Accounts derive the same keys and addresses as the extension" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Clarity values

**Files:**
- Create: `Sources/StacksKit/Clarity.swift`
- Test: `Tests/StacksKitTests/ClarityTests.swift`

- [ ] **Write the failing tests**

```swift
import Foundation
import Testing
@testable import StacksKit

struct ClarityTests {
    @Test func serializesAndReadsLikeStacksTransactions() throws {
        for vector in Vectors.all.clarity {
            let value: ClarityValue = switch vector.name {
            case "uint", "uint-max": .uint(UInt128(vector.value!)!)
            case "ok-uint": .ok(.uint(UInt128(vector.value!)!))
            case "none": .none
            default: .principal(try Principal(vector.value!))
            }
            #expect(value.serialized.hex == vector.hex, "\(vector.name)")
            #expect(try ClarityValue(serialized: Data(hex: vector.hex)) == value, "\(vector.name)")
        }
    }

    @Test func readsBalances() throws {
        #expect(try ClarityValue(serialized: Data(hex: "01000000000000000000000000075bcd15")).uintValue == 123_456_789)
        #expect(try ClarityValue(serialized: Data(hex: "07010000000000000000000000000000002a")).uintValue == 42)
        #expect(ClarityValue.none.uintValue == nil)
    }

    @Test func rejectsWhatItDoesntRead() {
        #expect(throws: StacksError.invalidClarityValue) { try ClarityValue(serialized: Data([0x03])) }      // bool true
        #expect(throws: StacksError.invalidClarityValue) { try ClarityValue(serialized: Data([0x01, 0x00])) } // short uint
        #expect(throws: StacksError.invalidClarityValue) { try ClarityValue(serialized: Data([0x09, 0x09])) } // leftover
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit`
Expected: the build fails because `ClarityValue` doesn't exist yet.

- [ ] **Write the Clarity values**

```swift
import Foundation

/// The Clarity values the wallet sends (transfer arguments) and reads (subnet `get-balance`)
public indirect enum ClarityValue: Hashable, Sendable {
    case uint(UInt128)
    case principal(Principal)
    case none
    case ok(ClarityValue)

    /// Consensus serialization, as @stacks/transactions `Cl.serialize`
    public var serialized: Data {
        switch self {
        case .uint(let value):
            Data([0x01]) + value.bigEndianData
        case .principal(.standard(let address)):
            Data([0x05, address.version]) + address.hash160
        case .principal(.contract(let address, let name)):
            Data([0x06, address.version]) + address.hash160 + Data([UInt8(name.utf8.count)]) + Data(name.utf8)
        case .none:
            Data([0x09])
        case .ok(let value):
            Data([0x07]) + value.serialized
        }
    }

    /// Reads one serialized value. Other Clarity types, or bytes left over, throw.
    public init(serialized: Data) throws {
        var reader = ByteReader(serialized)
        self = try Self.read(&reader)
        guard reader.isAtEnd else { throw StacksError.invalidClarityValue }
    }

    /// The number in `u…` or `(ok u…)`, the two shapes subnet `get-balance` returns
    public var uintValue: UInt128? {
        switch self {
        case .uint(let value), .ok(.uint(let value)): value
        default: nil
        }
    }

    private static func read(_ reader: inout ByteReader) throws -> ClarityValue {
        switch try reader.byte() {
        case 0x01:
            return .uint(try reader.read(16).reduce(UInt128(0)) { $0 << 8 | UInt128($1) })
        case 0x05:
            return .principal(.standard(try readAddress(&reader)))
        case 0x06:
            let address = try readAddress(&reader)
            let length = Int(try reader.byte())
            guard let name = String(bytes: try reader.read(length), encoding: .utf8) else { throw StacksError.invalidClarityValue }
            return .principal(.contract(address, name: name))
        case 0x09:
            return .none
        case 0x07:
            return .ok(try read(&reader))
        default:
            throw StacksError.invalidClarityValue
        }
    }

    private static func readAddress(_ reader: inout ByteReader) throws -> StacksAddress {
        let version = try reader.byte()
        guard version < 32 else { throw StacksError.invalidClarityValue }
        return StacksAddress(version: version, hash160: Data(try reader.read(20)))
    }
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 20 tests in … suites passed`, and no `✘` lines.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit/Sources apps/blaze-ios/BlazeKit/Tests
git commit -m "feat(blaze-ios): The Clarity values transfers send and balances return" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Transactions

**Files:**
- Create: `Sources/StacksKit/Transaction.swift`
- Test: `Tests/StacksKitTests/TransactionTests.swift`

- [ ] **Write the failing tests**

```swift
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
        #expect(throws: StacksError.invalidContractName) {
            try StacksTransaction.sip10Transfer(token: token, tokenName: "charisma-token", asset: "", amount: 1,
                                                to: .standard(sender.address), publicKey: sender.publicKey)
        }
        #expect(throws: StacksError.invalidContractName) {
            try StacksTransaction.sip10Transfer(token: token, tokenName: "9token", asset: "charisma", amount: 1,
                                                to: .standard(sender.address), publicKey: sender.publicKey)
        }
    }
}
```

- [ ] **Run the tests and watch them fail**

Run: `swift test --package-path apps/blaze-ios/BlazeKit`
Expected: the build fails because `StacksTransaction` doesn't exist yet.

- [ ] **Write the transactions**

```swift
import Foundation
import P256K

/// A mainnet transaction from a single-sig account, serialized and signed byte-for-byte as @stacks/transactions 7 does
/// (standard auth, compressed key, anchor mode any, post condition mode deny)
public struct StacksTransaction: Hashable, Sendable {
    public enum Payload: Hashable, Sendable {
        /// Send STX, with an empty memo
        case stxTransfer(recipient: Principal, amount: UInt64)
        /// Call a public function of a contract
        case contractCall(contract: StacksAddress, contractName: String, functionName: String, arguments: [ClarityValue])
    }

    /// "`sender` sends exactly `amount` of `token`'s fungible token `asset`"
    public struct SendsExactly: Hashable, Sendable {
        public let sender: StacksAddress
        public let token: StacksAddress
        public let tokenName: String
        public let asset: String
        public let amount: UInt64
    }

    public let payload: Payload
    public let postConditions: [SendsExactly]
    /// The sender's 33-byte compressed public key
    public let publicKey: Data
    public let nonce: UInt64
    public let fee: UInt64
    /// 65 bytes, recovery id then r and s; all zeros until signed
    public let signature: Data

    public init(payload: Payload, postConditions: [SendsExactly] = [], publicKey: Data, nonce: UInt64 = 0, fee: UInt64 = 0) {
        self.init(payload: payload, postConditions: postConditions, publicKey: publicKey, nonce: nonce, fee: fee, signature: Self.emptySignature)
    }

    private init(payload: Payload, postConditions: [SendsExactly], publicKey: Data, nonce: UInt64, fee: UInt64, signature: Data) {
        self.payload = payload
        self.postConditions = postConditions
        self.publicKey = Data(publicKey)
        self.nonce = nonce
        self.fee = fee
        self.signature = Data(signature)
    }

    /// STX from `publicKey`'s account to `recipient`, in micro-STX
    public static func stxTransfer(to recipient: Principal, amount: UInt64, publicKey: Data, nonce: UInt64 = 0, fee: UInt64 = 0) -> StacksTransaction {
        StacksTransaction(payload: .stxTransfer(recipient: recipient, amount: amount), publicKey: publicKey, nonce: nonce, fee: fee)
    }

    /// A SIP-010 `transfer(amount, sender, recipient, none)`, guarded so exactly `amount` of `token::asset` leaves the sender
    public static func sip10Transfer(
        token: StacksAddress, tokenName: String, asset: String, amount: UInt64, to recipient: Principal,
        publicKey: Data, nonce: UInt64 = 0, fee: UInt64 = 0
    ) throws -> StacksTransaction {
        guard Principal.isContractName(tokenName) else { throw StacksError.invalidContractName }
        // Clarity asset names are 1 to 128 ASCII bytes
        guard (1...128).contains(asset.utf8.count), asset.allSatisfy(\.isASCII) else { throw StacksError.invalidContractName }
        let sender = StacksAddress(publicKey: publicKey)
        return StacksTransaction(
            payload: .contractCall(
                contract: token, contractName: tokenName, functionName: "transfer",
                arguments: [.uint(UInt128(amount)), .principal(.standard(sender)), .principal(recipient), .none]
            ),
            postConditions: [SendsExactly(sender: sender, token: token, tokenName: tokenName, asset: asset, amount: amount)],
            publicKey: publicKey, nonce: nonce, fee: fee
        )
    }

    /// The payload alone, hex: what Hiro's fee estimate (`/v2/fees/transaction`) takes
    public var payloadHex: String { payload.serialized.hex }

    /// The signed size in bytes, which the fee estimate also takes (a single-sig signature is always 65 bytes)
    public var estimatedLength: Int { serialized.count }

    public var serialized: Data { bytes(nonce: nonce, fee: fee, signature: signature) }

    public var txid: String { SHA512_256.hash(serialized).hex }

    /// The hash the sender signs: the txid with nonce, fee and signature cleared, then auth type, fee and nonce
    public var presignHash: Data {
        let initial = SHA512_256.hash(bytes(nonce: 0, fee: 0, signature: Self.emptySignature))
        return SHA512_256.hash(initial + Data([Self.standardAuth]) + fee.bigEndianData + nonce.bigEndianData)
    }

    /// Signed with the account's private key (32 bytes, or 33 ending in 01), which must match `publicKey`
    public func signed(privateKey: Data) throws -> StacksTransaction {
        let keys = try AccountKeys(privateKey: privateKey)
        guard keys.publicKey == publicKey else { throw StacksError.invalidKey }
        let key = try P256K.Recovery.PrivateKey(dataRepresentation: Data(keys.privateKey.prefix(32)), format: .compressed)
        let compact = key.signature(for: HashDigest(Array(presignHash))).compactRepresentation
        let signature = Data([UInt8(compact.recoveryId)]) + compact.signature
        return StacksTransaction(payload: payload, postConditions: postConditions, publicKey: publicKey, nonce: nonce, fee: fee, signature: signature)
    }

    private static let emptySignature = Data(repeating: 0, count: 65)
    private static let standardAuth: UInt8 = 0x04

    private func bytes(nonce: UInt64, fee: UInt64, signature: Data) -> Data {
        var out = Data([0x00]) + UInt32(1).bigEndianData                   // mainnet, chain id 1
        out += Data([Self.standardAuth, 0x00]) + Hashing.hash160(publicKey) // standard auth, P2PKH signer
        out += nonce.bigEndianData + fee.bigEndianData
        out += Data([0x00]) + signature                                     // compressed key, signature
        out += Data([0x03, 0x02])                                           // anchor mode any, post conditions deny
        out += UInt32(postConditions.count).bigEndianData
        for condition in postConditions { out += condition.serialized }
        return out + payload.serialized
    }
}

extension StacksTransaction.Payload {
    var serialized: Data {
        switch self {
        case .stxTransfer(let recipient, let amount):
            Data([0x00]) + ClarityValue.principal(recipient).serialized + amount.bigEndianData + Data(repeating: 0, count: 34)
        case .contractCall(let contract, let contractName, let functionName, let arguments):
            Data([0x02, contract.version]) + contract.hash160 + lengthPrefixed(contractName) + lengthPrefixed(functionName)
                + UInt32(arguments.count).bigEndianData + arguments.reduce(Data()) { $0 + $1.serialized }
        }
    }
}

extension StacksTransaction.SendsExactly {
    var serialized: Data {
        Data([0x01, 0x02, sender.version]) + sender.hash160       // fungible, standard principal
            + Data([token.version]) + token.hash160 + lengthPrefixed(tokenName) + lengthPrefixed(asset)
            + Data([0x01]) + amount.bigEndianData                   // equal to
    }
}

/// A 1-byte length, then the UTF-8 bytes
private func lengthPrefixed(_ text: String) -> Data {
    Data([UInt8(text.utf8.count)]) + Data(text.utf8)
}
```

- [ ] **Run the tests and watch them pass**

Run: `swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|Test run with"`
Expected: `✔ Test run with 23 tests in … suites passed`, and no `✘` lines.

If a vector test fails, compare in this order, because each step builds on the one before: `payloadHex` against `payload`, `presignHash` against `presign`, then `serialized` and `txid`. The vector also has `sighash` (the txid with nonce, fee and signature cleared) for when `presign` differs.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeKit/Sources apps/blaze-ios/BlazeKit/Tests
git commit -m "feat(blaze-ios): STX and SIP-010 transfers signed byte-for-byte like the extension" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Hand-off check

- [ ] **Run everything once more from a clean build**

```bash
rm -rf apps/blaze-ios/BlazeKit/.build && swift test --package-path apps/blaze-ios/BlazeKit 2>&1 | grep -E "✘|error:|warning:|Test run with"
```

Expected: `✔ Test run with 23 tests in 7 suites passed`, with no errors and no warnings from `Sources/StacksKit`.

- [ ] **Confirm the tree is clean** with `git status` (nothing left uncommitted), and report the branch and last commit to Ross.
