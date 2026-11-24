# macOS signing under GoML

Move GoSpell's macOS Developer ID signing and notarization from Kit's personal team
(`QC99C9JE59`, local keychain and `GOSPELL_NOTARY_PROFILE` on his Mac) to GoML's
team in GitHub Actions, reusing the credentials OpenCode already uses.

## What OpenCode does

Desktop and CLI (`anomalyco/opencode`, `.github/workflows/publish.yml` on `dev`):

```ts
team         // GoML (5NZ4Q7NXJ4); confirmed from the signed
             // opencode-darwin-arm64 npm binary, not written in the repo
runners      // macos-26 (arm64) and macos-26-intel, runner-default Xcode
certificate  // apple-actions/import-codesign-certs@8f3fb60 (v2.0.0), keychain "build"
             // p12-file-base64: APPLE_CERTIFICATE, p12-password: APPLE_CERTIFICATE_PASSWORD
             // no KEYCHAIN_PASSWORD secret: the action generates one
identity     // security find-identity -v -p codesigning build.keychain
             // | first "Developer ID Application: …"
cli          // job sign-cli-macos: codesign --force --timestamp --options runtime
             // --entitlements packages/cli/script/entitlements.plist (JIT, unsigned
             // memory, dyld env, no library validation: Bun needs them)
desktop      // electron-builder (packages/desktop/electron-builder.config.ts):
             // hardenedRuntime, entitlements resources/entitlements.plist
             // (allow-jit, audio-input), notarize: true, targets dmg + zip
notary       // App Store Connect API key through notarytool (electron-builder):
             // APPLE_API_KEY_PATH secret holds the .p8 *contents*, written to
             // $RUNNER_TEMP/apple-api-key.p8; APPLE_API_KEY holds the key ID;
             // APPLE_API_ISSUER the issuer ID
updates      // electron-updater generic feed; no separate update-signing key
             // (Squirrel.Mac trusts the code signature)
windows      // Azure Trusted Signing (AZURE_* secrets), separate from Apple
```

The repo also has `APPLE_ID` and `APPLE_PASSWORD` secrets, but no workflow
reads them: Apple ID plus app-specific password is not the current method.

iOS (`anomalyco/opencode-ios`, private): Xcode Cloud archives and ships to
TestFlight on every push to `main`; signing is automatic (`project.yml`:
`DEVELOPMENT_TEAM: 5NZ4Q7NXJ4`, `CODE_SIGN_STYLE: Automatic`), no fastlane or
match. Manual fallbacks use the `asc` CLI and `scripts/testflight-upload.sh` with
an App Store Connect key from 1Password (`docs/releasing.md`). Reusable for GoSpell:
the team, and an App Store Connect API key. A team key with the Developer role
can notarize Mac apps, so GoSpell can use the same key as OpenCode desktop.

## What GoSpell does

```ts
scripts/build-app.sh       // cargo build → GoSpell.app; signs Moonshine and ONNX dylibs,
                           // GoSpellMicrophone.driver, then the app with --options runtime
                           // and .github/release/gospell.entitlements (audio-input,
                           // apple-events; not sandboxed)
                           // GOSPELL_TEST_BUILD=1: ad-hoc "GoSpell Test.app" (com.goml.gospell.test)
scripts/macos-signing.sh   // identity must be "Developer ID Application: … (TEAM)"
scripts/release-app.sh     // clean pushed tree → notarized, stapled app and DMG
                           // (scripts/notarize-app.sh) → dist/gospell-<v>-macos-arm64.dmg
                           // and .zip (root GoSpell.app, the updater's archive)
scripts/validate-app.sh    // bundle id com.goml.gospell, team, Developer ID, entitlements,
                           // no Sparkle left
release.yml        // build-macos: GOSPELL_RELEASE_UNSIGNED=1 build-app.sh, no secrets
                           // sign-macos (release env, .github/release only):
                           // macos-credentials.sh imports APPLE_SIGNING_CERTIFICATE and
                           // APPLE_NOTARY_KEY; sign-macos.sh signs inside-out,
                           // notarizes, staples, makes the ZIP and DMG
                           // verify-macos: Gatekeeper, staples, validate-app.sh, the
                           // updater's requirement (app/update-requirement.txt), launch
                           // A check run is the signed candidate; publishes nothing
test-builds.yml            // per-push ad-hoc GoSpell Test DMG (unsigned)
```

Updates no longer use Sparkle: the in-app updater (`src/updater.rs`,
`docs/plans/release-service.md`) downloads the ZIP from the GoML release
service and, before swapping it in, requires `app/update-requirement.txt`:
`anchor apple generic`, identifier `com.goml.gospell`, a Developer ID leaf from team
`5NZ4Q7NXJ4`, and `notarized`. Manifests are unsigned, so this code signature
is the integrity check beyond HTTPS and the manifest's SHA-256; there is no
separate update-signing key (as with OpenCode's electron-updater).

Next: once the `APPLE_*` secrets exist, run a staging Release and check the
signed build against the updater's requirement (verify-macos does); then
optionally sign `GoSpell Test.app` with the same Developer ID so testers grant
permissions once (needs `build-app.sh` to accept a team with
`GOSPELL_TEST_BUILD=1`).

## Secrets for `goml/gospell`

Add to the `release` environment (limited to the `dev` branch).
Names mirror OpenCode; GitHub cannot copy secret values, so an admin
re-enters them from the source (1Password):

```ts
APPLE_CERTIFICATE           // base64 .p12 of the GoML "Developer ID Application" cert + key
APPLE_CERTIFICATE_PASSWORD  // the .p12 password
APPLE_API_KEY_PATH          // App Store Connect API key .p8 contents (OpenCode's naming)
APPLE_API_KEY               // that key's ID
APPLE_API_ISSUER            // the App Store Connect issuer ID
```

`APPLE_ID`, `APPLE_PASSWORD`, and `KEYCHAIN_PASSWORD` are not needed.

## New identity: `com.goml.gospell`

The first GoML-signed release also changes the bundle ID, in the same
release so users re-grant permissions once:

```ts
app            // com.goml.gospell               -> com.goml.gospell
SDK helper     // com.goml.gospell.service        -> com.goml.gospell.service
mic driver     // com.goml.gospell.microphone.driver -> com.goml.gospell.microphone.driver
mic UIDs       // com.goml.gospell.microphone[.sink] -> com.goml.gospell.microphone[.sink]
test build     // com.goml.gospell.test          -> com.goml.gospell.test
Windows event  // Local\com.goml.gospell.app      -> Local\com.goml.gospell.app
```

`com.goml.gospell` is a new app to macOS. There is deliberately no migration code:
the old preferences domain (Sparkle state, a local `DisableUpdates`) is not
imported, managed `DisableUpdates` profiles must name `com.goml.gospell`, and the
permissions and login item start fresh. The `gospell` Application Support folder
does not depend on the bundle ID, so settings, history, models, and meetings
are shared, and its instance lock keeps an old and a new copy from running at
once (as does `windows-listener.lock` on Windows).

- **Launch at login.** `SMAppService.mainAppService` registers per bundle ID:
  the new app starts unregistered and Settings shows it off. An old
  `com.goml.gospell` registration can linger in Login Items (Background
  Task Management) until macOS prunes it or the user removes it; when its app
  is gone or replaced it launches nothing. Unverified on a real Mac.
- **GoSpell Microphone driver (experimental).** It installs at the fixed path
  `/Library/Audio/Plug-Ins/HAL/GoSpellMicrophone.driver`, so there is never a
  second copy. An old `com.goml.gospell.microphone.driver` there fails the
  bundle-ID check and reads as needing an update; the new app does not use its
  devices (different UIDs), and Update or Uninstall replaces or removes it. If
  the user never opens the GoSpell microphone card, the old driver stays installed
  and its "GoSpell Microphone" device stays in the system's device list.

## Existing installs

Macs on 2.3.1 or earlier run Sparkle with `com.goml.gospell`; their
`SUFeedURL` redirects to `https://gospell.goml.io/files/appcast.xml`. They never
auto-update into `com.goml.gospell`: the site serves
`packaging/macos/legacy-appcast.xml` there, one informational item (no
enclosure) that links to https://gospell.goml.io. Sparkle shows its notes and a
download button and installs nothing. It needs no Sparkle EdDSA key: the item has no
archive to sign and 2.3.1 does not set `SURequireSignedFeed`. Set the item's
version to the first `com.goml.gospell` release before publishing.

## Implications of changing the team

- **Users must re-grant permissions.** TCC records each grant against the app's
  designated requirement, which names the signing team. After the first
  GoML-signed update, Microphone, Accessibility,
  Automation, Screen and System Audio Recording (Meetings) stop matching; old
  entries can remain listed but inert, so users may need to remove and re-add
  GoSpell. Onboarding's permission health gate must show this; release notes must
  say so.
- **Launch at login.** `SMAppService.mainAppService` registrations are tracked
  by Background Task Management with the team; expect the item to need
  re-enabling or approval after the switch. GoSpell polls macOS for the status
  (no stored flag), so Settings shows the truth; verify on a real Mac.
- **GoSpellMicrophone.driver.** The bundled copy is re-signed by GoML; an
  installed copy in `/Library/Audio/Plug-Ins/HAL` keeps Kit's signature until
  the in-app Update reinstalls it.
- **Keychain items and app groups.** GoSpell stores none, so nothing else breaks.
