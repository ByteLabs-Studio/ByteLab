{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };
  outputs =
    {
      nixpkgs,
      flake-utils,
      treefmt-nix,
      rust-overlay,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ (import rust-overlay) ];
        };

        formatters =
          (treefmt-nix.lib.evalModule pkgs (_: {
            projectRootFile = ".git/config";
            programs = {
              nixfmt.enable = true;
              nixf-diagnose.enable = true;
              rustfmt.enable = true;
              toml-sort.enable = true;
            };
            settings.formatter.rustfmt = {
              unstable-features = true;
              tab_spaces = 2;
              trailing_semicolon = false;
              style_edition = "2024";
              use_try_shorthand = true;
              wrap_comments = true;
            };
          })).config.build;
      in
      with pkgs;
      {
        devShells.default = mkShell rec {
          buildInputs = [
            nil
            atk
            bun
            gtk3
            nixd
            deno
            tokei
            helix
            # rustc
            # cargo
            rust-bin.nightly.latest.default
            clippy
            librsvg
            rustfmt
            onefetch
            superhtml
            libsoup_3
            pkg-config
            gdk-pixbuf
            rust-analyzer
            typescript-language-server
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
