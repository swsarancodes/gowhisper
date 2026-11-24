{ self, pkgs }:
let
  inherit (pkgs) lib;
  gospell = self.packages.${pkgs.stdenv.hostPlatform.system}.gospell;
  shell = self.devShells.${pkgs.stdenv.hostPlatform.system}.default;
  home =
    settings:
    (self.inputs.home-manager.lib.homeManagerConfiguration {
      inherit pkgs;
      modules = [
        self.homeManagerModules.gospell
        {
          home.username = "gospell-test";
          home.homeDirectory = "/home/gospell-test";
          home.stateVersion = "26.05";
          programs.gospell = settings;
        }
      ];
    }).config;
  enabled = home {
    enable = true;
    autostart = true;
  };
  manual = home { enable = true; };
  disabled = home { enable = false; };
  declared = home {
    enable = true;
    shortcut = "control+option+space";
    model = "parakeet_v3";
    installModel = true;
    settings = {
      sound_effect_volume = 0.4;
      microphone = null;
      "transcription.language" = "de";
    };
  };
  declaredSettings = (pkgs.formats.json { }).generate "gospell-settings.json" {
    dictation_hotkey = "control+option+space";
    "transcription.model" = "parakeet_v3";
    "transcription.language" = "de";
    sound_effect_volume = 0.4;
    microphone = null;
  };
  custom = home {
    enable = true;
    autostart = true;
    package = pkgs.hello;
    systemdTarget = "sway-session.target";
  };
  system =
    (self.inputs.nixpkgs.lib.nixosSystem {
      system = pkgs.stdenv.hostPlatform.system;
      modules = [
        self.nixosModules.gospell
        {
          programs.gospell.enable = true;
          system.stateVersion = "26.05";
        }
      ];
    }).config;
in
{
  package = pkgs.runCommand "gospell-package-check" { } ''
    export HOME="$TMPDIR/home"
    mkdir -p "$HOME"
    ${lib.getExe gospell} --version
    ${lib.getExe gospell} model status | grep '^missing[[:space:]]'
    touch "$out"
  '';

  shell-environment =
    assert lib.all (name: shell.${name} == gospell.${name}) [
      "BLA_VENDOR"
      "OPENSSL_NO_VENDOR"
    ];
    # OpenBLAS ordering belongs to build.rs, not an injected Nix-only workaround.
    assert !(gospell ? RUSTFLAGS) && !(shell ? RUSTFLAGS);
    assert lib.all
      (package: builtins.elem "${lib.getLib package}/lib" (lib.splitString ":" shell.LD_LIBRARY_PATH))
      [
        pkgs.vulkan-loader
        pkgs.wayland
        pkgs.libxkbcommon
        pkgs.pipewire
        pkgs.libva
      ];
    assert lib.all (package: builtins.elem (lib.getDev package) shell.nativeBuildInputs) [
      pkgs.curl
      pkgs.wl-clipboard
      pkgs.wtype
      pkgs.ffmpeg-headless
    ];
    pkgs.runCommand "gospell-shell-environment-check" { } ''
      test -d ${shell.ALSA_PLUGIN_DIR}
      ${lib.getExe' pkgs.ffmpeg-headless "ffmpeg"} -hide_banner -encoders | grep ' libx264 ' >/dev/null
      test -x ${lib.getExe' pkgs.ffmpeg-headless "ffprobe"}
      touch "$out"
    '';

  modules =
    assert builtins.elem gospell system.environment.systemPackages;
    assert builtins.elem gospell enabled.home.packages;
    assert !(builtins.elem gospell disabled.home.packages);
    assert manual.systemd.user.services.gospell.Install.WantedBy == [ ];
    assert !(disabled.systemd.user.services ? gospell);
    assert enabled.systemd.user.services.gospell.Service.ExecStart == [ "${lib.getExe gospell} service" ];
    assert enabled.systemd.user.services.gospell.Service.Restart == "on-failure";
    assert enabled.systemd.user.services.gospell.Service.Type == "notify";
    assert enabled.systemd.user.services.gospell.Service.NotifyAccess == "main";
    assert builtins.elem "GOSPELL_APPLICATION_SUPPORT_DIR=${enabled.xdg.dataHome}/gospell"
      enabled.systemd.user.services.gospell.Service.Environment;
    assert custom.systemd.user.services.gospell.Service.ExecStart == [ "${lib.getExe pkgs.hello} service" ];
    assert lib.all (name: custom.systemd.user.services.gospell.Unit.${name} == [ "sway-session.target" ]) [
      "After"
      "PartOf"
    ];
    assert custom.systemd.user.services.gospell.Install.WantedBy == [ "sway-session.target" ];
    assert !(enabled.home.activation ? gospellSettings);
    assert !(enabled.systemd.user.services ? gospell-model);
    assert lib.hasInfix (builtins.unsafeDiscardStringContext "settings apply ${declaredSettings}") (
      builtins.unsafeDiscardStringContext declared.home.activation.gospellSettings.data
    );
    assert lib.elem "reloadSystemd" declared.home.activation.gospellSettings.after;
    assert declared.systemd.user.services.gospell-model.Service.Type == "exec";
    assert declared.systemd.user.services.gospell-model.Install.WantedBy == [ "default.target" ];
    pkgs.runCommand "gospell-module-check" { } ''
      bash -n ${enabled.systemd.user.services.gospell.Service.ExecStartPre}
      bash -n ${toString declared.systemd.user.services.gospell-model.Service.ExecStart}
      touch "$out"
    '';

  session-readiness =
    let
      xprop = pkgs.writeShellScriptBin "xprop" ''
        printf '%s\n' "''${GOSPELL_TEST_XPROP:-}"
      '';
      sleep = pkgs.writeShellScriptBin "sleep" "exit 0";
    in
    pkgs.runCommand "gospell-session-readiness-check" { } ''
      run() {
        env -i PATH=${
          lib.makeBinPath [
            xprop
            sleep
            pkgs.gnugrep
          ]
        } "$@" \
          ${pkgs.bash}/bin/bash -euo pipefail ${./wait-for-session.sh}
      }

      if run; then exit 1; fi
      if run DISPLAY=:1 GOSPELL_TEST_XPROP='_NET_SUPPORTING_WM_CHECK: not found.'; then exit 1; fi
      if run DISPLAY=:1 GOSPELL_TEST_XPROP='_NET_SUPPORTING_WM_CHECK(WINDOW): window id # 0x0'; then exit 1; fi
      run DISPLAY=:1 GOSPELL_TEST_XPROP='_NET_SUPPORTING_WM_CHECK(WINDOW): window id # 0xa00001'

      if run WAYLAND_DISPLAY=wayland-test XDG_RUNTIME_DIR="$TMPDIR"; then exit 1; fi
      ${pkgs.python3}/bin/python -c \
        'import socket, sys; sock = socket.socket(socket.AF_UNIX); sock.bind(sys.argv[1])' \
        "$TMPDIR/wayland-test"
      run WAYLAND_DISPLAY=wayland-test XDG_RUNTIME_DIR="$TMPDIR"
      run WAYLAND_DISPLAY="$TMPDIR/wayland-test"
      touch "$out"
    '';
}
