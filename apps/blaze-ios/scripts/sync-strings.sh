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
