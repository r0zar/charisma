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
