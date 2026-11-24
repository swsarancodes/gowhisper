{
  description = "GOSPELL local-first voice dictation";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { self, nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      package = pkgs: self.packages.${pkgs.stdenv.hostPlatform.system}.gospell;
    in
    {
      packages = forSystems (
        pkgs:
        let
          gospell = pkgs.callPackage ./nix/package.nix { };
        in
        {
          inherit gospell;
          default = gospell;
        }
      );

      overlays.default = final: _prev: {
        gospell = final.callPackage ./nix/package.nix { };
      };

      nixosModules.gospell =
        { pkgs, ... }:
        {
          imports = [ ./nix/module.nix ];
          programs.gospell.package = nixpkgs.lib.mkDefault (package pkgs);
        };
      nixosModules.default = self.nixosModules.gospell;

      homeManagerModules.gospell =
        { pkgs, ... }:
        {
          imports = [ ./nix/hm-module.nix ];
          programs.gospell.package = nixpkgs.lib.mkDefault (package pkgs);
        };
      homeManagerModules.default = self.homeManagerModules.gospell;

      devShells = forSystems (pkgs: {
        default = (package pkgs).devShell;
      });
      checks = forSystems (pkgs: import ./nix/checks.nix { inherit self pkgs; });
      formatter = forSystems (pkgs: pkgs.nixfmt);
    };
}
