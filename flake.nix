{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };
  outputs =
    {
      nixpkgs,
      flake-utils,
      treefmt-nix,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        formatters =
          (treefmt-nix.lib.evalModule pkgs (_: {
            projectRootFile = ".git/config";
            programs = {
              nixfmt.enable = true;
              nixf-diagnose.enable = true;
              rustfmt.enable = true;
              toml-sort.enable = true;
            };
          })).config.build;
      in
      with pkgs;
      {
        devShells.default = mkShell rec {
          buildInputs = [
            rustc
            cargo
            rustfmt
            rust-analyzer
            clippy
            pkg-config
            gdk-pixbuf
            atk
            gtk3
            libsoup_3
            deno
            helix
          ]
          ++ lib.optionals pkgs.stdenv.isLinux [
            webkitgtk_4_1
            alsa-lib
          ];

          runtimeLibs = lib.optionals stdenv.isLinux [
            expat
            fontconfig
            freetype
            freetype.dev
            libGL
            pkg-config
            xorg.libX11
            xorg.libXcursor
            xorg.libXi
            xorg.libXrandr
            wayland
            libxkbcommon
          ];

          LD_LIBRARY_PATH = builtins.foldl' (a: b: "${a}:${b}/lib") "${pkgs.vulkan-loader}/lib" runtimeLibs;
          shellHook =
            if !stdenv.isDarwin then
              ''
                #!/bin/bash
                $(awk -F: -v user=$USER 'user == $1 {print $NF}' /etc/passwd)
                exit
              ''
            else
              ''
                $(dscl . -read $HOME 'UserShell' | grep --only-matching '/.*')
                exit
              '';
        };

        formatter = formatters.wrapper;
      }
    );
}
