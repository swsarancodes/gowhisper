#!/bin/sh

# Sourced by the app and helper packagers. Print only the selected identity so
# callers can capture it without mixing diagnostics into codesign arguments.
gospell_codesign_identity() {
  team_id=$1
  identity=${GOSPELL_CODESIGN_IDENTITY:-}
  if [ -z "$identity" ]; then
    identity=$(security find-identity -v -p codesigning | sed -n "s/.*\"\(Developer ID Application:.*($team_id)\)\"/\1/p" | head -1)
  fi
  if [ -z "$identity" ]; then
    echo "No Developer ID signing identity found for team $team_id. Set GOSPELL_CODESIGN_IDENTITY." >&2
    return 1
  fi
  case "$identity" in
    "Developer ID Application:"*"($team_id)") ;;
    *)
      echo "Signing identity is not a Developer ID Application identity for team $team_id." >&2
      return 1
      ;;
  esac
  printf '%s\n' "$identity"
}

# Submit one artifact and wait. A local notarytool keychain profile wins;
# otherwise CI authenticates with an App Store Connect API key file.
gospell_notarize() {
  if [ -n "${GOSPELL_NOTARY_PROFILE:-}" ]; then
    xcrun notarytool submit "$1" --keychain-profile "$GOSPELL_NOTARY_PROFILE" --wait
  else
    xcrun notarytool submit "$1" \
      --key "${GOSPELL_NOTARY_KEY:?Set GOSPELL_NOTARY_PROFILE, or GOSPELL_NOTARY_KEY with GOSPELL_NOTARY_KEY_ID and GOSPELL_NOTARY_ISSUER}" \
      --key-id "${GOSPELL_NOTARY_KEY_ID:?Set GOSPELL_NOTARY_KEY_ID to the App Store Connect API key ID}" \
      --issuer "${GOSPELL_NOTARY_ISSUER:?Set GOSPELL_NOTARY_ISSUER to the App Store Connect issuer ID}" \
      --wait
  fi
}

gospell_version() {
  printf '%s\n' "${GOSPELL_VERSION:-$(cargo metadata --no-deps --format-version 1 --manifest-path "$1/Cargo.toml" | jq -r '.packages[] | select(.name == "gospell") | .version')}"
}

# CFBundleVersion: the run number of a dev build (0.0.0-dev-N), else from
# X.Y.Z (a prerelease shares its release's number). GoSpell's updater compares
# neither; it follows the channel's current release.
gospell_build_number() {
  if [ -n "${GOSPELL_BUILD_NUMBER:-}" ]; then
    printf '%s\n' "$GOSPELL_BUILD_NUMBER"
    return
  fi
  case "$1" in
    0.0.0-dev-[0-9]*) printf '%s\n' "${1#0.0.0-dev-}" ;;
    *) printf '%s\n' "${1%%-*}" | awk -F. '{ print ($1 * 10000) + ($2 * 100) + $3 }' ;;
  esac
}
