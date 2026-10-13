#!/bin/sh
# Archives the app for the App Store and uploads it to TestFlight. It's signed for the team in project.yml
# (DEVELOPMENT_TEAM) through the Apple ID in Xcode › Settings › Accounts, which must belong to that team's paid
# Apple Developer Program, and App Store Connect must already have the app (bundle id rocks.charisma.blazewallet).
# Each upload's build number is the UTC date and time, so it always goes up. Run from the repo root:
#   sh apps/blaze-ios/scripts/testflight.sh
set -eu
cd "$(dirname "$0")/.."
xcodegen generate --quiet
build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT
number=$(date -u +%Y%m%d%H%M)
xcodebuild -project BlazeWallet.xcodeproj -scheme BlazeWallet -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$build/BlazeWallet.xcarchive" -skipPackagePluginValidation -allowProvisioningUpdates -quiet \
  CURRENT_PROJECT_VERSION="$number" archive
xcodebuild -exportArchive -archivePath "$build/BlazeWallet.xcarchive" -exportOptionsPlist scripts/ExportOptions.plist \
  -exportPath "$build/export" -allowProvisioningUpdates -quiet
echo "Uploaded build $number. It appears in App Store Connect › TestFlight once Apple has processed it (a few minutes)."
