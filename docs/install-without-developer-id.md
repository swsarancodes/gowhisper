# Install and run GoSpell without a developer account

GoSpell builds and runs without an Apple Developer account or a Windows
code-signing certificate. The app is then *ad-hoc signed* (macOS) or unsigned
(Windows), so each OS asks you to confirm it once. Nothing about the app
changes: dictation, the HUD and every feature work the same.

## macOS

### Build it on your Mac

You need the Command Line Tools, cmake, and Rust:

```bash
xcode-select --install
```

```bash
brew install cmake
```

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Xcode (free from the App Store) is optional. Without it, GoSpell builds without
Apple Intelligence (its Swift macros ship with Xcode only) and uses the
prebuilt `app/AppIcon.icns` instead of compiling `app/AppIcon.icon`; everything
else is the same.

Then, from the repository:

```bash
GOSPELL_RELEASE_UNSIGNED=1 GOSPELL_LOCAL_BUILD=1 scripts/build-app.sh
```

`GOSPELL_RELEASE_UNSIGNED=1` signs the app ad-hoc (no Apple certificate) as
`GoSpell` with bundle ID `com.goml.gospell`. `GOSPELL_LOCAL_BUILD=1` turns off
update checks and shows "Local build · updates off" in Settings. The app lands
in `target/app/GoSpell.app`.

### Install and open it

```bash
ditto target/app/GoSpell.app /Applications/GoSpell.app
```

```bash
xattr -dr com.apple.quarantine /Applications/GoSpell.app
```

```bash
open /Applications/GoSpell.app
```

`xattr -dr com.apple.quarantine` removes the "downloaded from the internet"
flag, which is what makes Gatekeeper refuse an app that isn't notarized. A copy
you built yourself usually has no flag; one you downloaded, unzipped or
AirDropped always does.

### Share a build with someone else

```bash
ditto -c -k --keepParent target/app/GoSpell.app GoSpell-macOS.zip
```

They unzip it, move `GoSpell.app` to Applications, and run:

```bash
xattr -dr com.apple.quarantine /Applications/GoSpell.app && open /Applications/GoSpell.app
```

Without Terminal: open it once, dismiss the warning, then go to System
Settings › Privacy & Security and click **Open Anyway** next to GoSpell.
(macOS 15 removed the old right-click › Open shortcut.)

### Permissions after a rebuild

macOS ties Microphone, Accessibility and Input Monitoring grants to the app's
signature, and an ad-hoc signature changes with every build. After installing a
new build, if dictation stops pasting or the shortcut stops working, reset
GoSpell's grants and let onboarding ask again:

```bash
tccutil reset All com.goml.gospell
```

## Windows

Build on Windows with Rust installed (`winget install Rustlang.Rustup`):

```powershell
cargo build --release --locked
```

`target\release\gospell.exe` runs as is. To wrap it in the GoSpell installer
(unsigned; the script installs Inno Setup if it's missing):

```powershell
scripts\build-windows-installer.ps1 -Executable target\release\gospell.exe -Version 3.4.0 -Arch x86_64 -OutDir dist
```

An unsigned app or installer shows SmartScreen's "Windows protected your PC":
click **More info**, then **Run anyway**. Windows 11's Smart App Control, when
it is on, blocks unsigned installers outright; run `gospell.exe` directly
instead of the installer.

## Linux

Linux needs no signing.

```bash
cargo build --release --locked
```

```bash
./target/release/gospell
```

A downloaded executable needs `chmod +x gospell` first. The packages
(`.deb`, `.rpm`, AUR) install the GoSpell icon and launcher entry
(`com.goml.gospell`).
