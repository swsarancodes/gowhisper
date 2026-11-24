# Test Builds

Every push to `dev` runs the [Test builds](https://github.com/goml/gospell/actions/workflows/test-builds.yml)
workflow (`.github/workflows/test-builds.yml`; run it by hand with **Run
workflow**). Open the latest green run: its summary links each download.
Artifacts are kept 14 days, and downloading one requires a GitHub login with
access to the repository.

```ts
gospell-test-<commit>-macos-arm64       // gospell-test-<commit>-arm64.dmg
gospell-test-<commit>-windows-x86_64    // gospell-setup-<version>-windows-x64.exe + bare gospell-<version>-windows-x64.exe
gospell-test-<commit>-windows-aarch64   // gospell-setup-<version>-windows-arm64.exe + bare gospell-<version>-windows-arm64.exe
gospell-test-<commit>-linux-x86_64      // gospell-<version>-linux-x64
```

None of these are code-signed, notarized, or published. They never update
themselves, so the signed release cannot replace the build you are testing.
GitHub wraps each artifact in a zip; unzip it first.

## macOS (Apple silicon, macOS 15 or later)

The test app is **GoSpell Test.app** (bundle ID `com.goml.gospell.test`),
ad-hoc signed and never checks for updates. Its own name and bundle ID let it sit
beside a released `GoSpell.app` without touching that app's permissions, login
item, or updates. It also keeps its own data: settings, models, History, and
meetings live in `~/Library/Application Support/gospell-test`, personal commands in
`~/.config/gospell-test`, and meeting Markdown in `~/Documents/GoSpell Test Meetings`,
so it starts with onboarding and never reads or changes the installed GoSpell's
data. Both apps listen to the same shortcut and microphone, so run one at a
time.

1. Quit GoSpell from its menu-bar icon.
2. Open the DMG and drag **GoSpell Test** to Applications.
3. Clear the download quarantine, which macOS otherwise reports as an app that
   cannot be opened or is damaged:

   ```sh
   xattr -dr com.apple.quarantine "/Applications/GoSpell Test.app"
   ```

   Alternatively, open it once, then choose **Open Anyway** in System Settings →
   Privacy & Security.
4. Open GoSpell Test and grant Microphone and Accessibility again. Ad-hoc
   signatures change with every build, so each new test build needs these
   grants again: remove the old **GoSpell Test** entries in System Settings and
   add the new app.

To go back, quit GoSpell Test, delete it, and open GoSpell.

## Windows (10 or 11, x64 or ARM64)

The installer and executable are unsigned, so SmartScreen warns: choose **More
info**, then **Run anyway**. Smart App Control is stricter: it blocks an
unsigned setup engine, and turning it off cannot be fully undone without
resetting Windows. Use a VM, or a machine where it is already off; release
installers carry the signed engine and work with it on.

1. Quit GoSpell from its tray icon.
2. Run `gospell-setup-<version>-windows-<x64|arm64>.exe`. It replaces an installed GoSpell of
   the same or an older version in the usual per-user layout, and refuses to
   replace a newer one: uninstall that first from Apps & Features (settings are
   kept). Or skip the installer and run the bare `gospell-<version>-windows-<arch>.exe` from any folder.
3. The test build never self-updates. To return to the release, run the
   release installer from <https://gospell.goml.io>.

## Linux (x86_64)

An installed GoSpell starts through its systemd user unit, so launching the test
binary normally would just start the installed one. Run the test binary as the
instance directly instead:

```sh
gospell quit
chmod +x gospell-*-linux-x64
./gospell-*-linux-x64 service     # runs GoSpell in the foreground; Ctrl-C quits
./gospell-*-linux-x64             # in another terminal: opens the window
```

After Ctrl-C, `gospell` starts the installed GoSpell again.

## Reporting

Include the commit from the artifact name, the OS and architecture, and the
logs: `~/Library/Application Support/gospell/logs/` on macOS,
`%LOCALAPPDATA%\gospell\logs\` on Windows, and
`~/.local/share/gospell/logs/` on Linux.
