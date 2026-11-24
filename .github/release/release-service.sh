#!/bin/sh
# Publishes GoSpell to the GoML release service through its shared client,
# vendored as release-client.sh (anomalyco/release docs/publishing.md), so
# nothing fetched at run time executes here.
# The client trades the job's GitHub OIDC token for a one-hour publish
# session, uploads in parallel (skipping files already stored), retries with
# backoff and checks the published files. Runs only in the Release
# workflow's publish jobs, which have `id-token: write`.
#
#   release-service.sh publish <dist> <notes-url>   # upload every target, then the release
#   release-service.sh distribution <kind> <version>  # a package manager now serves <version>
#
# RELEASE is https://goml.io/release; GOSPELL_VERSION the version; GOSPELL_RELEASE_CHANNEL
# the channel (default stable). `publish` writes <dist>/manifest.json. A rerun
# of the channel's current version succeeds when it is exactly these files.
set -eu

: "${RELEASE:?Set RELEASE to the release service origin}"
: "${GOSPELL_VERSION:?Set GOSPELL_VERSION}"
channel=${GOSPELL_RELEASE_CHANNEL:-stable}
case "$RELEASE" in
  https://goml.io/release) ;;
  *) echo "RELEASE must be https://goml.io/release." >&2; exit 1 ;;
esac

temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT HUP INT TERM
client() { RELEASE=$RELEASE bash "$(dirname "$0")/release-client.sh" "$@"; }

# The package managers that mirror GoSpell, each as the service lists it.
distributions='[
  {"kind": "aur", "package": "gospell-bin", "command": "yay -Syu gospell-bin"},
  {"kind": "deb-x64", "package": "gospell", "command": "curl -fLo /tmp/gospell.deb https://goml.io/release/gospell/desktop/stable/linux-x64-deb && sudo apt install /tmp/gospell.deb"},
  {"kind": "deb-arm64", "package": "gospell", "command": "curl -fLo /tmp/gospell.deb https://goml.io/release/gospell/desktop/stable/linux-arm64-deb && sudo apt install /tmp/gospell.deb"},
  {"kind": "rpm-x64", "package": "gospell", "command": "curl -fLo /tmp/gospell.rpm https://goml.io/release/gospell/desktop/stable/linux-x64-rpm && sudo dnf install /tmp/gospell.rpm"},
  {"kind": "rpm-arm64", "package": "gospell", "command": "curl -fLo /tmp/gospell.rpm https://goml.io/release/gospell/desktop/stable/linux-arm64-rpm && sudo dnf install /tmp/gospell.rpm"},
  {"kind": "brew", "cask": "goml/tap/gospell", "command": "brew upgrade --cask goml/tap/gospell"},
  {"kind": "nix", "attribute": "github:goml/gospell", "command": "nix profile upgrade gospell"}
]'

publish() {
  dist=$1
  notes_url=$2
  version=$GOSPELL_VERSION
  # target=local file=published name, as docs/plans/release-service.md pins.
  # Published names carry no version or target: the sha256 in the path tells
  # files apart. A run without a platform's signed build publishes the others.
  set --
  for entry in \
    "macos-arm64=gospell-$version-macos-arm64.zip=GoSpell.zip" \
    "macos-arm64-dmg=gospell-$version-macos-arm64.dmg=GoSpell.dmg" \
    "windows-x64=gospell-$version-windows-x64.exe=gospell.exe" \
    "windows-x64-cli=gospell-$version-windows-x64.com=gospell.com" \
    "windows-x64-setup=gospell-setup-$version-windows-x64.exe=GoSpellSetup.exe" \
    "windows-arm64=gospell-$version-windows-arm64.exe=gospell.exe" \
    "windows-arm64-cli=gospell-$version-windows-arm64.com=gospell.com" \
    "windows-arm64-setup=gospell-setup-$version-windows-arm64.exe=GoSpellSetup.exe" \
    "linux-x64=gospell-$version-linux-x64=gospell" \
    "linux-x64-sig=gospell-$version-linux-x64.sig=gospell.sig" \
    "linux-x64-deb=gospell-$version-linux-x64.deb=gospell.deb" \
    "linux-x64-rpm=gospell-$version-linux-x64.rpm=gospell.rpm" \
    "linux-arm64=gospell-$version-linux-arm64=gospell" \
    "linux-arm64-sig=gospell-$version-linux-arm64.sig=gospell.sig" \
    "linux-arm64-deb=gospell-$version-linux-arm64.deb=gospell.deb" \
    "linux-arm64-rpm=gospell-$version-linux-arm64.rpm=gospell.rpm"
  do
    target=${entry%%=*}
    rest=${entry#*=}
    local_name=${rest%%=*}
    name=${rest#*=}
    [ -f "$dist/$local_name" ] || continue
    set -- "$@" --target "$target=$dist/$local_name=$name"
  done
  [ $# -gt 0 ] || { echo "No release files in $dist." >&2; exit 1; }
  jq -n --arg channel "$channel" --arg version "$version" --arg notes_url "$notes_url" \
    --argjson distributions "$distributions" \
    '{channel: $channel, version: $version, notes_url: $notes_url,
      distributions: ([{kind: "direct"}] + $distributions)}' > "$temporary/release.json"
  client publish --app gospell --artifact desktop --release "$temporary/release.json" \
    --out "$dist/manifest.json" --verify-downloads "$@"
}

distribution() {
  # The whole entry, so recording a version never drops its command.
  entry=$(printf '%s' "$distributions" | jq -ec --arg kind "$1" --arg version "$2" \
    'map(select(.kind == $kind))[0] // error("unknown distribution \($kind)") | . + {version: $version}')
  client distribution --app gospell --artifact desktop --channel "$channel" --entry "$entry"
}

case "${1:-}" in
  publish)
    [ $# -eq 3 ] || { echo "Usage: $0 publish <dist> <notes-url>" >&2; exit 1; }
    publish "$2" "$3"
    ;;
  distribution)
    [ $# -eq 3 ] || { echo "Usage: $0 distribution <kind> <version>" >&2; exit 1; }
    distribution "$2" "$3"
    ;;
  *)
    echo "Usage: $0 publish <dist> <notes-url> | distribution <kind> <version>" >&2
    exit 1
    ;;
esac
