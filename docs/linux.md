# Install The Linux Beta

The Linux beta targets x86_64 and ARM64 (aarch64) Linux: i3/X11 and compatible wlroots-based Wayland
compositors such as Hyprland or Sway. Audio uses ALSA, including PipeWire systems
with ALSA compatibility. Inference uses Vulkan when available and can fall back
to the CPU. A GPU that hangs or fails while transcribing is remembered for
its current driver, and Auto transcribes on the CPU on it until the driver
changes. An integrated GPU slow enough to miss streaming deadlines is timed
against the CPU once, and Auto keeps whichever is faster. General › Advanced ›
**Speech engine** picks Auto, GPU, or CPU
(`gospell settings set transcription_device cpu`). The window still needs a Vulkan driver, even with CPU
inference; `vulkan-icd-loader` alone is not a driver. Install a driver for your GPU
or a software Vulkan driver. See the Wayland requirements below.

x86_64 machines need a 2013 or newer processor with AVX2 (Intel Haswell / AMD Excavator or later); on an older processor GoSpell shows a message and quits instead of starting.

An x86_64 PC below that floor (for example Ivy Bridge: AVX and F16C, but no
AVX2) can still build from source. Set `GOSPELL_X86_BASELINE=ivybridge` and
`TRANSCRIBE_CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_SSE42=ON -DGGML_AVX=ON -DGGML_F16C=ON -DGGML_AVX2=OFF -DGGML_BMI2=OFF -DGGML_FMA=OFF"`
for `./scripts/install-linux.sh`; a missing flag fails the build with the full
value. After switching between this build and a normal one, run
`cargo clean -p transcribe-cpp-sys` first, so ggml is configured from scratch.
Such a build is slower on newer CPUs, is not an official release, and never
self-updates, because every official artifact targets x86-64-v3 and would not
start on that processor.

Linux opens the same window as macOS and Windows: Settings, Modes,
and History. Meetings are macOS-only.
Paste on Wayland uses `wtype` where the compositor offers the virtual keyboard
protocol (wlroots compositors, niri) and the desktop's RemoteDesktop portal
elsewhere (KDE, GNOME). Shortcuts are general: the desktop's GlobalShortcuts portal when it has one, otherwise
your desktop's own keybindings running `gospell` commands (see
[Shortcuts](#shortcuts)).

With **Labs › Live typing** on (`labs.live_typing`, off by default), a hotkey
dictation's provisional words are an underlined input-method preedit in the
focused text field and the final text is committed through
`zwp_input_method_v2`, so it lands without the clipboard and Ctrl-V.
`zwp_input_method_manager_v2` is a wlroots-family protocol (Sway, Hyprland,
and other wlroots compositors); KWin and Mutter do not offer it, so KDE and
GNOME use the paste above. GoSpell takes the input method when the capture
becomes intentional (the hold threshold, or at once in Toggle) and gives the
seat back at Finish or Cancel, including post-release processing; short taps
and chords create none. It falls back to the paste above when the compositor
does not offer the protocol, another input method (fcitx, ibus) holds the
seat, the focused field has no active text input, the final text is
multi-line, or the compositor does not answer in time. A CPU engine or a
model that cannot stream shows no provisional words while speaking, but the
final text still goes in through the input method. GoSpell checks the
compositor's registry when the window loads: on a Wayland desktop without the
protocol (GNOME) Settings › Labs keeps its card, disabled while off, with a
note that this desktop offers no input method Live typing needs, and `gospell labs`
prints the same note in its list and after `gospell labs on live-typing`. The
toggle is not refused, and dictations paste normally. It has **not** been
verified on a real compositor yet; only its unit tests and the build ran.

With **Labs › Transform typed text** on (`labs.typed_text`, off by default),
Settings › Output adds a **Typed text** section whose shortcut
(`typed_text_hotkey`) is unbound until you record one. Pressing it while
nothing records clears the clipboard, sends Ctrl+A and Ctrl+C to the focused
field, runs the focused app's Output steps on the copied text, clears and
copies again to check the field still holds that text, then sends Ctrl+V to
replace it. Spoken formatting, spoken symbols, and filler words are
dictation-only and do not run on typed text. It takes the clipboard for the
job, including any paste still waiting to restore, and puts the saved
clipboard back 500 ms after the paste unless something newer replaced it. If
GoSpell could not snapshot the clipboard, the result stays on it. Without
data-control on GNOME, text is read through `wl-paste`, the clipboard is
cleared through `wl-copy --clear`, and a result GoSpell could not snapshot stays
on the clipboard. Because it sends Ctrl+A and Ctrl+C, it is not meant for
terminals. With **Terminal paste** on, it refuses before sending any
key: its Ctrl+V would become Ctrl+Shift+V. Select-all replaces the whole
field, so mixed formatting is not preserved, and on GNOME `wl-paste` may
briefly take focus. With the lab off, Output and the listener are unchanged
and the shortcut is not registered; `gospell typed-text` runs the same job from a
desktop keybinding, and refuses clearly when the lab is off, Terminal paste
shortcut is on, or GoSpell isn't listening.

For Nix/NixOS, use the [Nix guide](nix.md). Nix owns updates to that installation;
GoSpell's signed updater owns only the direct-install layout below.

## One GoSpell Process

GoSpell on Linux is **one process per user** (and per data directory), not a
system-wide/root daemon. It owns the microphone, shortcuts, model downloads and
workers, sounds, paste, History, the recording pill, and the window. The window
is optional: closing it stops neither dictation nor a model download, and
launching GoSpell again opens it. When the desktop has a tray (a
StatusNotifierItem host, such as Waybar, KDE, or Omarchy's bar), GoSpell shows a
tray icon: click it to open the window, or use its menu: **Show GoSpell**,
**Paste last dictation**, the downloaded speech models, the update once one
is ready (**Restart to update**), **Enable / Disable GoSpell**, and **Quit GoSpell**;
while GoSpell records or transcribes, the menu and tooltip say so. Hosts that draw
theme icons, such as Plasma 6, GNOME's AppIndicator extension, and Waybar, draw
a symbolic mark in the panel's own text color, so it stays visible on a light
or dark panel. Plasma 6 recolors it only with icon themes that follow the color
scheme (Breeze and Papirus do); other themes show the mark's default color.
Plasma 5 also prefers the icon name but has no panel palette, so its color
there is untested. Hosts that don't use theme names get GoSpell's pixmap: white,
and black when the desktop's color scheme prefers light (Waybar also falls
back to it when it can't find the name). GoSpell reads that setting when it
creates the tray, so a later switch applies at the next launch, and asks a
running Plasma session to reload icons after writing the mark.
Without a tray, quit with **Quit GoSpell** at the bottom of the window's
sidebar, the launcher's **Quit GoSpell** action, or `gospell quit`.

The window opens at 980×760 logical pixels and floats on tiling window
managers with no window rule: it maps with its minimum size equal to its
maximum, which sway, Hyprland, niri, and X11 managers such as i3 float, then
drops the maximum so you can resize it down to 860×560 or up to any size.
macOS and Windows open the same resizable window.

Settings live in `settings.json` in GoSpell's data directory, the same file macOS
and Windows use.

```sh
gospell                             # open the window, starting GoSpell if needed
gospell start                       # start GoSpell in the background; no window
gospell status [--json]             # query the running GoSpell, not an old log entry
gospell quit [--force]              # finish accepted work, release the microphone, exit
gospell restart [--force]           # restart the systemd unit in this desktop's environment
                                # (over SSH: the one it last ran in)
gospell settings set sound_effects off   # every control command (docs/cli.md)
journalctl --user -u gospell.service # diagnostics of the supervised process
```

`gospell app` is the same as `gospell`, `gospell start` runs `gospell app --hidden` in the
background and waits until GoSpell answers, and `gospell stop` is the same as
`gospell quit`; older desktop and autostart entries keep working after an update
replaces only the executable. `gospell quit` and `gospell restart` refuse while a
dictation records or transcribes unless `--force`. Linux runs the same
control commands as macOS ([docs/cli.md](cli.md)): `settings`, `model`,
`window`, `vocabulary`, `history clear`, `check-for-updates`, `onboarding
reset`, `annotate status`, `launch-at-login` (the XDG autostart entry),
`logs`, `commands init|check`, `history`, `meetings`, and `mcp`.

A launch first asks the running GoSpell over its socket. If one answers, it
forwards `Activate` with the launcher's `XDG_ACTIVATION_TOKEN` or
`DESKTOP_STARTUP_ID` and exits 0; the running process opens or focuses its
window. If none runs and the installer's (or Home Manager's) `gospell.service` user
unit is loaded, the launch writes an owner-only `session.env` and starts the
unit, which reports readiness to systemd (`Type=notify`) once its socket
answers, then forwards `Activate`. Otherwise (a custom data directory,
`cargo run`, a desktop without systemd) the launching process becomes GoSpell
itself. Two racing launches produce one GoSpell; the loser forwards and exits 0.

`session.env` holds the display and session variables, the cursor theme and
input method (`XCURSOR_THEME`, `XCURSOR_SIZE`, `XMODIFIERS`, `GTK_IM_MODULE`,
`QT_IM_MODULE`), and, when set, `XDG_DATA_DIRS` and the locale (`LANG`,
`LANGUAGE`, `LC_ALL`, `LC_CTYPE`, `LC_MESSAGES`). Missing display variables
explicitly clear stale Wayland/X11 values inherited by the user manager; missing
locale and data-directory variables are left to the user manager. A saved
`XAUTHORITY` whose file is gone (Xwayland writes a new cookie at each login, so
a reboot strands the old path) is replaced at startup by the user manager's
current value, or dropped so Xlib uses `~/.Xauthority`. A unit started with no
display at all (the desktop never imported its environment into systemd) adopts
the user manager's `WAYLAND_DISPLAY`, else the newest Wayland socket of yours in
`XDG_RUNTIME_DIR` that answers. One started with only Xwayland's `DISPLAY` does
the same when `XDG_SESSION_TYPE` is `wayland` (from GoSpell's environment, else the
user manager's): it takes the manager's live `WAYLAND_DISPLAY`, else the newest
answering socket. Any other explicit session type (`x11`, `tty` from startx,
`mir`, …) keeps its X display even when the user manager still names a nested
compositor or another login's display, so paste keeps reaching X11 apps; only
an absent type adopts a live manager display. Launchers (`gospell`, `gospell start`,
`gospell restart`) make the same decision before they write `session.env`, so the
service and the launcher agree on the session; a launcher never adopts without
a display, and when it would start the unit with nothing to write it still
refuses with "Start GoSpell from your graphical login session". Without the
adoption, a Wayland desktop's paste goes through XWayland, which native Wayland
windows never see, and restoring the clipboard clears the compositor's.
Hyprland imports nothing by default; add this to its config so the service, its
paste helpers, and the HUD get your session:

```ini
exec-once = dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP
```

When the HUD can't show, GoSpell's log says why: no display, no layer-shell (and
no XWayland), or the overlay failing to open, with its error. No
permissions are granted. The unit is `PartOf=graphical-session.target`;
desktops managing a custom session target must bind its lifetime to their
login/logout lifecycle. Systemd restarts a crashed GoSpell (`Restart=on-failure`)
without a window; after **Update**, the restarted GoSpell reopens the window.
There is one GoSpell per user: a launch from another desktop session restarts the
supervised unit in the new session, and refuses to take over an unsupervised
one (quit it first).

The socket is owner-only in GoSpell's data directory, with same-user peer
credentials, versioned bounded frames, bounded queues, and I/O deadlines. It is
not a network API or the macOS embedded transcription SDK service. It carries
`Activate`, `Status`, and Annotate's recording commands. The `gospell` control
commands reach GoSpell through its local API's `POST /control`; dictation
commands go straight from there to the listener, never through the window.
The local API's `/dictations` (the TypeScript SDK's `gospell.dictation`) also
records on the listener while GoSpell is listening, as on macOS: one capture at a
time, so a client's dictation and the shortcut never end each other.

For development, run `cargo run --release`. `gospell dictate` remains an explicit
foreground diagnostic listener without the window or HUD and cannot coexist
with GoSpell's listener. Like `gospell service`, it adopts the session's Wayland
display when its shell has none, or only Xwayland's `DISPLAY` on a Wayland
login (#756, #1506). `gospell` commands reach only the
service listener, so a foreground `gospell dictate` receives none and says so at
startup when no shortcut is bound. With
`GOSPELL_APPLICATION_SUPPORT_DIR` set, launches never start, stop, or restart the
installed user unit; they forward to the GoSpell using that data directory or
become it. `GOSPELL_SYSTEMD_UNIT` names another unit for isolated tests.
`gospell logs -n 40` is the diagnostic-log view (`gospell status --lines` is gone).

The window runs on Rune's app lifetime (`rune::App`): GoSpell starts it without a
window, each `Activate` opens or focuses it with the forwarded token (on
Wayland through `xdg_activation_v1`; without a token most compositors only
mark it urgent), and closing it keeps the window's state for the next open.

## Install A Published Build

Published builds exist for x86_64 and ARM64, as a bare executable, a `.deb`,
and an `.rpm`. They are built on Debian 12 and need glibc 2.36 or later:
Debian 12, Ubuntu 23.04, Fedora 37, current Arch, or newer. ARM64 builds use
Vulkan like x64 and fall back to the CPU.

### Install script

The script installs the bare executable for your architecture into a
user-local layout (`~/.local/share/gospell`) that updates itself. It installs the
stable release, or the newest dev build (on the Dev update channel) while
there is no stable release yet; set `GOSPELL_INSTALL_CHANNEL=stable` or `=dev` to
choose:

```sh
curl -fsSL https://gospell.goml.io/files/install-linux.sh | sh
```

If a runtime library is missing, the installer names the packages to install
(with Arch names). Then open GoSpell from your application launcher, or run
`~/.local/bin/gospell`; its first run downloads a speech model.

To install the dependencies up front, or to inspect the installer before
running it:

```sh
sudo pacman -S --needed alsa-lib curl jq \
  libxkbcommon libxkbcommon-x11 libx11 libxcb openblas openssl util-linux \
  vulkan-icd-loader wl-clipboard wtype xxd
curl --proto '=https' --tlsv1.2 -fsSLO \
  https://gospell.goml.io/files/install-linux.sh
less install-linux.sh
sh install-linux.sh
~/.local/bin/gospell model install
~/.local/bin/gospell
```

When `wl-copy` is missing, the installer prints the commands to install the
Wayland helpers: on Debian or Ubuntu, `sudo apt install wl-clipboard wtype`; on
Fedora, `sudo dnf install wl-clipboard wtype`; on Arch, `sudo pacman -S --needed
wl-clipboard wtype`. `wtype` is only needed on wlroots compositors and niri,
where GoSpell uses it; GNOME and KDE paste through their RemoteDesktop portal.

The installer verifies the signed release feed, exact artifact size, and
SHA-256 before installing. It uses no root access. It creates the managed
version layout, `~/.local/bin/gospell`, a desktop launcher, and an XDG autostart
entry and a `gospell.service` user unit. It does not start recording during installation.
General › **Launch at login** turns that autostart entry on or off
(`~/.config/autostart/com.goml.gospell.desktop`); GoSpell leaves an entry it did not write alone.
Where the desktop has the Background portal (GNOME, KDE), GoSpell asks it at startup
to run in the background, and Launch at login goes through it: the portal writes
and removes that same autostart entry (marked `X-XDP-Autostart=com.goml.gospell`).
Elsewhere GoSpell writes the entry itself. The launcher entry below is written only
when no installed package or data directory provides one, and left as it is
while the program it starts is there. Installed by a version manager (mise,
asdf), both entries start its shim (`~/.local/share/mise/shims/gospell`), which
outlives each version, so an upgrade can't strand them. An entry GoSpell wrote
whose program is gone points at this GoSpell the next time it starts, or goes
once a package ships its own.
The launcher entry is `~/.local/share/applications/com.goml.gospell.desktop`, named
for GoSpell's app id `com.goml.gospell`, which its windows also report. Earlier installs
named both entries `gospell.desktop`; GoSpell and the installer rename GoSpell's own.
Its icon is `com.goml.gospell`: packages install it in the hicolor theme, and a
direct install gets it in `~/.local/share/icons/hicolor` when GoSpell first starts.
The tray's symbolic mark, `com.goml.gospell-symbolic.svg`, is always written there
too, in `hicolor/scalable/apps`, because packages don't ship it.

Remove the application while preserving logs and settings with:

```sh
curl -fsSL https://gospell.goml.io/files/install-linux.sh | sh -s -- uninstall
```

or, with a saved copy of the installer, `sh install-linux.sh uninstall`.

### Upgrading from 2.3.1

GOSPELL 2.3.1 read every `/dev/input` device on Wayland, so it needed the `input`
group. Current builds don't: they use the GlobalShortcuts portal or `gospell`
commands bound in your desktop (see [Shortcuts](#shortcuts)). Don't grant input
access; install the new build instead.

The new build is a separate install in `~/.local/share/gospell` and imports
nothing from 2.3.1's `~/.local/share/voice-control`, so set up the model and
settings again. The installer refuses to replace 2.3.1's files, so remove them
first (the paths below assume the default XDG directories):

```sh
systemctl --user disable --now gospell.service
rm -f ~/.config/systemd/user/gospell.service ~/.local/bin/gospell \
  ~/.local/share/applications/gospell.desktop ~/.config/autostart/GOSPELL.desktop
systemctl --user daemon-reload
rm -rf ~/.local/share/voice-control   # optional: 2.3.1's settings, logs, and models
curl -fsSL https://gospell.goml.io/files/install-linux.sh | sh
~/.local/bin/gospell model install
~/.local/bin/gospell
```

On Hyprland, bind the shortcut in your config as described in
[Shortcuts](#shortcuts).

### Debian, Ubuntu, Fedora, and openSUSE

The `gospell` package installs `/usr/bin/gospell`, the desktop entry, and the systemd
user unit `gospell.service` (the same files as the AUR package below). Download
it for your architecture from <https://gospell.goml.io/download/linux-x64-deb>
(`linux-arm64-deb`, `linux-x64-rpm`, `linux-arm64-rpm`), then:

```sh
sudo apt install ./gospell.deb            # Debian, Ubuntu
sudo dnf install ./gospell.rpm            # Fedora (zypper install on openSUSE)
systemctl --user enable gospell.service   # optional: start GoSpell at login
```

There is no apt or dnf repository yet. GoSpell never replaces a package-installed
executable: when a new stable release is out, Settings shows the command that
downloads and installs its package. Package installs follow the stable channel,
so a package from the dev channel learns of the next stable release only.

### AUR

From the next release on, the AUR package `gospell-bin` installs `/usr/bin/gospell`,
the desktop entry, and the systemd user unit `gospell.service`, from the same
release executable, for `x86_64` and `aarch64`. It is not on the AUR yet. With
an AUR helper:

```sh
yay -S gospell-bin
systemctl --user enable gospell.service   # optional: start GoSpell at login
```

pacman updates it; GoSpell never replaces a package-installed executable, and
Settings says "Updated by your package manager". It is unrelated to the
official `hex` package (a hex dump tool that installs `/usr/bin/hx`).

## Install From Source

Install the native dependencies and, for a source build, the Rust toolchain:

```sh
sudo pacman -S --needed base-devel git rustup python alsa-lib curl jq openssl xxd \
  util-linux libxkbcommon libxkbcommon-x11 libx11 libxcb openblas \
  vulkan-headers vulkan-icd-loader \
  shaderc spirv-headers clang cmake pkgconf wl-clipboard wtype
rustup default stable
```

Build and install GoSpell as your desktop user:

```sh
git clone https://github.com/goml/gospell.git
cd gospell
./scripts/install-linux.sh
~/.local/bin/gospell model install
~/.local/bin/gospell
```

Do not run the installer as root. It installs a user-local binary, desktop
launcher, and autostart entry in the same layout as published builds, and
marks the version as a source build (`source-build` beside the executable).
The in-app updater never replaces a source build; Settings shows "Updated from
your source checkout", and you update by pulling and running the installer
again. Installing a published release over it switches back to signed
updates. With a custom
`GOSPELL_APPLICATION_SUPPORT_DIR`, `cargo run --release` runs an
unmanaged development GoSpell instead; without one it forwards to the installed GoSpell.

## Dictate

Hold **Alt-Space**, speak, then release. Double-tap the shortcut to keep
recording, and press the same chord again to finish. **Shortcut mode** picks how the shortcut
triggers: **Hold or double-tap** (the default), **Hold**, **Tap** (starts and
stops with single presses), or **Double-tap** (waits for two complete taps,
and needs a shortcut with a key).
**Ctrl-Alt-V** pastes the last dictation again. Settings shows listener state,
Start/Stop, and operational errors. Changing a shortcut or a setting the
listener reads at start temporarily stops listening and restores the previous
running state after the edit.

Modes apply corrections, OpenCode rewriting, and transformations per
application or website; the application picker lists `.desktop` entries. On
X11, GoSpell reads the focused application from the active window's process name
(`code`, `chrome`). On Wayland, compositors with the foreign-toplevel protocol
(wlroots compositors such as Sway, niri, Hyprland) report the activated
window's app ID, which GoSpell names by its `.desktop` entry
(`google-chrome-stable`, `firefox`). GNOME and KDE don't report it, so the
Global mode applies there.

Website rules read the focused page's address through AT-SPI, the desktop
accessibility bus, on X11 and Wayland. Firefox exposes it whenever the
accessibility bus is running. Chrome and other Chromium browsers expose it
only with accessibility turned on: launch them with
`--force-renderer-accessibility` (for example in
`~/.config/chrome-flags.conf`), or run a screen reader. Without it, the
application rule applies. Completed dictations are kept in History.

**Turn off the mic when not dictating** (General) releases the microphone between dictations; it then opens
on the shortcut press without pre-roll. **While dictating** can mute the default
output through `wpctl` (PipeWire) or `pactl` (PulseAudio), or pause playing
MPRIS media players over D-Bus, once the hold passes 300 ms, so shortcut chords
and short taps never do; GoSpell restores only what it changed.
Cancelling shortcut capture preserves the old binding unless the new binding
has already been saved; listening resumes only if it was previously running.

### Bluetooth headsets

A Bluetooth headset can't play high-quality audio (A2DP) and use its
microphone at once. While any application records from the headset's
microphone, PipeWire (WirePlumber) or the headset switches it to the
hands-free profile (HFP/HSP): mono, call-quality sound in both directions.
This is how Bluetooth audio works, not something GoSpell chooses, and how quickly
the headset switches back depends on the headset and WirePlumber's settings.

If GoSpell records from the headset's microphone, **Turn off the mic when not
dictating** trades off differently on and off:

- **On** opens the microphone only when you press the shortcut,
  so each dictation switches the headset to hands-free and back. Playback
  drops out or pauses during the switch, and the microphone takes longer to
  open, so the first words can be lost.
- **Off** (the default) keeps the microphone open, so the headset stays in hands-free
  mode, with call-quality playback, for as long as GoSpell listens.

The recommended setup is a separate microphone for input (the laptop's
built-in microphone or a USB microphone) and the Bluetooth earbuds for output
only. Pick that microphone in General's **Microphone** list, or make it the
system's default input (for example with `wpctl set-default`), so nothing
opens the headset's microphone.

General › Advanced's Bluetooth option (`avoid_bluetooth_microphone`, on by
default) helps only part of the way:

- It applies only while the microphone is **System default** and the default
  input is a Bluetooth headset. A Bluetooth microphone you picked in Settings,
  or `--device`, is always used as named.
- It needs another hardware input that isn't reported unplugged, and
  `pactl` (PipeWire's PulseAudio server or PulseAudio) to move the stream.
  With no other input, GoSpell records from the headset.
- On Linux, GoSpell can only open ALSA's default device, which is the Bluetooth
  source, and then moves its own stream to the other microphone. The stream
  is briefly on the headset first, so the headset may still switch to
  hands-free mode, and GoSpell doesn't switch its profile back. Forcing the
  headset's profile is up to your sound settings.
- It changes only GoSpell's own recording, never other applications or the
  system default.

To avoid the switch entirely, use the recommended setup above.

## Shortcuts

GoSpell gets its shortcuts one of three ways, and all of them drive the same
dictation rules:

- **X11:** GoSpell grabs the shortcuts Settings records.
- **Wayland with the GlobalShortcuts portal** (for example niri with
  `xdg-desktop-portal-gnome`, GNOME, or KDE): GoSpell asks the desktop for the
  shortcuts Settings records. The desktop decides: it may grant them, assign
  another key, or refuse one that it or another binding already uses. Settings
  lists what the desktop granted under **Desktop shortcuts**, with an error for
  any it refused. A desktop may keep an older binding when you record a new
  shortcut (KDE does); where its portal supports it, **Desktop shortcuts >
  Open** shows the desktop's own dialog for GoSpell's shortcuts, and Settings
  follows what you choose there. KDE asks once in a "Global Shortcuts
  Requested" dialog; GoSpell waits for your answer, and if you cancel it KDE asks
  again the next time GoSpell binds. GoSpell's shortcuts are listed under **GoSpell** in
  System Settings › Keyboard › Shortcuts. The portal identifies GoSpell by its app id
  `com.goml.gospell`, its installed `com.goml.gospell.desktop` entry, and by inspecting
  the GoSpell process. A downloaded executable has no entry, so GoSpell writes a minimal
  `~/.local/share/applications/com.goml.gospell.desktop` that runs it (a managed
  install replaces it); if the portal still can't find it, restart the portal with
  `systemctl --user restart xdg-desktop-portal`. Run `gospell service` directly:
  a setgid wrapper such as `newgrp`, once used to grant input-device access,
  makes the portal refuse GoSpell. The desktop delivers the keys to GoSpell, not to the
  focused application. On GNOME and KDE Plasma, new setups dictate with Ctrl+Alt+Space,
  because GNOME keeps Alt+Space for the window menu and Plasma for KRunner; Settings warns when a shortcut uses a key GNOME
  keeps for itself. Keys you change in GNOME Settings › Keyboard work at once,
  and GoSpell's Settings and `gospell status --json` show them. Annotate's shortcut (F9
  by default) sits under the dictation shortcut in General. **Disable** (General or the tray) keeps GoSpell disabled
  across restarts until you enable it again. On GNOME, Disable also removes
  GoSpell's entries from Settings › Keyboard › Global Shortcuts; Enable then asks
  you to approve them again. GoSpell also removes the duplicate list that versions
  before `com.goml.gospell` left under the id `gospell`.
- **Hyprland** has the portal but takes every shortcut without a key, so
  nothing happens until you bind one in your config, and the key Settings
  records is not used. GoSpell can't tell whether your config binds it. Prefer
  keys without modifiers, because Hyprland adds every modifier you still hold
  to GoSpell's paste (see [Native Wayland Requirements](#native-wayland-requirements)).
  Avoid Alt in the bind too: Hyprland takes the key (Space) but lets Alt
  through to the focused window, so Electron apps with a hidden menu bar
  (Slack, Discord, VS Code) see Alt pressed and released alone, move focus to
  their menu, and the paste lands there instead of the message box
  (#1023). GoSpell still logs the
  paste as sent. Ctrl+Space or a key without modifiers works.
  Hyprland names each shortcut `com.goml.gospell:<shortcut>`: `com.goml.gospell:dictation`,
  `com.goml.gospell:paste-last`, `com.goml.gospell:capture` (Annotate),
  `com.goml.gospell:raw-dictation` (Dictate without processing), and
  `com.goml.gospell:terminal-paste` (Labs › Terminal paste shortcut, while on).
  The names stay the
  same when you record another key in Settings (#1376), so a bind keeps
  working; `hyprctl globalshortcuts` lists them while GoSpell runs. For example:

```lua
hl.bind("End", hl.dsp.global("com.goml.gospell:dictation"))
hl.bind("F10", hl.dsp.global("com.goml.gospell:paste-last"))
```

  Traditional Hyprland configs write
  `bind = , End, global, com.goml.gospell:dictation`. GoSpell 3.3 and earlier put the
  recorded key in the name (`com.goml.gospell:dictation-ALT-space`); GoSpell still
  answers those names, but only for the key recorded in Settings when the
  bind was written, so switch them to the bare names before you record
  another key. Binds to `gospell:dictation` or `gospell:paste-last` (names from
  before GoSpell's app id was `com.goml.gospell`) do nothing now, so replace them. Remove any `cancel-dictation`
  bind: GoSpell no longer has it. Hyprland 0.56's Lua binds send no release when the modifier comes
  up before the key (Alt before Z); 0.57 fixes this. On 0.56, Toggle is
  unaffected: the next press still finishes. In Hold, recording continues
  until the next press and release, so lift the key first or use Toggle.
  For hold-to-talk that doesn't depend on the portal's release, bind GoSpell's
  own commands instead (below), for example
  `bind = , End, exec, gospell dictation start` with
  `bindr = , End, exec, gospell dictation stop`, or one
  `bind = , End, exec, gospell dictation toggle`. Pasting into a terminal needs
  **Terminal paste** (Ctrl+Shift+V) unless the terminal accepts
  Ctrl+V.
- **Wayland without the portal** (for example Sway): nothing registers global
  shortcuts. Settings lists these commands; bind them in your desktop's own
  keyboard configuration. They reach only the listener `gospell start` or
  `gospell service` runs; a foreground `gospell dictate` can't receive them:

```sh
gospell dictation start     # bind to a key's press: start recording
gospell dictation stop      # bind to the same key's release: stop and transcribe
gospell dictation toggle    # one key: start, then stop and transcribe
gospell paste-last          # paste the last dictation again
gospell typed-text          # Labs › Transform typed text: replace the focused field's text
gospell dictation toggle --raw  # dictate without processing: paste the words as heard
```

For example, hold-to-dictate on F9 in Sway, and a toggle in any desktop that
runs commands on key presses only:

```sh
bindsym F9 exec gospell dictation start
bindsym --release F9 exec gospell dictation stop
bindsym Ctrl+Alt+d exec gospell dictation toggle
```

GNOME 46 and older (Ubuntu 24.04) have no shortcuts portal. There, Settings ›
Desktop shortcuts › **Add GNOME keyboard shortcuts** writes GoSpell's own entries
into GNOME Settings › Keyboard › Custom Shortcuts with your shortcuts:
`gospell dictation toggle` (GNOME runs custom shortcuts on the key press only, so
dictation toggles), `gospell paste-last`, `gospell typed-text` while Transform typed
text is on and its shortcut is bound, and `gospell annotate toggle` while Annotate
is on. GoSpell removes them while it's disabled and puts them back when you enable
it; **Remove** takes them out for good. Keys you change in GNOME Settings stay.
GoSpell never touches your other custom shortcuts.

`gospell dictation stop --print` stops the same way, then waits up to 60 s and
writes the transcript to stdout instead of pasting it, after the same
processing a paste gets. Only that command waits; the listener stops
recording at once, so a following `start` isn't blocked. No speech exits 4
and prints nothing; a failure, cancel, or timeout prints nothing, exits 1,
and never pastes. History keeps the text as Printed, and Paste Last skips it.
See `docs/cli.md`.

The commands are safe to bind anywhere, including X11 beside the grabs. They
talk to the running GoSpell and never start it: without one, or while GoSpell is
not listening, they print a one-line error and exit non-zero. Starting while recording,
and stopping while idle do nothing, so key repeat is
harmless. Start and stop bypass Hold, Toggle, and double-tap: start records,
stop finishes. A shortcut press also finishes a recording a command started.

In **Tap** mode, a **Cancel** shortcut (Escape by default) throws away the
recording: nothing is pasted or saved, and dictations already transcribing
still finish. On X11, GoSpell grabs that key only while a recording runs, so it
works normally everywhere else. On Wayland a desktop shortcut would hold the
key all the time, so GoSpell binds nothing; bind `gospell dictation cancel` to a key in
your desktop's keyboard shortcuts instead. `gospell dictation cancel` works in any
mode. In the Hold modes there is no cancel: every dictation finishes and pastes.
On KDE, GoSpell removes the Cancel dictation shortcut older builds asked for,
so its key returns to your applications.

Shortcuts need a non-modifier key. Modifier-only shortcuts, such as Super
alone, are not supported on Linux.

On X11, GoSpell grabs Escape only while Annotate draws, where it stops drawing. If
another application holds it, drawing goes on and GoSpell logs it once.

Recording sounds are enabled at 50% volume by default, including when upgrading
older settings. A start sound is queued immediately when the shortcut starts capture,
a stop sound marks the end of a retained recording (not completed transcription
or paste), and a cancel sound acknowledges cancellation of an active capture.
Brief taps still play the start sound, but recordings shorter than 300 ms remain
discarded and do not play the stop sound. **Sound volume** in Settings
is a slider from Off to 100%; releasing it saves without restarting the
listener and previews the start sound unless it is at Off. `gospell dictate` uses
the same saved volume. Playback uses the default audio output through a bounded
background worker; unavailable audio output does not prevent dictation.

Closing the window leaves GoSpell running on both X11 and Wayland. The
recording/processing pill never takes focus or intercepts clicks, with or
without the window open: a Rune overlay that is a layer-shell surface on
Wayland and an override-redirect window on X11. On a Wayland compositor without
layer-shell (GNOME), only the pill opens on XWayland, as that X11 window with an
empty input shape on the primary monitor; the rest of GoSpell, including the window
and portal shortcuts, stays on Wayland. It needs the window's event
loop, so it is unavailable when the window cannot start (no display or GPU)
and in `gospell dictate`. **Recording indicator** places it at the top or bottom of the
screen, or turns it off.

Insertion uses the clipboard and **Ctrl-V** for new installations. Enable
**Terminal paste** in Settings for targets that require **Ctrl-Shift-V**.
Labs › Terminal paste shortcut (`gospell labs on terminal-paste-shortcut`, off by
default) adds a second dictation shortcut whose paste is always Ctrl-Shift-V,
while the main shortcut keeps this setting. On X11 GoSpell grabs it like the other
dictation shortcuts; on Wayland it needs the desktop's shortcuts portal (GoSpell
asks for `com.goml.gospell:terminal-paste`). There is no `gospell` command for it, so
without X11 grabs or the portal the shortcut cannot be registered.
Existing X11 settings retain their previous Ctrl-Shift-V behavior until changed.
The target application must accept the selected binding.

After a paste, GoSpell puts the previous clipboard back, as on macOS
([#391](https://github.com/goml/gospell/issues/391)). Before writing the
transcript it reads every format the clipboard offers (text, rich text, images),
up to 32 MiB within one second, and 500 ms after the paste shortcut serves them
again from GoSpell until something else copies. It restores only if nothing newer
replaced the transcript in the meantime: a later dictation, a copy, or another
application. An empty clipboard stays empty. A larger or unreadable clipboard
is left holding the transcript, and GoSpell's log says why. When automatic paste
fails after `wl-copy` has taken the transcript, it stays on the clipboard for
Ctrl+V. Nothing confirms the target read the paste, so a target stalled past
the delay can paste the restored clipboard instead (see
[#24](https://github.com/goml/gospell/issues/24)).

Labs › Keep dictation on clipboard (`gospell labs on keep-on-clipboard`, off by
default) leaves each ordinary dictation on the clipboard instead: the paste
snapshots nothing and schedules no restore, and a restore an earlier paste was
still waiting to make is dropped, so a later paste with the lab off cannot
bring an older clipboard back. A typed-text replacement, which saved the
clipboard before it copied the selection, and a capture's PNG still restore,
and while the lab is off nothing changes.

On Wayland, restoring needs the compositor's `ext-data-control` protocol
(KDE Plasma 6, recent wlroots compositors) or `wlr-data-control` (wlroots
compositors, niri, Hyprland); without either the transcript stays, and
Settings › Output says so.

GNOME offers neither. There you can opt in to Labs › Restore clipboard on
GNOME (`gospell labs on gnome-clipboard-restore`, off by default): GoSpell then reads
and restores the clipboard through XWayland, which GNOME keeps in sync with
Wayland apps both ways. It works only while XWayland is already running (an X11
app is open and `DISPLAY` is set); GoSpell never starts XWayland, and otherwise the
transcript stays and the log says why. The same rules apply: nothing newer is
ever overwritten.

On GNOME, GoSpell pastes through the RemoteDesktop portal, and GNOME shows its
remote-control indicator while that session is open. GoSpell closes it 15 seconds
after the last paste and reopens it at the next one with the grant you
approved, so you're asked only once. On KDE Plasma, GoSpell keeps the session open
for as long as it runs: Plasma posts a "Remote Control Started" notification
whenever a session starts, so reopening it per paste would pop up constantly.

## Native Wayland Requirements

- Export the compositor's nonempty `WAYLAND_DISPLAY` in the launch environment.
  GoSpell and its window (winit) select the same native backend even when XWayland's
  `DISPLAY` is also present. `XDG_SESSION_TYPE` alone does not select Wayland.
- Install `wl-clipboard`. Every Wayland copy and paste runs `wl-copy`; without
  it, Settings and `gospell status` warn while the listener runs, and a dictation
  fails naming the package to install. GoSpell copies each transcript, then sends
  Ctrl+V (or Ctrl+Shift+V with terminal paste) through one of two general
  paths, chosen at the first paste:
  - `wtype`, when the compositor offers the virtual keyboard protocol
    (`zwp_virtual_keyboard_manager_v1`; wlroots compositors and niri) and
    `wtype` is installed.
  - Otherwise the desktop's RemoteDesktop portal
    (`org.freedesktop.portal.RemoteDesktop`; KDE, GNOME). The first paste asks
    you to allow GoSpell to control the keyboard; GoSpell keeps the portal's restore
    token (`remote-desktop-token` in GoSpell's data folder), so it asks once. Revoke
    it in the desktop's settings.
  - With neither, the dictation fails with "Copied to the clipboard; press
    Ctrl+V to paste" and, with `wl-copy` installed, the transcript stays on the
    clipboard.

  There is no silent XWayland, direct-typing, uinput, or privileged
  input-injection fallback; the only XWayland uses besides the HUD are the
  opt-in clipboard restore above, the opt-in call recording controls
  below, and the opt-in Annotate overlays below. Transcript text travels on stdin, not command-line
  arguments.
- The overlay uses layer-shell. Without it (GNOME), only the HUD opens on
  XWayland as an override-redirect, click-through window that never takes
  focus. The meeting capsules take clicks, so there a call offer opens the
  Meetings pane instead, unless you opt in to Labs › Call recording controls
  on GNOME (`gospell labs on gnome-meeting-capsules`, off by default): the offer
  and recording capsule then float over the call on XWayland, taking clicks
  on their buttons but never keyboard focus. It works only while XWayland is
  already running; GoSpell never starts it. Annotate's capsule and ink take
  clicks too, so a capture records with no capsule unless you opt in to Labs ›
  Annotate on GNOME (`gospell labs on gnome-annotate`, off by default): the
  capsule and ink then float on XWayland the same way. Esc can't stop drawing
  there, so use the capsule's pen button or let go of a held Annotate key (a
  tap of it stops the recording). With neither, Settings reports that the HUD
  is unavailable rather than presenting a normal focus-taking window as an
  overlay.
- Shortcuts come from the GlobalShortcuts portal or from your own keybindings
  for the `gospell` commands ([Shortcuts](#shortcuts)). GoSpell reads no input devices
  and needs no `input` group membership or other device permission. If the
  desktop closes the portal session, the listener stops with an error and an
  active recording is cancelled; enable it again from Settings or `gospell start`.
- GoSpell can't see which keys are down on Wayland, and some compositors merge
  held physical modifiers into its paste: on Hyprland, Alt still held from
  Alt+Z turns `wtype`'s Ctrl+V into Ctrl+Alt+V, and a paste-last bound to
  Ctrl+Alt+V is matched by Hyprland again and never reaches the app. The
  RemoteDesktop portal shares the desktop's keyboard the same way. So when a
  shortcut with modifiers asks for a paste, GoSpell waits for its release (the
  portal's Deactivated) plus 250 ms, at most 2 s after a press whose release
  never comes. After a `gospell` command, whose keybinding GoSpell can't see, it waits
  250 ms. A modifier still held past that changes the paste, so bind keys
  without modifiers (End, F-keys) or let go of the modifiers before the
  transcript arrives. GoSpell logs a dictation as pasted once it sent the paste
  shortcut; it can't confirm the application accepted it. A compositor that
  passes a shortcut's Alt through to the app (Hyprland) can also open an
  Electron app's menu when Alt comes up, which takes the paste (see
  [Shortcuts](#shortcuts)).

## Updates And Validation

Managed installs check for signed updates when GoSpell starts and every
24 hours until an update is ready. GoSpell downloads, verifies, and activates an
available update, then offers an **Update** button in the window that restarts
the unit and reopens the window. The next launch
through `~/.local/bin/gospell` also uses the activated version. The signed update
path is implemented but still awaiting a complete cross-version validation on
the supported Arch/i3 host.

See [`plans/linux.md`](plans/linux.md) for the engineering contract and remaining
validation work. The native Wayland implementation builds on the feature
proposed in [PR #28](https://github.com/goml/gospell/pull/28), with separate
input-state, lifecycle, and paste regression coverage. Physical device,
compositor, and target-application smoke tests remain necessary before a release.
`scripts/test-wayland-paste.sh /path/to/compiled-test-executable /path/to/gospell` runs the real
paste helpers against a GTK target under an isolated headless Sway compositor.
Its first paste runs while another virtual keyboard holds Ctrl and Alt.
It then checks that every format of the previous clipboard comes back after the
paste, and that an empty clipboard stays empty.
It also starts an isolated GoSpell, opens its window through a second `gospell app`
(the window must belong to the same process), repeats paste while the window is
open, closes the window, checks that the same process still answers, opens the
window again (`GOSPELL_WAYLAND_REOPEN=0` skips that), and quits. It requires the GTK development
libraries, Sway, `wl-clipboard`, `wtype`, `dbus-run-session`, and a Vulkan driver
(Mesa's software driver is sufficient), and must run as a non-root user. It uses
isolated app data and no microphone; CI runs it with the display-free suite and
Xvfb hotkey tests.

`scripts/test-linux-dictation.sh /path/to/gospell /path/to/parakeet-unified-en-0.6b-Q8_0.gguf /path/to/jfk.wav`
checks the complete X11 app dictation path with a private PulseAudio virtual
microphone and Xvfb display. It opens the window in the running GoSpell through a
second `gospell app`, replays the public JFK sample from whisper.cpp, holds and releases the real
shortcut, verifies the transcribed words in a GTK editor, and checks orderly
application shutdown and microphone release. It needs PulseAudio, its ALSA
plugin, `xdotool`, Xvfb, the GTK development libraries, and a Vulkan driver for
the window (Mesa's software driver is sufficient). It runs as a normal user with
temporary settings; it does not use physical audio devices or personal recordings.
CI downloads and verifies the pinned model and sample for this check.

`python3 scripts/test-linux-service.py /path/to/gospell` is a display-free,
device-free single-instance check: commands fail fast without GoSpell, `gospell start`
becomes GoSpell, second launches (`start`, `app --hidden`, `service`, `app`) forward
and exit 0, a window request without a display fails only the window,
same-user socket permissions, version-1 clients get an error, invalid,
oversized, and stalled frames, crash/stale-socket recovery, two racing launches
yield one GoSpell, `gospell quit` drains and removes the socket, and a custom data
directory never runs `systemctl`.
