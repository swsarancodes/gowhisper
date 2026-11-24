#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
. "$root/scripts/macos-signing.sh"
# GOSPELL_TEST_BUILD=1 builds the CI test app: ad-hoc signed, under its own
# name and bundle ID so it installs beside the released GoSpell and never
# touches its permissions; it never checks for updates.
# GOSPELL_LOCAL_BUILD=1 marks a build made from a checkout for its owner's own
# machine (Developer ID signed as usual): it shows "Local build · updates off"
# with its commit and never checks for or offers updates.
# GOSPELL_RELEASE_UNSIGNED=1 builds the release app (GoSpell, com.goml.gospell) ad-hoc
# signed: the Release workflow's build job, which holds no credentials. Its
# sign-macos job signs it with the Developer ID (.github/release/sign-macos.sh).
if [ "${GOSPELL_RELEASE_UNSIGNED:-}" = 1 ]; then
  team_id=
  identity=-
  app_name=GoSpell
  bundle_id=com.goml.gospell
elif [ "${GOSPELL_TEST_BUILD:-}" = 1 ]; then
  team_id=
  identity=-
  app_name="GoSpell Test"
  bundle_id=com.goml.gospell.test
else
  team_id=${GOSPELL_TEAM_ID:?Set GOSPELL_TEAM_ID to the Apple Developer signing team}
  identity=$(gospell_codesign_identity "$team_id")
  app_name=GoSpell
  bundle_id=com.goml.gospell
fi
# Every build carries the `capture` experiment (dormant until enabled), with
# Scrawl's `scrawl-helper` beside `gospell`, where the engine looks for it.
# crates/capture/build.rs compiles the helper from crates/capture/helper into
# target/release.
icon_output="$root/target/AppIcon.assets"
icon_info="$root/target/AppIcon-info.plist"
version=$(gospell_version "$root")
build_number=$(gospell_build_number "$version")
bundle_name="$app_name.app"
executable_name=gospell

bundle="$root/target/app/$bundle_name"
executable="$bundle/Contents/MacOS/$executable_name"

sign() {
  if [ "$identity" = - ]; then
    codesign --force --sign - "$@"
  else
    codesign --force --timestamp --options runtime --sign "$identity" "$@"
  fi
}

export MACOSX_DEPLOYMENT_TARGET=15.0
# Cargo may run through a wrapper that does not forward the environment (Kit's
# HiveMind-backed cargo), so build-time variables also travel as --config.
env_args=()
if [ -z "${GOSPELL_COMMIT:-}" ] && { [ "${GOSPELL_LOCAL_BUILD:-}" = 1 ] || [ "${GOSPELL_TEST_BUILD:-}" = 1 ]; }; then
  GOSPELL_COMMIT=$(git -C "$root" rev-parse --short=7 HEAD 2>/dev/null || true)
fi
for name in GOSPELL_LOCAL_BUILD GOSPELL_TEST_BUILD GOSPELL_COMMIT GOSPELL_BUILD_CHANNEL; do
  value=${!name:-}
  if [ -n "$value" ]; then
    case "$value" in
      *\'*) echo "$name must not contain a single quote" >&2; exit 1 ;;
    esac
    env_args+=(--config "env.$name='$value'")
  fi
done
# The helper's embedded Info.plist names GoSpell, not Scrawl.
SCRAWL_HELPER_PLIST="$root/packaging/macos/scrawl-helper-Info.plist" \
  cargo build --locked --release ${env_args[@]+"${env_args[@]}"} --manifest-path "$root/Cargo.toml" >&2
rm -rf "$bundle"
mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources" "$bundle/Contents/Library"
cp "$root/target/release/gospell" "$executable"
cp "$root/target/release/scrawl-helper" "$bundle/Contents/MacOS/scrawl-helper"
cp "$root/app/Info.plist" "$bundle/Contents/Info.plist"
cp "$root/LICENSE" "$root/THIRD_PARTY_NOTICES.md" "$bundle/Contents/Resources/"
GOSPELL_VERSION="$version" GOSPELL_BUILD_NUMBER="$build_number" GOSPELL_TEAM_ID="$team_id" GOSPELL_CODESIGN_IDENTITY="${identity#-}" GOSPELL_SKIP_INSTALL_SCRIPT=1 \
  "$root/scripts/build-gospell-microphone-driver.sh" "$bundle/Contents/Library" >&2
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" "$bundle/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $build_number" "$bundle/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $bundle_id" "$bundle/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable $executable_name" "$bundle/Contents/Info.plist"
plutil -replace CFBundleName -string "$app_name" "$bundle/Contents/Info.plist"
plutil -replace CFBundleDisplayName -string "$app_name" "$bundle/Contents/Info.plist"
# Links into the playground (src/rune_ui/story_link.rs); a test build's own
# scheme never opens the installed GoSpell.
url_scheme=gospell
[ "${GOSPELL_TEST_BUILD:-}" = 1 ] && url_scheme=gospell-test
/usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLName $bundle_id" "$bundle/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLSchemes:0 $url_scheme" "$bundle/Contents/Info.plist"
# The helper mirrors a cabled iPhone as a camera; macOS asks on GoSpell's behalf.
plutil -replace NSCameraUsageDescription -string "GoSpell mirrors and records a cabled iPhone's screen for a capture." "$bundle/Contents/Info.plist"
rm -rf "$icon_output"
mkdir -p "$icon_output"
if xcrun --find actool >/dev/null 2>&1; then
  xcrun actool "$root/app/AppIcon.icon" \
    --compile "$icon_output" \
    --platform macosx \
    --minimum-deployment-target 15.0 \
    --app-icon AppIcon \
    --standalone-icon-behavior all \
    --output-partial-info-plist "$icon_info" \
    --output-format human-readable-text \
    --warnings \
    --notices >&2
  cp "$icon_output/AppIcon.icns" "$icon_output/Assets.car" "$bundle/Contents/Resources/"
else
  # actool ships with Xcode only. app/AppIcon.icns is the same icon
  # (design/app-icon/gospell-app-icon.svg, the Speak Bubble), prebuilt.
  echo "actool not found (it needs Xcode); using app/AppIcon.icns" >&2
  cp "$root/app/AppIcon.icns" "$bundle/Contents/Resources/AppIcon.icns"
fi

sign "$bundle/Contents/Library/GoSpellMicrophone.driver"
# GoSpell runs it only to decode the capture's movie, which needs no
# entitlement; anything it touches is attributed to GoSpell, its responsible
# process.
sign --identifier "$bundle_id.scrawl-helper" "$bundle/Contents/MacOS/scrawl-helper"
sign --entitlements "$root/.github/release/gospell.entitlements" "$bundle"
codesign --verify --deep --strict --verbose=2 "$bundle"
echo "$bundle"
