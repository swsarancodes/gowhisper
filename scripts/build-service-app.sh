#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
team_id=${GOSPELL_TEAM_ID:?Set GOSPELL_TEAM_ID to the Apple Developer signing team}
. "$root/scripts/macos-signing.sh"
identity=$(gospell_codesign_identity "$team_id")
bundle="$root/target/GOSPELL Service.app"
executable="$bundle/Contents/MacOS/gospell-service"
version=$(gospell_version "$root")
build_number=$(gospell_build_number "$version")

cargo build --release --manifest-path "$root/Cargo.toml"
rm -rf "$bundle"
mkdir -p "$bundle/Contents/MacOS"
cp "$root/target/release/gospell" "$executable"
cp "$root/app/ServiceInfo.plist" "$bundle/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" "$bundle/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $build_number" "$bundle/Contents/Info.plist"

codesign --force --timestamp --options runtime --sign "$identity" "$bundle"
codesign --verify --deep --strict --verbose=2 "$bundle"

echo "$bundle"
