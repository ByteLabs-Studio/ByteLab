{
  pkgs ? import <nixpkgs> { },
  ...
}:

let
  bunDeps = import ../bun-packages.nix { inherit pkgs; };

  nodeEnv = pkgs.buildNpmPackage {
    name = "bytelab-node-env";
    src = ../.;
    packageJSON = ../package.json;
    inherit bunDeps;
  };
in
pkgs.stdenv.mkDerivation {
  pname = "bytelab";
  version = "0.1.0";

  src = ../.;

  nativeBuildInputs = with pkgs; [
    bun
    cargo
    rustc
    pkg-config
    cargo-tauri
  ];

  buildPhase = ''
    export PATH=${nodeEnv}/bin:$PATH
    bun run build
    cargo tauri build
  '';

  installPhase = ''
    mkdir -p $out/bin $out/Applications
    cp -r target/release/bundle/macos/ByteLab.app $out/Applications
    makeWrapper "$out/Applications/ByteLab.app/Contents/MacOS/ByteLab" "$out/bin/bytelab"
  '';
}
