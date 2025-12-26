{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    rust-overlay.url = "github:oxalica/rust-overlay";
    naersk.url = "github:nix-community/naersk";
  };
  outputs =
    {
      nixpkgs,
      flake-utils,
      treefmt-nix,
      rust-overlay,
      ...
    }:
    flake-utils.lib.eachSystem [ "aarch64-linux" "aarch64-darwin" "x86_64-linux" ] (
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
            gtk3
            nixd
            typos
            tokei
            helix
            clippy
            librsvg
            rustfmt
            onefetch
            superhtml
            libsoup_3
            xdg-utils
            pkg-config
            gdk-pixbuf
            cargo-bundle
            rust-analyzer
            typescript-language-server
            rust-bin.nightly.latest.default
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
        };

        packages.default = pkgs.callPackage ./src-tauri/package.nix { inherit pkgs; };
        formatter = formatters.wrapper;
      }
    );
}
