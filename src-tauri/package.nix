{
  pkgs ? import <nixpkgs> { },
  ...
}:
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

  fetchPhase = ''
    cd $src
    bun install
    cd src-tauri
    cargo vendor
  '';

  buildPhase = ''
    # cd src-tauri
    cargo tauri build
  '';

  installPhase =
    if pkgs.stdenv.isDarwin then
      ''
        #!/bin/bash
        mkdir -p $out/bin
        mkdir -p $out/Applications
        cp -r target/release/bundle/macos/ByteLab.app $out/Applications
        makeWrapper "$out/Applications/ByteLab.app/Contents/MacOS/ByteLab" \
          "$out/bin/bytelab"
      ''
    else
      ''
        #!/bin/bash
      '';
}
