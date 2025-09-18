{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
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
            alsa-lib
            gdk-pixbuf
            atk
            gtk3
            libsoup_3
            webkitgtk_4_1
            deno
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
          shellHook = ''
            $(awk -F: -v user=$USER 'user == $1 { print $NF }' /etc/passwd)
            exit
          '';
        };

        formatter = nixfmt-tree;
      }
    );
}
