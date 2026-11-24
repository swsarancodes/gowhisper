{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.gospell;
in
{
  options.programs.gospell = {
    enable = lib.mkEnableOption "GoSpell local voice dictation";
    package = lib.mkOption {
      type = lib.types.package;
      description = "GoSpell package to install.";
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = lib.elem pkgs.stdenv.hostPlatform.system [
          "x86_64-linux"
          "aarch64-linux"
        ];
        message = "The GoSpell Nix package supports x86_64-linux and aarch64-linux only.";
      }
    ];
    environment.systemPackages = [ cfg.package ];
  };
}
