# Blaze Wallet iOS, Plan 3: The App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Blaze Wallet iPhone app, in English, on top of StacksKit (plan 1) and WalletCore (plan 2). It has:
- the Face ID vault
- Welcome and the lock screen
- the Wallet, Tokens (with Send and Receive) and Status tabs
- the Charisma brand

Plan 3b then adds the other eight languages.

**Architecture:**
- **Project:** an XcodeGen project (`project.yml`), so only text is committed. The `.xcodeproj` is generated.
- **Vault:** one `@MainActor @Observable` class keeps the wallet in a WalletCore `Session` and saves it to one Keychain item, read with one Face ID-checked `LAContext` per unlock.
- **Screens:** SwiftUI. Each tab owns a small `@Observable` model for its server data. Every user-facing string is a String Catalog key, and WalletCore's typed errors are worded in one place (`ErrorWords`).

**Tech Stack:** iOS 18, Swift 6, SwiftUI, LocalAuthentication, Security (Keychain), CoreImage (QR), XcodeGen 2.x, String Catalogs, BlazeKit.

**Spec:** `docs/superpowers/specs/2026-10-12-blaze-wallet-ios-design.md`, sections "What gets ported", "Vault", "Screens", "Languages" (English here), "Errors", "Testing".

**Baseline:** branch `feat/blaze-ios` with plans 1 and 2 done (49 tests passing).

---

## Working notes for every task

- **Pre-tested.** Everything here was built and run before the plan was written:
  - the app compiled for the iOS Simulator with no warnings from its own code
  - it launched on a temporary iPhone 17 Pro simulator (iOS 26.5), and Welcome drew correctly in both themes, with Ysabeau Infant in Dark
  - `sync-strings.sh` produced the same 139-key catalog

  Copy the code exactly.
- **Commands.** Run every command from the repo root, unless a step says `cd`.
- **Building is part of this work**, and it doesn't touch the JS apps.
  - The command-line build passes `-skipPackagePluginValidation`. Xcode itself asks once to "Trust & Enable" swift-secp256k1's build plugin.
  - Builds that run on a simulator need ad-hoc signing (`CODE_SIGN_IDENTITY=-`). Unsigned apps get Keychain error -34018 (missing entitlement).
- **Strings.**
  - Text in `Text("…")`, `Button("…")` and `String(localized: …)` becomes a catalog key; `Text(verbatim:)` is for text that is never translated (brand names, units, dashes).
  - The command-line build doesn't update the catalog. `scripts/sync-strings.sh` does what Xcode does on build.
- **No mock data, placeholders or fallbacks.** A loading state is a spinner with "Loading balances…". Every error is worded by `ErrorWords`.
- **Commits:** commit after every task, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

All paths are inside `apps/blaze-ios`.

| File | Responsibility |
|---|---|
| `project.yml` | The XcodeGen project: target, Info.plist keys, fonts, build settings |
| `.gitignore` | Adds the generated project, `Info.plist` and Xcode's per-user files |
| `README.md` | Run, test and regenerate |
| `scripts/brand.mjs` | Writes `BlazeWallet/Brand` from `packages/brand`: 45 colours, the flame, the icon slot, the fonts |
| `scripts/app-icon.swift` | Draws the 1024×1024 opaque app icon from the flame SVG |
| `scripts/sync-strings.sh` | Adds the Swift code's strings to `Localizable.xcstrings` from the command line |
| `BlazeWallet/Brand/` | Generated: `Brand.xcassets` (colours, BlazeFlame, AppIcon) and `Fonts/` |
| `BlazeWallet/Brand/Theme.swift` | Theme choice, brand and mono fonts, `.brand("token")` colours |
| `BlazeWallet/App/` | Entry, root (phases, idle lock, privacy cover, tabs, Lock button), lock screen, Welcome |
| `BlazeWallet/Vault/` | `Keychain` (the one item) and `Vault` (Face ID, Session, saves) |
| `BlazeWallet/Shared/` | `Format` (addresses, amounts, USD, explorer) and `ErrorWords` / `ErrorText` |
| `BlazeWallet/Wallet/` | Wallet tab, new and imported seed phrases, Receive, seed words |
| `BlazeWallet/Tokens/` | Tokens tab and model, token rows, Send |
| `BlazeWallet/Status/` | Status tab and model |
| `BlazeWallet/Localizable.xcstrings`, `InfoPlist.xcstrings` | The String Catalogs (English here; plan 3b adds eight languages) |

---

### Task 1: The project and the brand

**Files:**
- Create: `apps/blaze-ios/project.yml`, `apps/blaze-ios/README.md`, the three scripts
- Modify: `apps/blaze-ios/.gitignore` (whole file below)
- Generated: `apps/blaze-ios/BlazeWallet/Brand/` (assets and fonts)
- Create: `apps/blaze-ios/BlazeWallet/Brand/Theme.swift`

- [ ] **Write the project, the gitignore and the README**

`apps/blaze-ios/project.yml`:

```yaml
# Blaze Wallet for iOS. Generate the Xcode project with `xcodegen` in this folder; BlazeWallet.xcodeproj is git-ignored.
name: BlazeWallet
options:
  bundleIdPrefix: rocks.charisma
  deploymentTarget:
    iOS: "18.0"
  developmentLanguage: en
  createIntermediateGroups: true
settings:
  base:
    SWIFT_VERSION: "6.0"
    # Without this SwiftUI text isn't extracted into Localizable.xcstrings (Xcode's default and XcodeGen's are off)
    SWIFT_EMIT_LOC_STRINGS: YES
    LOCALIZATION_PREFERS_STRING_CATALOGS: YES
    CODE_SIGN_STYLE: Automatic
    # Ross's Apple Developer team id, needed only to run on a real iPhone
    DEVELOPMENT_TEAM: ""
packages:
  BlazeKit:
    path: BlazeKit
targets:
  BlazeWallet:
    type: application
    platform: iOS
    sources:
      - path: BlazeWallet
    dependencies:
      - package: BlazeKit
        product: StacksKit
      - package: BlazeKit
        product: WalletCore
    info:
      path: BlazeWallet/Info.plist
      properties:
        CFBundleDisplayName: Blaze Wallet
        CFBundleShortVersionString: "1.0"
        CFBundleVersion: "1"
        CFBundleDevelopmentRegion: en
        NSFaceIDUsageDescription: Blaze Wallet uses Face ID to unlock your wallet.
        ITSAppUsesNonExemptEncryption: false
        UILaunchScreen:
          UIColorName: bg
        UISupportedInterfaceOrientations: [UIInterfaceOrientationPortrait]
        UIAppFonts: [DMMono-Regular.woff2, DMMono-Medium.woff2, YsabeauInfant.woff2, YsabeauInfant-Italic.woff2]
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: rocks.charisma.blazewallet
        TARGETED_DEVICE_FAMILY: "1"
        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
```

`apps/blaze-ios/.gitignore`:

```gitignore
# SwiftPM build output
BlazeKit/.build/
BlazeKit/.swiftpm/
# Generated by `xcodegen` from project.yml
BlazeWallet.xcodeproj/
BlazeWallet/Info.plist
# Xcode
DerivedData/
xcuserdata/
```

`apps/blaze-ios/README.md`:

```markdown
# Blaze Wallet for iOS

The Blaze Wallet Chrome extension's wallet (`apps/signet`) as a native iPhone app:
- seed phrases and accounts behind Face ID
- one balance per token across Standard and Blaze
- sends and Status

It has no website connections. Specs: `docs/superpowers/specs/2026-10-12-blaze-wallet-ios-design.md` and `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md`.

## Run it

1. Install XcodeGen once: `brew install xcodegen`.
2. Generate the project: `cd apps/blaze-ios && xcodegen generate`. `BlazeWallet.xcodeproj` is generated, so git ignores it.
3. Open `BlazeWallet.xcodeproj`, pick an iPhone simulator and press Run (⌘R). The first build asks you to trust swift-secp256k1's build plugin: choose **Trust & Enable**.
   - **Face ID in the simulator:** choose Features › Face ID › Enrolled, then Features › Face ID › Matching Face when the app asks.
   - **On a real iPhone:** set `DEVELOPMENT_TEAM` in `project.yml` to your Apple Developer team id, then generate again.

## Test

- `swift test --package-path apps/blaze-ios/BlazeKit` runs the StacksKit and WalletCore tests.
- `BLAZE_LIVE=1 swift test --package-path apps/blaze-ios/BlazeKit --filter Live` runs the same checks against the real servers. They only read.

## Regenerate

- **Strings:** after changing text in Swift, run `sh apps/blaze-ios/scripts/sync-strings.sh`. Xcode does the same on every build.
- **Brand:** when `packages/brand` changes, run `node apps/blaze-ios/scripts/brand.mjs`.
- **App icon:** run `swiftc -O apps/blaze-ios/scripts/app-icon.swift -o /tmp/app-icon && /tmp/app-icon apps/signet/src/assets/blaze-flame.svg apps/blaze-ios/BlazeWallet/Brand/Brand.xcassets/AppIcon.appiconset/AppIcon.png`.
- **Test vectors:** run `node apps/signet/scripts/ios-vectors.mjs`. Its header says what it needs.
```

- [ ] **Write the scripts**

`apps/blaze-ios/scripts/brand.mjs`:

```js
/**
 * Brand assets for the iOS app, from @repo/brand (packages/brand): every colour token in both themes, the fonts and
 * the Blaze flame, written into BlazeWallet/Brand. The output is committed; re-run when packages/brand changes:
 *   node apps/blaze-ios/scripts/brand.mjs
 * The app icon is drawn separately by scripts/app-icon.swift.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const app = join(dirname(fileURLToPath(import.meta.url)), "..")
const repo = join(app, "../..")
const brand = join(repo, "packages/brand")
const out = join(app, "BlazeWallet/Brand")
const catalog = join(out, "Brand.xcassets")
const info = { author: "xcode", version: 1 }

function json(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

const tokens = JSON.parse(readFileSync(join(brand, "tokens.json"), "utf8")).color.tokens
const byName = Object.fromEntries(tokens.map(token => [token.name, token.value]))

/** A token's value in one theme, following aliases such as "{accent-soft}" */
function resolve(value, theme, seen = []) {
  const raw = typeof value === "string" ? value : value[theme]
  const alias = /^\{(.+)\}$/.exec(raw)
  if (!alias) return raw
  if (seen.includes(alias[1]) || !(alias[1] in byName)) throw new Error(`Bad colour alias ${raw}`)
  return resolve(byName[alias[1]], theme, [...seen, alias[1]])
}

/** "#rrggbb" or "#rrggbbaa" as an asset catalog colour */
function colour(hex) {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex)
  if (!match) throw new Error(`Not a hex colour: ${hex}`)
  const channel = at => (parseInt(match[1].slice(at, at + 2), 16) / 255).toFixed(3)
  const alpha = (parseInt(match[2] ?? "ff", 16) / 255).toFixed(3)
  return { "color-space": "srgb", components: { red: channel(0), green: channel(2), blue: channel(4), alpha } }
}

json(join(catalog, "Contents.json"), { info })
rmSync(join(catalog, "Colors"), { recursive: true, force: true })
json(join(catalog, "Colors/Contents.json"), { info })
for (const { name, value } of tokens) {
  json(join(catalog, `Colors/${name}.colorset/Contents.json`), {
    colors: [
      { idiom: "universal", color: colour(resolve(value, "light")) },
      { idiom: "universal", appearances: [{ appearance: "luminosity", value: "dark" }], color: colour(resolve(value, "dark")) }
    ],
    info
  })
}

// The Blaze flame, kept as a vector
copyFileSync(join(repo, "apps/signet/src/assets/blaze-flame.svg"), join(mkdirIn(catalog, "BlazeFlame.imageset"), "blaze-flame.svg"))
json(join(catalog, "BlazeFlame.imageset/Contents.json"), {
  images: [{ filename: "blaze-flame.svg", idiom: "universal" }],
  info,
  properties: { "preserves-vector-representation": true }
})

// The app icon's slot: scripts/app-icon.swift draws AppIcon.png into it
json(join(catalog, "AppIcon.appiconset/Contents.json"), {
  images: [{ filename: "AppIcon.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
  info
})

// The open-licence fonts and their licences. Matter (Light's font) is commercial and stays out until its licence is
// confirmed to cover apps (iOS spec, Decision 2); Light uses the system font meanwhile.
const FONTS = ["DMMono-Regular.woff2", "DMMono-Medium.woff2", "YsabeauInfant.woff2", "YsabeauInfant-Italic.woff2", "OFL-DMMono.txt", "OFL-YsabeauInfant.txt"]
for (const font of FONTS) copyFileSync(join(brand, "fonts", font), join(mkdirIn(out, "Fonts"), font))

function mkdirIn(parent, name) {
  const path = join(parent, name)
  mkdirSync(path, { recursive: true })
  return path
}

console.log(`Wrote ${tokens.length} colours, the flame, the icon slot and ${FONTS.length} font files to ${out}`)
```

`apps/blaze-ios/scripts/app-icon.swift`:

```swift
import AppKit
import ImageIO
import UniformTypeIdentifiers

// usage: app-icon <flame.svg> <out.png>: the flame centred on Dark · RPG "bg" (#0b0606), 1024×1024, opaque
let args = CommandLine.arguments
guard args.count == 3, let flame = NSImage(contentsOfFile: args[1]) else {
    FileHandle.standardError.write(Data("usage: app-icon <flame.svg> <out.png>\n".utf8))
    exit(1)
}
let size = 1024
let inset = Double(size) * 0.18
let box = CGRect(x: inset, y: inset, width: Double(size) - 2 * inset, height: Double(size) - 2 * inset)
guard let flameImage = flame.cgImage(forProposedRect: nil, context: nil, hints: [.ctm: AffineTransform(scale: box.width / flame.size.width)]),
      let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
    FileHandle.standardError.write(Data("Couldn't render \(args[1])\n".utf8))
    exit(1)
}
context.setFillColor(CGColor(srgbRed: 0x0b / 255, green: 0x06 / 255, blue: 0x06 / 255, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: size, height: size))
context.draw(flameImage, in: box)
guard let icon = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(destination, icon, nil)
guard CGImageDestinationFinalize(destination) else { exit(1) }
print("Wrote \(args[2]) (\(size)×\(size), opaque)")
```

`apps/blaze-ios/scripts/sync-strings.sh`:

```sh
#!/bin/sh
# Adds every string the app's Swift code shows to BlazeWallet/Localizable.xcstrings, and marks ones no longer used
# as stale: what Xcode does on each build, from the command line. Run from the repo root:
#   sh apps/blaze-ios/scripts/sync-strings.sh
set -eu
cd "$(dirname "$0")/.."
xcodegen generate --quiet
build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT
xcodebuild -project BlazeWallet.xcodeproj -scheme BlazeWallet -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$build" -skipPackagePluginValidation -quiet build CODE_SIGNING_ALLOWED=NO
find "$build/Build/Intermediates.noindex/BlazeWallet.build" -path "*arm64*" -name "*.stringsdata" \
  ! -name "ExtractedAppShortcutsMetadata.stringsdata" > "$build/stringsdata"
set --
while read -r file; do set -- "$@" --stringsdata "$file"; done < "$build/stringsdata"
xcrun xcstringstool sync BlazeWallet/Localizable.xcstrings "$@"
echo "Synced $(xcrun xcstringstool print BlazeWallet/Localizable.xcstrings | grep -c '') lines of keys into BlazeWallet/Localizable.xcstrings"
```

- [ ] **Generate the brand assets and the icon**

```bash
node apps/blaze-ios/scripts/brand.mjs
swiftc -O apps/blaze-ios/scripts/app-icon.swift -o /tmp/app-icon
/tmp/app-icon apps/signet/src/assets/blaze-flame.svg apps/blaze-ios/BlazeWallet/Brand/Brand.xcassets/AppIcon.appiconset/AppIcon.png
sips -g pixelWidth -g pixelHeight -g hasAlpha apps/blaze-ios/BlazeWallet/Brand/Brand.xcassets/AppIcon.appiconset/AppIcon.png
```

Expected:
- `Wrote 45 colours, the flame, the icon slot and 6 font files to …/BlazeWallet/Brand`
- then `Wrote … (1024×1024, opaque)`
- then `pixelWidth: 1024`, `pixelHeight: 1024`, `hasAlpha: no`

`ls apps/blaze-ios/BlazeWallet/Brand/Fonts` lists the two DM Mono and two Ysabeau Infant `.woff2` files and both `OFL-*.txt`. Matter is not there: its licence is still to be confirmed (iOS spec, Decision 2).

- [ ] **Write the theme**

`apps/blaze-ios/BlazeWallet/Brand/Theme.swift`:

```swift
import SwiftUI

/// Blaze Wallet on the Charisma brand (@repo/brand): Dark · RPG by night, Light · Bitcoin by day, following the phone
/// until the person picks one. Colours are the brand tokens in Brand.xcassets, named as in tokens.json.
enum Theme {
    static let storageKey = "blaze-theme"

    enum Choice: String, CaseIterable, Identifiable {
        case system, light, dark

        var id: Self { self }

        var colorScheme: ColorScheme? {
            switch self {
            case .system: nil
            case .light: .light
            case .dark: .dark
            }
        }
    }
}

extension View {
    /// Words: Ysabeau Infant in Dark · RPG, the system font in Light · Bitcoin (Matter waits on its licence)
    func brandFont(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> some View {
        modifier(BrandFont(style: style, weight: weight, mono: false))
    }

    /// Numbers, addresses and seed words: DM Mono in both themes
    func monoFont(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> some View {
        modifier(BrandFont(style: style, weight: weight, mono: true))
    }
}

private struct BrandFont: ViewModifier {
    let style: Font.TextStyle
    let weight: Font.Weight
    let mono: Bool
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        if mono {
            content.font(.custom(weight == .regular ? "DMMono-Regular" : "DMMono-Medium", size: Self.size(style), relativeTo: style))
        } else if scheme == .dark {
            content.font(.custom("Ysabeau Infant", size: Self.size(style), relativeTo: style).weight(weight))
        } else {
            content.font(.system(style, weight: weight))
        }
    }

    /// iOS's default sizes at the standard Dynamic Type setting; `relativeTo` scales them with the person's setting
    private static func size(_ style: Font.TextStyle) -> CGFloat {
        switch style {
        case .largeTitle: 34
        case .title: 28
        case .title2: 22
        case .title3: 20
        case .headline, .body: 17
        case .callout: 16
        case .subheadline: 15
        case .footnote: 13
        case .caption: 12
        case .caption2: 11
        default: 17
        }
    }
}

extension ShapeStyle where Self == Color {
    /// A brand colour token from Brand.xcassets, such as `.brand("ink-muted")`
    static func brand(_ token: String) -> Color { Color(token) }
}
```

- [ ] **Check the project generates:** `cd apps/blaze-ios && xcodegen generate && cd -`. Expected: `Created project at …/BlazeWallet.xcodeproj`. `git status` must not list the `.xcodeproj` or `BlazeWallet/Info.plist`, because both are ignored.

- [ ] **Commit**

```bash
git add apps/blaze-ios/project.yml apps/blaze-ios/.gitignore apps/blaze-ios/README.md apps/blaze-ios/scripts apps/blaze-ios/BlazeWallet/Brand
git commit -m "feat(blaze-ios): XcodeGen project and the Charisma brand: colours, fonts, flame and app icon" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The app

**Files:** create every file below, in `apps/blaze-ios/`.

- [ ] **Shared text: formatting and error wording**

`apps/blaze-ios/BlazeWallet/Shared/Format.swift`:

```swift
import Foundation
import StacksKit
import WalletCore

/// Text the screens share
enum Format {
    /// "SP2ZN…55KS", as the extension shortens addresses
    static func short(_ address: String) -> String {
        address.count > 12 ? "\(address.prefix(5))…\(address.suffix(4))" : address
    }

    /// A row's symbol, or its contract name when the token is unknown
    static func symbol(_ row: TokenRow) -> String {
        row.meta?.symbol ?? String(row.contractId.split(separator: ".").last ?? Substring(row.contractId))
    }

    /// An amount of a row's token, in the person's locale; raw units when the token is unknown
    static func amount(_ raw: Int128, of row: TokenRow, precision: Amount.Precision) -> String {
        guard let meta = row.meta else { return String(localized: "\(String(raw)) units") }
        return Amount.format(raw, decimals: meta.decimals, precision: precision, locale: .current)
    }

    /// Micro-STX as STX, every decimal (the review's network fee)
    static func stx(_ micro: Int128) -> String {
        Amount.format(micro, decimals: 6, precision: .exact, locale: .current)
    }

    static func usd(_ value: Double) -> String { Amount.usd(value, locale: .current) }

    /// The explorer page for a txid
    static func explorer(_ txid: String) -> URL {
        URL(string: "https://explorer.hiro.so/txid/0x\(txid)?chain=mainnet")!
    }
}
```
`apps/blaze-ios/BlazeWallet/Shared/ErrorText.swift`:

```swift
import LocalAuthentication
import StacksKit
import SwiftUI
import WalletCore

/// Errors the app itself raises
enum AppError: Error, Equatable {
    /// Word positions (1-based) whose confirmation doesn't match
    case wordsDontMatch([Int])
}

/// Words for every error the app can show, in the person's language. `row` gives amounts their token's decimals.
enum ErrorWords {
    static func message(_ error: Error, row: TokenRow? = nil) -> String {
        switch error {
        case let error as WalletError: wallet(error, row: row)
        case let error as VaultError: vault(error)
        case let error as AppError: app(error)
        case StacksError.randomUnavailable: String(localized: "This iPhone couldn't make random words. Try again.")
        default: String(localized: "Something went wrong: \(error.localizedDescription)")
        }
    }

    private static func wallet(_ error: WalletError, row: TokenRow?) -> String {
        switch error {
        case .locked: String(localized: "The wallet is locked. Unlock it to continue.")
        case .invalidSeedPhrase: String(localized: "That isn't a valid seed phrase: check each word's spelling and that none are missing.")
        case .seedPhraseNameTaken(let name): String(localized: "A seed phrase named “\(name)” already exists.")
        case .seedPhraseNotFound: String(localized: "That seed phrase is no longer in this wallet.")
        case .accountNotFound: String(localized: "That account is no longer in this wallet.")
        case .requestFailed(.balances, let status): String(localized: "Couldn't load balances (\(status)).")
        case .requestFailed(.tokenList, let status): String(localized: "Couldn't load Charisma's token list (\(status)).")
        case .requestFailed(.prices, let status): String(localized: "Couldn't load prices (\(status)).")
        case .requestFailed(.stacks, let status): String(localized: "The Stacks network didn't answer (\(status)).")
        case .unreachable(.balances): String(localized: "Couldn't reach Charisma's balance service. Check your connection.")
        case .unreachable(.tokenList): String(localized: "Couldn't reach Charisma's token list. Check your connection.")
        case .unreachable(.prices): String(localized: "Couldn't reach Charisma's price feed. Check your connection.")
        case .unreachable(.stacks): String(localized: "Couldn't reach the Stacks network. Check your connection.")
        case .unreadable(.balances): String(localized: "Charisma's balance service sent something Blaze Wallet can't read.")
        case .unreadable(.tokenList): String(localized: "Charisma's token list sent something Blaze Wallet can't read.")
        case .unreadable(.prices): String(localized: "Charisma's price feed sent something Blaze Wallet can't read.")
        case .unreadable(.stacks): String(localized: "The Stacks network sent something Blaze Wallet can't read.")
        case .tokenListUnavailable: String(localized: "Charisma's token list is unavailable, so tokens can't be checked against its block list.")
        case .invalidRecipient: String(localized: "Enter a Stacks address (SP…).")
        case .invalidAmount: String(localized: "Enter an amount like \("1" + Amount.decimalMark(.current) + "5").")
        case .tooManyDecimals(let places): String(localized: "At most \(places) decimal places.")
        case .amountNotPositive: String(localized: "The amount must be more than zero.")
        case .moreThanBalance(let available):
            if let row { String(localized: "You have \(Format.amount(available, of: row, precision: .exact)) \(Format.symbol(row)).") }
            else { String(localized: "That's more than you have.") }
        case .missingAssetName(let symbol): String(localized: "Charisma's token list has no asset name for \(symbol), so it can't be sent safely.")
        case .notEnoughSTXForFee(let fee, let stxBalance, let mostSendable):
            if let mostSendable { String(localized: "Not enough STX for the network fee. You can send up to \(Format.stx(mostSendable)) STX.") }
            else { String(localized: "Not enough STX for the network fee: it's \(Format.stx(fee)) STX and you have \(Format.stx(stxBalance)) STX.") }
        case .rejected(let reason): String(localized: "The network rejected the transfer: \(reason)")
        case .unexpected(let message): String(localized: "Something went wrong: \(message)")
        }
    }

    private static func vault(_ error: VaultError) -> String {
        switch error {
        case .passcodeNotSet: String(localized: "Set a passcode on this iPhone to use Blaze Wallet.")
        case .authenticationUnavailable: String(localized: "Face ID and the passcode aren't available on this iPhone right now.")
        case .keychain(let status): String(localized: "This iPhone's Keychain refused (\(String(status))).")
        case .cancelled: String(localized: "Cancelled.")
        }
    }

    private static func app(_ error: AppError) -> String {
        switch error {
        case .wordsDontMatch(let positions):
            String(localized: "Word \(positions.map { "#\($0)" }.joined(separator: ", ")) doesn't match. Check what you wrote down.")
        }
    }
}

/// An error, worded, in the danger colour; nothing when there's no error
struct ErrorText: View {
    let error: Error?
    var row: TokenRow?

    var body: some View {
        if let error {
            Text(ErrorWords.message(error, row: row))
                .foregroundStyle(.brand("danger"))
                .brandFont(.callout)
        }
    }
}
```

- [ ] **The vault**

`apps/blaze-ios/BlazeWallet/Vault/Keychain.swift`:

```swift
import Foundation
import LocalAuthentication
import Security

/// Why the vault couldn't do something
enum VaultError: Error, Equatable {
    case passcodeNotSet
    case authenticationUnavailable
    /// The person dismissed Face ID or the passcode: not an error to show
    case cancelled
    case keychain(OSStatus)
}

/// The one Keychain item that holds the wallet. Reading it takes Face ID or the passcode (`.userPresence`); it stays
/// on this iPhone (`WhenPasscodeSetThisDeviceOnly`), so it's never in backups and never moves to another device.
enum Keychain {
    private static func item() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "rocks.charisma.blazewallet",
            kSecAttrAccount as String: "wallet",
        ]
    }

    /// Creates the item. `context` has already passed Face ID, so later reads and writes don't ask again.
    static func add(_ data: Data, context: LAContext) throws {
        guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .userPresence, nil) else {
            throw VaultError.keychain(errSecParam)
        }
        var query = item()
        query[kSecValueData as String] = data
        query[kSecAttrAccessControl as String] = access
        query[kSecUseAuthenticationContext as String] = context
        try check(SecItemAdd(query as CFDictionary, nil))
    }

    static func read(context: LAContext) throws -> Data {
        var query = item()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecUseAuthenticationContext as String] = context
        var result: CFTypeRef?
        try check(SecItemCopyMatching(query as CFDictionary, &result))
        guard let data = result as? Data else { throw VaultError.keychain(errSecDecode) }
        return data
    }

    static func update(_ data: Data, context: LAContext) throws {
        var query = item()
        query[kSecUseAuthenticationContext as String] = context
        try check(SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary))
    }

    static func delete() throws {
        let status = SecItemDelete(item() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw VaultError.keychain(status) }
    }

    /// Whether a wallet exists, without ever asking for Face ID: attributes only, with interaction not allowed
    static func exists() throws -> Bool {
        let context = LAContext()
        context.interactionNotAllowed = true
        var query = item()
        query[kSecReturnAttributes as String] = true
        query[kSecUseAuthenticationContext as String] = context
        switch SecItemCopyMatching(query as CFDictionary, nil) {
        case errSecSuccess, errSecInteractionNotAllowed: return true
        case errSecItemNotFound: return false
        case let status: throw VaultError.keychain(status)
        }
    }

    /// The Keychain outlives the app. A fresh install starts empty, as a freshly installed extension does: the first
    /// launch (no marker in UserDefaults, which deleting the app clears) removes any wallet left behind.
    static func forgetPreviousInstall() throws {
        let marker = "rocks.charisma.blazewallet.installed"
        guard !UserDefaults.standard.bool(forKey: marker) else { return }
        try delete()
        UserDefaults.standard.set(true, forKey: marker)
    }

    private static func check(_ status: OSStatus) throws {
        switch status {
        case errSecSuccess: return
        case errSecUserCanceled: throw VaultError.cancelled
        default: throw VaultError.keychain(status)
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/Vault/Vault.swift`:

```swift
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

    /// Forgets the wallet until the next unlock
    func lock() {
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
                } else if let error = error as? LAError, [.userCancel, .appCancel, .systemCancel].contains(error.code) {
                    continuation.resume(throwing: VaultError.cancelled)
                } else {
                    continuation.resume(throwing: VaultError.authenticationUnavailable)
                }
            }
        }
        return context
    }
}
```

- [ ] **The app shell: entry, root, privacy cover, lock screen, Welcome**

`apps/blaze-ios/BlazeWallet/App/BlazeWalletApp.swift`:

```swift
import SwiftUI

@main
struct BlazeWalletApp: App {
    @State private var vault = Vault()
    @AppStorage(Theme.storageKey) private var theme = Theme.Choice.system
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(vault)
                .preferredColorScheme(theme.colorScheme)
                .tint(.brand("accent"))
        }
        .onChange(of: scenePhase) { _, phase in
            // Leaving the app locks the wallet
            if phase == .background { vault.lock() }
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/App/RootView.swift`:

```swift
import SwiftUI

/// No wallet → Welcome; locked → the lock screen; unlocked → the wallet. While the app isn't active a cover hides
/// everything, so the app switcher's snapshot never shows balances or words.
struct RootView: View {
    @Environment(Vault.self) private var vault
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch vault.phase {
            case .checking: checking
            case .empty: WelcomeView()
            case .locked: LockView()
            case .unlocked: MainView()
            }
        }
        .brandFont(.body)
        .overlay {
            if scenePhase != .active { PrivacyCover() }
        }
        .task { vault.start() }
        .task(id: vault.locksAt) {
            // The 15-minute idle lock, right when it's due. Each action moves `locksAt`, which restarts this.
            guard let locksAt = vault.locksAt,
                  (try? await Task.sleep(for: .seconds(max(0, locksAt.timeIntervalSinceNow)))) != nil else { return }
            vault.lockIfIdle()
        }
    }

    @ViewBuilder private var checking: some View {
        if let error = vault.startError {
            VStack(spacing: 16) {
                ErrorText(error: error)
                Button("Try again") { vault.start() }.buttonStyle(.borderedProminent)
            }
            .padding()
        } else {
            ProgressView()
        }
    }
}

/// The unlocked wallet: three tabs with an active account; only Wallet without one (every seed phrase unlinked)
struct MainView: View {
    @Environment(Vault.self) private var vault

    var body: some View {
        if let account = vault.state?.activeAccount {
            TabView {
                Tab("Wallet", systemImage: "wallet.bifold") { WalletTab() }
                Tab("Tokens", systemImage: "circle.grid.2x2") { TokensTab(account: account).id(account.id) }
                Tab("Status", systemImage: "waveform.path.ecg") { StatusTab(account: account).id(account.id) }
            }
        } else {
            WalletTab()
        }
    }
}

/// The Lock button every tab's toolbar has
struct LockButton: ToolbarContent {
    @Environment(Vault.self) private var vault

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button("Lock", systemImage: "lock") { vault.lock() }
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/App/PrivacyCover.swift`:

```swift
import SwiftUI

/// What the app switcher shows: the flame on the brand background, never the wallet
struct PrivacyCover: View {
    var body: some View {
        ZStack {
            Color.brand("bg").ignoresSafeArea()
            Image("BlazeFlame").resizable().scaledToFit().frame(width: 64)
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/App/LockView.swift`:

```swift
import SwiftUI

/// Asks for Face ID on appear, and again from the button
struct LockView: View {
    @Environment(Vault.self) private var vault
    @State private var error: Error?

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image("BlazeFlame").resizable().scaledToFit().frame(width: 72)
            Text(verbatim: "Blaze Wallet").brandFont(.largeTitle, weight: .bold)
            Spacer()
            ErrorText(error: error)
            Button { Task { await unlock() } } label: {
                Label("Unlock", systemImage: "faceid").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(24)
        .background(Color.brand("bg"))
        .task { await unlock() }
    }

    private func unlock() async {
        error = nil
        do {
            try await vault.unlock()
        } catch VaultError.cancelled {
            // Dismissed: stay on the lock screen
        } catch {
            self.error = error
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/App/WelcomeView.swift`:

```swift
import SwiftUI

/// No wallet on this iPhone yet: make a new seed phrase or bring one
struct WelcomeView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Spacer()
                Image("BlazeFlame").resizable().scaledToFit().frame(width: 72)
                Text(verbatim: "Blaze Wallet").brandFont(.largeTitle, weight: .bold)
                Text("Your keys stay on this iPhone, behind Face ID.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.brand("ink-muted"))
                Spacer()
                NavigationLink { NewSeedFlow(mode: .createWallet) } label: {
                    Text("Create a new wallet").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                NavigationLink { ImportSeedView(mode: .createWallet) } label: {
                    Text("Import a seed phrase").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                // The lighter accent keeps the label readable on the tinted button in both themes
                .tint(.brand("accent-text"))
            }
            .padding(24)
            .background(Color.brand("bg"))
        }
    }
}
```

- [ ] **The Wallet tab and seed phrases**

`apps/blaze-ios/BlazeWallet/Wallet/SeedPhraseSaving.swift`:

```swift
import SwiftUI
import WalletCore

/// Where new seed words go: the first ones create the wallet (Face ID once), later ones join it
enum SeedMode {
    case createWallet
    case addToWallet

    @MainActor
    func save(name: String, words: String, in vault: Vault) async throws {
        switch self {
        case .createWallet: try await vault.create(name: name, words: words)
        case .addToWallet: try vault.act { try $0.addSeedPhrase(name: name, words: words) }
        }
    }
}

extension View {
    /// Seed words come from the English list: no capitals, autocorrect or full-width letters
    func seedWordInput() -> some View {
        keyboardType(.asciiCapable)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .monoFont(.body)
    }
}

/// Numbered words, two columns
struct SeedWordsGrid: View {
    let words: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 10) {
            ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                HStack(spacing: 8) {
                    Text(verbatim: String(index + 1)).monoFont(.caption).foregroundStyle(.brand("ink-faint")).frame(width: 24, alignment: .trailing)
                    Text(word).monoFont(.body)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
```
`apps/blaze-ios/BlazeWallet/Wallet/NewSeedFlow.swift`:

```swift
import StacksKit
import SwiftUI
import WalletCore

/// A new seed phrase: name it, write the 24 words down, confirm three of them. Nothing is saved until confirmed, so
/// no wallet ever exists with words nobody wrote down.
struct NewSeedFlow: View {
    let mode: SeedMode
    var onDone: () -> Void = {}

    @Environment(Vault.self) private var vault
    @State private var step = Step.name
    @State private var name = ""
    @State private var words: [String] = []
    @State private var wroteDown = false
    @State private var checks: [Int] = []
    @State private var answers: [Int: String] = [:]
    @State private var saving = false
    @State private var error: Error?

    private enum Step { case name, words, confirm }

    var body: some View {
        Form {
            switch step {
            case .name: nameStep
            case .words: wordsStep
            case .confirm: confirmStep
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.brand("bg"))
        .navigationTitle(step == .name ? "New seed phrase" : step == .words ? "Write these down" : "Confirm your words")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder private var nameStep: some View {
        Section("Name") {
            TextField("My seed phrase", text: $name)
        }
        Section {
            ErrorText(error: error)
            Button("Generate 24 words", action: generate)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    @ViewBuilder private var wordsStep: some View {
        Section {
            Text("These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.")
                .foregroundStyle(.brand("warning"))
        }
        Section { SeedWordsGrid(words: words) }
        Section {
            Toggle("I wrote all 24 words down, in order", isOn: $wroteDown)
            Button("Continue") { step = .confirm }.disabled(!wroteDown)
        }
    }

    @ViewBuilder private var confirmStep: some View {
        Section {
            Text("Type these words from what you wrote down.")
        }
        ForEach(checks, id: \.self) { position in
            Section("Word #\(position)") {
                TextField(String(), text: Binding(get: { answers[position] ?? "" }, set: { answers[position] = $0 }))
                    .seedWordInput()
            }
        }
        Section {
            ErrorText(error: error)
            Button {
                Task { await save() }
            } label: {
                if saving { ProgressView() } else { Text("Confirm and save") }
            }
            .disabled(saving || checks.contains { (answers[$0] ?? "").trimmingCharacters(in: .whitespaces).isEmpty })
            Button("Back to the words") { step = .words }
        }
    }

    private func generate() {
        error = nil
        do {
            words = try Mnemonic.generate().split(separator: " ").map(String.init)
            // Three distinct positions, from the system's secure random generator
            checks = Array((1...words.count).shuffled().prefix(3)).sorted()
            answers = [:]
            step = .words
        } catch {
            self.error = error
        }
    }

    private func save() async {
        error = nil
        let wrong = checks.filter { Mnemonic.normalize(answers[$0] ?? "") != words[$0 - 1] }
        guard wrong.isEmpty else {
            error = AppError.wordsDontMatch(wrong)
            return
        }
        saving = true
        defer { saving = false }
        do {
            try await mode.save(name: name, words: words.joined(separator: " "), in: vault)
            onDone()
        } catch VaultError.cancelled {
            // Face ID dismissed: stay here so the person can try again
        } catch {
            self.error = error
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/Wallet/ImportSeedView.swift`:

```swift
import SwiftUI
import WalletCore

/// Bring an existing seed phrase: a name and its words
struct ImportSeedView: View {
    let mode: SeedMode
    var onDone: () -> Void = {}

    @Environment(Vault.self) private var vault
    @State private var name = ""
    @State private var words = ""
    @State private var saving = false
    @State private var error: Error?

    var body: some View {
        Form {
            Section("Name") {
                TextField("My seed phrase", text: $name)
            }
            Section {
                TextEditor(text: $words)
                    .seedWordInput()
                    .frame(minHeight: 120)
            } header: {
                Text("12 or 24 words")
            }
            Section {
                ErrorText(error: error)
                Button {
                    Task { await save() }
                } label: {
                    if saving { ProgressView() } else { Text("Import") }
                }
                .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty || words.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.brand("bg"))
        .navigationTitle("Import a seed phrase")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func save() async {
        error = nil
        saving = true
        defer { saving = false }
        do {
            try await mode.save(name: name, words: words, in: vault)
            onDone()
        } catch VaultError.cancelled {
            // Face ID dismissed: stay here
        } catch {
            self.error = error
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/Wallet/WalletTab.swift`:

```swift
import SwiftUI
import WalletCore

/// Seed phrases, accounts and the vault's settings (the extension's WalletTab)
struct WalletTab: View {
    @Environment(Vault.self) private var vault
    @AppStorage(Theme.storageKey) private var theme = Theme.Choice.system
    @State private var sheet: Sheet?
    @State private var unlinking: SeedPhrase?
    @State private var unlinkingWallet = false
    @State private var error: Error?

    private enum Sheet: Identifiable {
        case newSeed, importSeed, receive(Account), words(name: String, phrase: String)

        var id: String {
            switch self {
            case .newSeed: "new"
            case .importSeed: "import"
            case .receive(let account): "receive-\(account.id)"
            case .words(let name, _): "words-\(name)"
            }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                activeAccount
                seedPhrases
                vaultSection
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Wallet")
            .toolbar { LockButton() }
            .sheet(item: $sheet, content: sheetView)
            .confirmationDialog("Unlink this seed phrase from this iPhone?", isPresented: Binding(get: { unlinking != nil }, set: { if !$0 { unlinking = nil } }), titleVisibility: .visible, presenting: unlinking) { seed in
                Button("Unlink", role: .destructive) { run { try vault.act { $0.unlinkSeedPhrase(id: seed.id) } } }
            } message: { _ in
                Text("Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.")
            }
            .confirmationDialog("Unlink this wallet from this iPhone?", isPresented: $unlinkingWallet, titleVisibility: .visible) {
                Button("Unlink wallet", role: .destructive) { run { try vault.unlinkWallet() } }
            } message: {
                Text("Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.")
            }
        }
    }

    @ViewBuilder private var activeAccount: some View {
        Section {
            if let account = vault.state?.activeAccount {
                HStack {
                    Text("Account \(Int(account.index) + 1)").brandFont(.headline, weight: .semibold)
                    Spacer()
                    Text("Active").brandFont(.caption, weight: .semibold).foregroundStyle(.brand("success"))
                }
                Text(account.stxAddress).monoFont(.callout).textSelection(.enabled)
                HStack {
                    CopyButton(text: account.stxAddress)
                    Spacer()
                    Button("Receive", systemImage: "qrcode") { sheet = .receive(account) }
                }
                .buttonStyle(.borderless)
            } else {
                Text("No active account").brandFont(.headline, weight: .semibold)
                Text("Add an account from a seed phrase below.").foregroundStyle(.brand("warning"))
            }
        }
    }

    @ViewBuilder private var seedPhrases: some View {
        Section("Seed phrases") {
            ForEach(vault.state?.seedPhrases ?? []) { seed in
                SeedPhraseCard(
                    seed: seed,
                    accounts: vault.state?.accounts(of: seed.id) ?? [],
                    activeAccountId: vault.state?.activeAccountId,
                    use: { account in run { try vault.act { try $0.activate(accountId: account.id) } } },
                    addAccount: { run { _ = try vault.act { try $0.addAccount(seedPhraseId: seed.id) } } },
                    showWords: { reveal(seed) },
                    unlink: { unlinking = seed }
                )
            }
            Button("Generate new") { sheet = .newSeed }
            Button("Import") { sheet = .importSeed }
        }
    }

    @ViewBuilder private var vaultSection: some View {
        Section("Vault") {
            LabeledContent { Text("On this iPhone only, behind Face ID") } label: { Text("Keys") }
            LabeledContent { Text("After 15 idle minutes") } label: { Text("Auto-lock") }
            Picker("Theme", selection: $theme) {
                Text("System").tag(Theme.Choice.system)
                Text("Light · Bitcoin").tag(Theme.Choice.light)
                Text("Dark · RPG").tag(Theme.Choice.dark)
            }
            ErrorText(error: error)
            Button("Lock") { vault.lock() }
            Button("Unlink wallet", role: .destructive) { unlinkingWallet = true }
        }
    }

    @ViewBuilder private func sheetView(_ sheet: Sheet) -> some View {
        switch sheet {
        case .newSeed:
            NavigationStack { NewSeedFlow(mode: .addToWallet) { self.sheet = nil } }
        case .importSeed:
            NavigationStack { ImportSeedView(mode: .addToWallet) { self.sheet = nil } }
        case .receive(let account):
            ReceiveSheet(address: account.stxAddress)
        case .words(let name, let phrase):
            SeedWordsSheet(name: name, words: phrase.split(separator: " ").map(String.init))
        }
    }

    /// Runs a wallet change, showing its error instead of losing it
    private func run(_ change: () throws -> Void) {
        error = nil
        do { try change() } catch { self.error = error }
    }

    private func reveal(_ seed: SeedPhrase) {
        Task {
            error = nil
            do {
                sheet = .words(name: seed.name, phrase: try await vault.revealWords(of: seed.id))
            } catch VaultError.cancelled {
                // Dismissed
            } catch {
                self.error = error
            }
        }
    }
}

/// One seed phrase: its accounts (Use / Active), + Account, Show words and Unlink
private struct SeedPhraseCard: View {
    let seed: SeedPhrase
    let accounts: [Account]
    let activeAccountId: String?
    let use: (Account) -> Void
    let addAccount: () -> Void
    let showWords: () -> Void
    let unlink: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(seed.name).brandFont(.headline, weight: .semibold)
            ForEach(accounts) { account in
                AccountRow(account: account, isActive: account.id == activeAccountId) { use(account) }
            }
            HStack {
                Button("+ Account", action: addAccount)
                Spacer()
                Button("Show words", action: showWords)
                Spacer()
                Button("Unlink", role: .destructive, action: unlink)
            }
        }
        .buttonStyle(.borderless)
        .padding(.vertical, 4)
    }
}

/// "Account N", its short address, and Active or Use
private struct AccountRow: View {
    let account: Account
    let isActive: Bool
    let use: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text("Account \(Int(account.index) + 1)")
                Text(Format.short(account.stxAddress)).monoFont(.caption).foregroundStyle(.brand("ink-muted"))
            }
            Spacer()
            if isActive {
                Text("Active").brandFont(.caption, weight: .semibold).foregroundStyle(.brand("success"))
            } else {
                Button("Use", action: use)
            }
        }
    }
}

/// Copies text, then says so for two seconds
struct CopyButton: View {
    let text: String
    @State private var copied = false

    var body: some View {
        Button(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc") {
            UIPasteboard.general.string = text
            copied = true
            Task {
                try? await Task.sleep(for: .seconds(2))
                copied = false
            }
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/Wallet/ReceiveSheet.swift`:

```swift
import CoreImage.CIFilterBuiltins
import SwiftUI

/// The account's address as a QR code, with Copy and Share
struct ReceiveSheet: View {
    let address: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                if let code = Self.qrCode(address) {
                    Image(uiImage: code)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 240)
                        .padding(16)
                        .background(.white, in: RoundedRectangle(cornerRadius: 16))
                }
                Text(address).monoFont(.callout).multilineTextAlignment(.center).textSelection(.enabled)
                HStack(spacing: 16) {
                    CopyButton(text: address).buttonStyle(.bordered)
                    ShareLink(item: address).buttonStyle(.bordered)
                }
                Text("Send only Stacks (STX) and Stacks tokens to this address.")
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.brand("bg"))
            .navigationTitle("Receive")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    private static func qrCode(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let image = CIContext().createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: image)
    }
}
```
`apps/blaze-ios/BlazeWallet/Wallet/SeedWordsSheet.swift`:

```swift
import SwiftUI

/// A seed phrase's words, shown after a fresh Face ID check
struct SeedWordsSheet: View {
    let name: String
    let words: [String]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Anyone who sees these words controls your funds. Write them down on paper and keep them private.")
                        .foregroundStyle(.brand("warning"))
                }
                Section { SeedWordsGrid(words: words) }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle(name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
```

- [ ] **The Tokens tab and Send**

`apps/blaze-ios/BlazeWallet/Tokens/TokensModel.swift`:

```swift
import Foundation
import Observation
import WalletCore

/// The active account's token rows and prices, kept live by the balance stream while the Tokens tab is on screen
@MainActor @Observable
final class TokensModel {
    let address: String
    private(set) var rows: [TokenRow]?
    private(set) var prices: [String: Double]?
    private(set) var error: Error?
    private(set) var priceError: Error?

    private let charisma = Charisma()
    private var list: [TokenInfo] = []
    /// Tokens not on the list, looked up once each; a failed lookup leaves the token unknown (Charisma.lookUp logs it)
    private var lookups: [String: TokenInfo] = [:]
    private var lookedUp: Set<String> = []

    init(address: String) {
        self.address = address
    }

    var listed: [TokenRow] { rows?.filter(\.listed) ?? [] }
    var unlisted: [TokenRow] { rows?.filter { !$0.listed } ?? [] }

    /// The Standard STX balance, which pays every network fee
    var stxBalance: Int128 { rows?.first(where: \.isSTX)?.standard ?? 0 }

    /// USD value of a row, or nil when the feed has no price for it
    func value(of row: TokenRow) -> Double? {
        guard let meta = row.meta, let price = prices?[row.contractId] else { return nil }
        return Amount.units(row.total, decimals: meta.decimals) * price
    }

    var totalValue: Double { listed.compactMap(value(of:)).reduce(0, +) }
    var unpricedCount: Int { listed.filter { value(of: $0) == nil }.count }

    /// Balances and prices from scratch. Prices are separate: balances still show when the price feed is down.
    func load() async {
        error = nil
        priceError = nil
        async let prices = charisma.usdPrices()
        do {
            async let sheet = charisma.balanceSheet(address: address)
            list = try await charisma.tokenList()
            await show(try await sheet)
        } catch is CancellationError {
            // The tab went away or refreshed again
        } catch {
            self.error = error
        }
        do {
            self.prices = try await prices
        } catch is CancellationError {
        } catch {
            priceError = error
        }
    }

    /// Every sheet the service pushes, until the tab goes away
    func watch() async {
        for await sheet in charisma.watchBalances(address: address) where !list.isEmpty {
            await show(sheet)
        }
    }

    private func show(_ sheet: BalanceSheet) async {
        let missing = TokenRows.unlisted(sheet: sheet, list: list).filter { !lookedUp.contains($0) }
        if !missing.isEmpty {
            lookups.merge(await charisma.lookUp(missing)) { kept, _ in kept }
            lookedUp.formUnion(missing)
        }
        rows = TokenRows.build(sheet: sheet, list: list, lookups: lookups)
    }
}
```
`apps/blaze-ios/BlazeWallet/Tokens/TokensTab.swift`:

```swift
import SwiftUI
import WalletCore

/// The active account's tokens: one total per token across Standard and Blaze, live, and sending them
struct TokensTab: View {
    let account: Account

    @State private var model: TokensModel
    @State private var sending: TokenRow?
    @State private var reason: TokenRow?
    @State private var showUnlisted = false

    init(account: Account) {
        self.account = account
        _model = State(initialValue: TokensModel(address: account.stxAddress))
    }

    var body: some View {
        NavigationStack {
            List {
                totalSection
                if let error = model.error {
                    Section { ErrorText(error: error) }
                }
                if let priceError = model.priceError {
                    Section {
                        Text("Prices unavailable: \(ErrorWords.message(priceError))").foregroundStyle(.brand("warning"))
                    }
                }
                if model.rows != nil {
                    Section {
                        ForEach(model.listed) { row(for: $0) }
                    }
                    if !model.unlisted.isEmpty {
                        Section {
                            DisclosureGroup(isExpanded: $showUnlisted) {
                                ForEach(model.unlisted) { row(for: $0) }
                            } label: {
                                Text("\(model.unlisted.count) unlisted · not on Charisma's token list, may be scams")
                                    .brandFont(.subheadline)
                                    .foregroundStyle(.brand("ink-muted"))
                            }
                        }
                    }
                } else if model.error == nil {
                    Section {
                        HStack(spacing: 12) {
                            ProgressView()
                            Text("Loading balances…").foregroundStyle(.brand("ink-muted"))
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Tokens")
            .toolbar { LockButton() }
            .refreshable { await model.load() }
            .task { await model.load() }
            .task { await model.watch() }
            .sheet(item: $sending) { row in
                SendSheet(row: row, account: account, stxBalance: model.stxBalance)
            }
            .alert(reason.map(Format.symbol) ?? "", isPresented: Binding(get: { reason != nil }, set: { if !$0 { reason = nil } }), presenting: reason) { _ in
                Button("OK") {}
            } message: { row in
                Text(Self.unsendableReason(row))
            }
        }
    }

    @ViewBuilder private var totalSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text("Total value").brandFont(.caption, weight: .semibold).foregroundStyle(.brand("ink-muted"))
                Text(model.rows != nil && model.prices != nil ? Format.usd(model.totalValue) : "…")
                    .monoFont(.largeTitle, weight: .medium)
                    .contentTransition(.numericText())
                if model.rows != nil {
                    Text(summary).brandFont(.footnote).foregroundStyle(.brand("ink-muted"))
                }
            }
            .padding(.vertical, 6)
        }
    }

    private var summary: String {
        let tokens = String(localized: "\(model.listed.count) tokens")
        guard model.prices != nil, model.unpricedCount > 0 else { return tokens }
        return tokens + " · " + String(localized: "\(model.unpricedCount) without a price")
    }

    private func row(for row: TokenRow) -> some View {
        Button {
            if row.unsendable == nil { sending = row } else { reason = row }
        } label: {
            TokenRowView(row: row, value: model.value(of: row), pricesLoaded: model.prices != nil)
        }
        .buttonStyle(.plain)
    }

    /// Why a row can't be sent from here
    static func unsendableReason(_ row: TokenRow) -> String {
        let symbol = Format.symbol(row)
        switch row.unsendable {
        case .unlisted: return String(localized: "Not on Charisma's token list, so it can't be sent from here.")
        case .unknown: return String(localized: "An unknown token: shown in its smallest units, and it can't be sent from here.")
        case .missingAssetName: return String(localized: "Charisma's token list has no asset name for \(symbol), so it can't be sent safely.")
        case .onlyOnBlaze: return String(localized: "Your \(symbol) is all on Blaze. Move it with Charisma Swap.")
        case .nothingToSend: return String(localized: "You have no \(symbol) to send yet.")
        case nil: return ""
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/Tokens/TokenRowView.swift`:

```swift
import SwiftUI
import WalletCore

/// One token: icon, symbol, "X on Blaze" or its name, the total (cut to 6 decimals) and its USD value
struct TokenRowView: View {
    let row: TokenRow
    let value: Double?
    let pricesLoaded: Bool

    var body: some View {
        HStack(spacing: 12) {
            TokenIcon(row: row)
            VStack(alignment: .leading, spacing: 2) {
                Text(Format.symbol(row)).brandFont(.body, weight: .semibold)
                if row.blaze != 0, row.meta != nil {
                    Label {
                        Text("\(Format.amount(row.blaze, of: row, precision: .cut(6))) on Blaze")
                    } icon: {
                        Image(systemName: "flame.fill")
                    }
                    .labelStyle(.titleAndIcon)
                    .brandFont(.caption)
                    .foregroundStyle(.brand("blaze"))
                } else {
                    Text(row.meta?.name ?? row.contractId)
                        .brandFont(.caption)
                        .foregroundStyle(.brand("ink-muted"))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(Format.amount(row.total, of: row, precision: .cut(6)))
                    .monoFont(.body)
                    .contentTransition(.numericText())
                if pricesLoaded {
                    Text(value.map(Format.usd) ?? "—").monoFont(.caption).foregroundStyle(.brand("ink-muted"))
                }
            }
        }
        .contentShape(Rectangle())
        .padding(.vertical, 4)
    }
}

/// The token's image, or its first letter when there's none or it fails to load (as in the extension)
struct TokenIcon: View {
    let row: TokenRow

    var body: some View {
        AsyncImage(url: row.meta?.image) { phase in
            if case .success(let image) = phase {
                image.resizable().scaledToFill()
            } else {
                Text(Format.symbol(row).prefix(1).uppercased())
                    .brandFont(.headline, weight: .semibold)
                    .foregroundStyle(.brand("ink-muted"))
            }
        }
        .frame(width: 36, height: 36)
        .background(Color.brand("surface-sunken"))
        .clipShape(Circle())
    }
}
```
`apps/blaze-ios/BlazeWallet/Tokens/SendSheet.swift`:

```swift
import SwiftUI
import WalletCore

/// Sending from the Standard balance: recipient and amount, a review with the real network fee, then the txid
struct SendSheet: View {
    let row: TokenRow
    let account: Account
    /// The Standard STX balance, which pays the fee
    let stxBalance: Int128

    @Environment(Vault.self) private var vault
    @Environment(\.dismiss) private var dismiss
    @State private var recipient = ""
    @State private var amount = ""
    @State private var review: SendReview?
    @State private var txid: String?
    @State private var busy = false
    @State private var error: Error?
    private let hiro = Hiro()

    var body: some View {
        NavigationStack {
            Form {
                if let txid { sent(txid) } else if let review { reviewing(review) } else { form }
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle(txid != nil ? "\(Format.symbol(row)) sent" : "Send \(Format.symbol(row))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if txid == nil {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                }
            }
            .interactiveDismissDisabled(busy)
        }
    }

    @ViewBuilder private var form: some View {
        Section("Recipient") {
            TextField(text: $recipient, prompt: Text(verbatim: "SP…")) { EmptyView() }
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .monoFont(.callout)
        }
        Section("Amount") {
            HStack {
                TextField("0" + Amount.decimalMark(.current) + "0 " + Format.symbol(row), text: $amount)
                    .keyboardType(.decimalPad)
                    .monoFont(.body)
                Button("Max") {
                    amount = Amount.editable(max(row.standard, 0), decimals: row.meta?.decimals ?? 0, locale: .current)
                }
                .buttonStyle(.bordered)
            }
            if row.blaze != 0 {
                Text("Sends use your \(Format.amount(row.standard, of: row, precision: .cut(6))) \(Format.symbol(row)) on Standard. Your \(Format.amount(row.blaze, of: row, precision: .cut(6))) on Blaze stays in its subnet; move it with Charisma Swap.")
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
            }
        }
        Section {
            ErrorText(error: error, row: row)
            if case .notEnoughSTXForFee(_, _, let most?)? = error as? WalletError, most > 0 {
                Button("Send the most: \(Format.stx(most)) STX") {
                    amount = Amount.editable(most, decimals: 6, locale: .current)
                    error = nil
                }
            }
            Button {
                Task { await check() }
            } label: {
                if busy { ProgressView() } else { Text("Review") }
            }
            .disabled(busy || recipient.isEmpty || amount.isEmpty)
        }
    }

    @ViewBuilder private func reviewing(_ review: SendReview) -> some View {
        Section {
            LabeledContent { Text(verbatim: "\(Format.amount(review.amount, of: row, precision: .exact)) \(Format.symbol(row))").monoFont(.body) } label: { Text("Send") }
            LabeledContent { Text(review.recipient.description).monoFont(.caption).multilineTextAlignment(.trailing) } label: { Text("To") }
            LabeledContent { Text(verbatim: "\(Format.stx(review.fee)) STX").monoFont(.body) } label: { Text("Network fee") }
            if !row.isSTX {
                LabeledContent { Text("Exactly this amount, nothing else").foregroundStyle(.brand("success")) } label: { Text("Safety") }
            }
        }
        Section {
            ErrorText(error: error, row: row)
            Button {
                Task { await send(review) }
            } label: {
                if busy { ProgressView() } else { Text("Send") }
            }
            .disabled(busy)
            Button("Back") { self.review = nil }.disabled(busy)
        }
    }

    @ViewBuilder private func sent(_ txid: String) -> some View {
        Section {
            Text("It confirms on Stacks in a few minutes.")
            Link(destination: Format.explorer(txid)) {
                Label("View on explorer", systemImage: "arrow.up.right.square")
            }
        }
        Section {
            Button("Done") { dismiss() }
        }
    }

    private func check() async {
        error = nil
        busy = true
        defer { busy = false }
        do {
            review = try await Send.review(
                row: row, recipient: recipient, amount: amount, stxBalance: stxBalance,
                account: account, locale: .current, hiro: hiro
            )
        } catch {
            self.error = error
        }
    }

    private func send(_ review: SendReview) async {
        error = nil
        busy = true
        defer { busy = false }
        do {
            try vault.touch()
            txid = try await Send.send(review, from: account, hiro: hiro)
        } catch {
            self.error = error
        }
    }
}
```

- [ ] **The Status tab**

`apps/blaze-ios/BlazeWallet/Status/StatusModel.swift`:

```swift
import Foundation
import Observation
import StacksKit
import WalletCore

/// Status's checks, refreshed when the tab appears and every 5 minutes while it's on screen
@MainActor @Observable
final class StatusModel {
    private(set) var diagnostics: Diagnostics?
    private(set) var error: Error?
    private(set) var checking = false

    private let charisma = Charisma()
    private let hiro = Hiro()
    private let subnets: SubnetReader

    init() {
        subnets = SubnetReader(hiro: hiro)
    }

    func check(address: String) async {
        error = nil
        checking = true
        defer { checking = false }
        do {
            diagnostics = try await Diagnostics.check(address: StacksAddress(address), charisma: charisma, hiro: hiro, subnets: subnets)
        } catch is CancellationError {
            // The tab went away
        } catch {
            self.error = error
        }
    }
}
```
`apps/blaze-ios/BlazeWallet/Status/StatusTab.swift`:

```swift
import SwiftUI
import WalletCore

/// Is everything working? The Stacks network, Charisma's token list, every Blaze subnet, and the auto-lock timer
struct StatusTab: View {
    let account: Account

    @Environment(Vault.self) private var vault
    @State private var model = StatusModel()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        if let checkedAt = model.diagnostics?.checkedAt {
                            Text("Checked at \(checkedAt.formatted(date: .omitted, time: .shortened))")
                        } else {
                            Text("Checking…")
                        }
                        Spacer()
                        Button {
                            Task { await model.check(address: account.stxAddress) }
                        } label: {
                            if model.checking { ProgressView() } else { Label("Check again", systemImage: "arrow.clockwise") }
                        }
                        .disabled(model.checking)
                    }
                    .brandFont(.footnote)
                    .foregroundStyle(.brand("ink-muted"))
                }
                if let error = model.error {
                    Section("Something isn't working") { ErrorText(error: error) }
                }
                networkSection
                tokenListSection
                subnetsSection
                walletSection
            }
            .scrollContentBackground(.hidden)
            .background(Color.brand("bg"))
            .navigationTitle("Status")
            .toolbar { LockButton() }
            .task {
                while !Task.isCancelled {
                    await model.check(address: account.stxAddress)
                    try? await Task.sleep(for: .seconds(5 * 60))
                }
            }
        }
    }

    private var state: (text: LocalizedStringKey, tone: String) {
        if model.error != nil { return ("Error", "danger") }
        return model.diagnostics == nil ? ("Checking", "warning") : ("Live", "success")
    }

    @ViewBuilder private var networkSection: some View {
        Section {
            LabeledContent { Text(model.diagnostics.map { $0.blockHeight.formatted() } ?? "—").monoFont(.body) } label: { Text("Block") }
            if let diagnostics = model.diagnostics { Speed(latency: diagnostics.networkLatency) }
        } header: {
            HStack {
                Text("Stacks network")
                Spacer()
                Text(state.text).foregroundStyle(.brand(state.tone))
            }
        }
    }

    @ViewBuilder private var tokenListSection: some View {
        Section("Charisma token list") {
            LabeledContent { Text(model.diagnostics.map { $0.tokenCount.formatted() } ?? "—").monoFont(.body) } label: { Text("Tokens") }
            if let diagnostics = model.diagnostics { Speed(latency: diagnostics.tokenListLatency) }
        }
    }

    @ViewBuilder private var subnetsSection: some View {
        let held: [SubnetBalance] = (model.diagnostics?.subnets ?? []).filter { ($0.balance ?? 0) != 0 }
        Section {
            LabeledContent { Text(model.diagnostics == nil ? "—" : held.count.formatted()).monoFont(.body) } label: { Text("Holding your funds") }
            if let diagnostics = model.diagnostics {
                if held.isEmpty {
                    Text("No funds on any of the \(diagnostics.subnets.count) subnets.").foregroundStyle(.brand("ink-muted"))
                }
                ForEach(held) { subnet in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(subnet.symbol).brandFont(.body, weight: .semibold)
                            Text(subnet.contractId.split(separator: ".").last.map(String.init) ?? subnet.contractId)
                                .brandFont(.caption).foregroundStyle(.brand("ink-muted"))
                        }
                        Spacer()
                        Text(Amount.format(subnet.balance ?? 0, decimals: subnet.decimals, precision: .rounded(4), locale: .current)).monoFont(.body)
                    }
                }
            }
        } header: {
            HStack {
                Text("Blaze subnets")
                Spacer()
                if let count = model.diagnostics?.subnets.count { Text(count.formatted()) }
            }
        }
    }

    @ViewBuilder private var walletSection: some View {
        Section("This wallet") {
            LabeledContent { Text(Format.short(account.stxAddress)).monoFont(.body) } label: { Text("Address") }
            TimelineView(.periodic(from: .now, by: 30)) { context in
                let minutes = vault.locksAt.map { max(0, Int(($0.timeIntervalSince(context.date) / 60).rounded(.up))) }
                VStack(alignment: .leading, spacing: 6) {
                    LabeledContent {
                        if let minutes { Text("In \(minutes) min") } else { Text(verbatim: "—") }
                    } label: { Text("Auto-lock") }
                    if let minutes { ProgressView(value: Double(minutes), total: 15) }
                }
            }
        }
    }
}

/// How fast a server answered: instant is a full bar, 2 seconds or slower an empty one
private struct Speed: View {
    let latency: Duration

    var body: some View {
        let ms = Int(latency / .milliseconds(1))
        let tone = ms < 600 ? "success" : ms < 1500 ? "warning" : "danger"
        VStack(alignment: .leading, spacing: 6) {
            LabeledContent { Text(verbatim: "\(ms.formatted()) ms").monoFont(.body).foregroundStyle(.brand(tone)) } label: { Text("Response") }
            ProgressView(value: max(4, min(100, 100 - Double(ms) / 20)), total: 100).tint(.brand(tone))
        }
    }
}
```

- [ ] **The String Catalogs**

`apps/blaze-ios/BlazeWallet/Localizable.xcstrings`:

```json
{
  "sourceLanguage" : "en",
  "strings" : {
    "%@ on Blaze" : {

    },
    "%@ sent" : {

    },
    "%@ units" : {

    },
    "%lld tokens" : {
      "localizations" : {
        "en" : {
          "variations" : {
            "plural" : {
              "one" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "%lld token"
                }
              },
              "other" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "%lld tokens"
                }
              }
            }
          }
        }
      }
    },
    "%lld unlisted · not on Charisma's token list, may be scams" : {
      "localizations" : {
        "en" : {
          "variations" : {
            "plural" : {
              "one" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "%lld unlisted · not on Charisma's token list, may be a scam"
                }
              },
              "other" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "%lld unlisted · not on Charisma's token list, may be scams"
                }
              }
            }
          }
        }
      }
    },
    "%lld without a price" : {
      "localizations" : {
        "en" : {
          "variations" : {
            "plural" : {
              "one" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "%lld without a price"
                }
              },
              "other" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "%lld without a price"
                }
              }
            }
          }
        }
      }
    },
    "+ Account" : {

    },
    "12 or 24 words" : {

    },
    "A seed phrase named “%@” already exists." : {

    },
    "Account %lld" : {

    },
    "Active" : {

    },
    "Add an account from a seed phrase below." : {

    },
    "Address" : {

    },
    "After 15 idle minutes" : {

    },
    "Amount" : {

    },
    "An unknown token: shown in its smallest units, and it can't be sent from here." : {

    },
    "Anyone who sees these words controls your funds. Write them down on paper and keep them private." : {

    },
    "At most %lld decimal places." : {
      "localizations" : {
        "en" : {
          "variations" : {
            "plural" : {
              "one" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "At most %lld decimal place."
                }
              },
              "other" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "At most %lld decimal places."
                }
              }
            }
          }
        }
      }
    },
    "Auto-lock" : {

    },
    "Back" : {

    },
    "Back to the words" : {

    },
    "Blaze subnets" : {

    },
    "Block" : {

    },
    "Cancel" : {

    },
    "Cancelled." : {

    },
    "Charisma token list" : {

    },
    "Charisma's balance service sent something Blaze Wallet can't read." : {

    },
    "Charisma's price feed sent something Blaze Wallet can't read." : {

    },
    "Charisma's token list has no asset name for %@, so it can't be sent safely." : {

    },
    "Charisma's token list is unavailable, so tokens can't be checked against its block list." : {

    },
    "Charisma's token list sent something Blaze Wallet can't read." : {

    },
    "Check again" : {

    },
    "Checked at %@" : {

    },
    "Checking" : {

    },
    "Checking…" : {

    },
    "Confirm and save" : {

    },
    "Confirm your words" : {

    },
    "Continue" : {

    },
    "Copied" : {

    },
    "Copy" : {

    },
    "Couldn't load Charisma's token list (%lld)." : {

    },
    "Couldn't load balances (%lld)." : {

    },
    "Couldn't load prices (%lld)." : {

    },
    "Couldn't reach Charisma's balance service. Check your connection." : {

    },
    "Couldn't reach Charisma's price feed. Check your connection." : {

    },
    "Couldn't reach Charisma's token list. Check your connection." : {

    },
    "Couldn't reach the Stacks network. Check your connection." : {

    },
    "Create a new wallet" : {

    },
    "Create your wallet" : {

    },
    "Dark · RPG" : {

    },
    "Done" : {

    },
    "Enter a Stacks address (SP…)." : {

    },
    "Enter an amount like %@." : {

    },
    "Error" : {

    },
    "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in." : {

    },
    "Exactly this amount, nothing else" : {

    },
    "Face ID and the passcode aren't available on this iPhone right now." : {

    },
    "Generate 24 words" : {

    },
    "Generate new" : {

    },
    "Holding your funds" : {

    },
    "I wrote all 24 words down, in order" : {

    },
    "Import" : {

    },
    "Import a seed phrase" : {

    },
    "In %lld min" : {
      "localizations" : {
        "en" : {
          "variations" : {
            "plural" : {
              "one" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "In %lld min"
                }
              },
              "other" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "In %lld min"
                }
              }
            }
          }
        }
      }
    },
    "It confirms on Stacks in a few minutes." : {

    },
    "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words." : {

    },
    "Keys" : {

    },
    "Light · Bitcoin" : {

    },
    "Live" : {

    },
    "Loading balances…" : {

    },
    "Lock" : {

    },
    "Max" : {

    },
    "My seed phrase" : {

    },
    "Name" : {

    },
    "Network fee" : {

    },
    "New seed phrase" : {

    },
    "No active account" : {

    },
    "No funds on any of the %lld subnets." : {
      "localizations" : {
        "en" : {
          "variations" : {
            "plural" : {
              "one" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "No funds on the %lld subnet."
                }
              },
              "other" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "No funds on any of the %lld subnets."
                }
              }
            }
          }
        }
      }
    },
    "Not enough STX for the network fee. You can send up to %@ STX." : {

    },
    "Not enough STX for the network fee: it's %@ STX and you have %@ STX." : {
      "localizations" : {
        "en" : {
          "stringUnit" : {
            "state" : "new",
            "value" : "Not enough STX for the network fee: it's %1$@ STX and you have %2$@ STX."
          }
        }
      }
    },
    "Not on Charisma's token list, so it can't be sent from here." : {

    },
    "OK" : {

    },
    "On this iPhone only, behind Face ID" : {

    },
    "Prices unavailable: %@" : {

    },
    "Receive" : {

    },
    "Recipient" : {

    },
    "Response" : {

    },
    "Review" : {

    },
    "Safety" : {

    },
    "Seed phrases" : {

    },
    "Send" : {

    },
    "Send %@" : {

    },
    "Send only Stacks (STX) and Stacks tokens to this address." : {

    },
    "Send the most: %@ STX" : {

    },
    "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap." : {
      "localizations" : {
        "en" : {
          "stringUnit" : {
            "state" : "new",
            "value" : "Sends use your %1$@ %2$@ on Standard. Your %3$@ on Blaze stays in its subnet; move it with Charisma Swap."
          }
        }
      }
    },
    "Set a passcode on this iPhone to use Blaze Wallet." : {

    },
    "Show words" : {

    },
    "Show your seed phrase" : {

    },
    "Something isn't working" : {

    },
    "Something went wrong: %@" : {

    },
    "Stacks network" : {

    },
    "Status" : {

    },
    "System" : {

    },
    "That account is no longer in this wallet." : {

    },
    "That isn't a valid seed phrase: check each word's spelling and that none are missing." : {

    },
    "That seed phrase is no longer in this wallet." : {

    },
    "That's more than you have." : {

    },
    "The Stacks network didn't answer (%lld)." : {

    },
    "The Stacks network sent something Blaze Wallet can't read." : {

    },
    "The amount must be more than zero." : {

    },
    "The network rejected the transfer: %@" : {

    },
    "The wallet is locked. Unlock it to continue." : {

    },
    "Theme" : {

    },
    "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them." : {

    },
    "This iPhone couldn't make random words. Try again." : {

    },
    "This iPhone's Keychain refused (%@)." : {

    },
    "This wallet" : {

    },
    "To" : {

    },
    "Tokens" : {

    },
    "Total value" : {

    },
    "Try again" : {

    },
    "Type these words from what you wrote down." : {

    },
    "Unlink" : {

    },
    "Unlink this seed phrase from this iPhone?" : {

    },
    "Unlink this wallet from this iPhone?" : {

    },
    "Unlink wallet" : {

    },
    "Unlock" : {

    },
    "Unlock your wallet" : {

    },
    "Use" : {

    },
    "Vault" : {

    },
    "View on explorer" : {

    },
    "Wallet" : {

    },
    "Word #%lld" : {

    },
    "Word %@ doesn't match. Check what you wrote down." : {

    },
    "Write these down" : {

    },
    "You have %@ %@." : {
      "localizations" : {
        "en" : {
          "stringUnit" : {
            "state" : "new",
            "value" : "You have %1$@ %2$@."
          }
        }
      }
    },
    "You have no %@ to send yet." : {

    },
    "Your %@ is all on Blaze. Move it with Charisma Swap." : {

    },
    "Your keys stay on this iPhone, behind Face ID." : {

    }
  },
  "version" : "1.0"
}
```

`apps/blaze-ios/BlazeWallet/InfoPlist.xcstrings`:

```json
{
  "sourceLanguage" : "en",
  "strings" : {
    "NSFaceIDUsageDescription" : {
      "comment" : "Privacy - Face ID Usage Description",
      "extractionState" : "manual",
      "localizations" : {
        "en" : {
          "stringUnit" : {
            "state" : "translated",
            "value" : "Blaze Wallet uses Face ID to unlock your wallet."
          }
        }
      }
    }
  },
  "version" : "1.0"
}
```

- [ ] **Build for the simulator**

```bash
cd apps/blaze-ios && xcodegen generate && cd -
xcodebuild -project apps/blaze-ios/BlazeWallet.xcodeproj -scheme BlazeWallet -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/blaze-ios-build -skipPackagePluginValidation build CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:|warning: |BUILD (SUCCEEDED|FAILED)" | grep -v checkouts
```

Expected: `** BUILD SUCCEEDED **`, with no `error:` lines and no `warning:` lines from `BlazeWallet/`.

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeWallet
git commit -m "feat(blaze-ios): The app: Face ID vault, Welcome, lock screen, Wallet, Tokens with Send and Receive, Status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Strings are complete

- [ ] **Sync the catalog from the code:** `sh apps/blaze-ios/scripts/sync-strings.sh`

Expected:
- the last line is `Synced 139 lines of keys into BlazeWallet/Localizable.xcstrings`
- `git status` shows **no change** to `Localizable.xcstrings`, which means every string in the code is already in the catalog, and nothing in it is stale

If the catalog changed, the code and catalog above differ. Compare them and stop.

---

### Task 4: Smoke run on a simulator

- [ ] **Install and launch on a temporary simulator.** Never use Ross's own booted simulator.

```bash
TYPE=$(xcrun simctl list devicetypes | grep -E "iPhone 1[67] Pro \(" | head -1 | sed -E 's/.*\((com\.apple[^)]+)\).*/\1/')
RUNTIME=$(xcrun simctl list runtimes | grep -E "^iOS" | tail -1 | sed -E 's/.* - (com\.apple[^ ]+).*/\1/')
UDID=$(xcrun simctl create BlazeSmokeTest "$TYPE" "$RUNTIME") && xcrun simctl boot "$UDID"
xcodebuild -project apps/blaze-ios/BlazeWallet.xcodeproj -scheme BlazeWallet -destination "id=$UDID" -derivedDataPath /tmp/blaze-ios-smoke -skipPackagePluginValidation build CODE_SIGN_IDENTITY=- 2>&1 | grep -E "BUILD (SUCCEEDED|FAILED)"
xcrun simctl install "$UDID" /tmp/blaze-ios-smoke/Build/Products/Debug-iphonesimulator/BlazeWallet.app
xcrun simctl launch "$UDID" rocks.charisma.blazewallet && sleep 6
xcrun simctl io "$UDID" screenshot /tmp/blaze-welcome-light.png
xcrun simctl ui "$UDID" appearance dark && sleep 3 && xcrun simctl io "$UDID" screenshot /tmp/blaze-welcome-dark.png
```

- [ ] **Look at both screenshots.** Each must show Welcome:
  - the flame
  - "Blaze Wallet"
  - "Your keys stay on this iPhone, behind Face ID."
  - "Create a new wallet" and "Import a seed phrase"

  Light uses the paper background and Stacks orange. Dark uses near-black and crimson, with the rounded Ysabeau Infant letters. A Keychain error on screen means the build wasn't signed (`CODE_SIGN_IDENTITY=-`).

- [ ] **Delete the simulator:** `xcrun simctl shutdown "$UDID" && xcrun simctl delete "$UDID"`

- [ ] **Report to Ross.** Say the app is ready for his manual pass from the spec, and list it:
  - create a wallet with Face ID in the simulator (Features › Face ID › Enrolled)
  - lock, unlock, background-lock and the privacy cover
  - import a seed already in the extension and compare addresses
  - send 1 STX and a small token amount between his own accounts
  - Status
  - Show words
  - unlink

  Attach the two screenshots.
