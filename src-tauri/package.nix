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
    makeWrapper
  ];

  buildPhase = ''
    export HOME=$TMPDIR
    export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
    export NIX_SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt

    bun install --frozen-lockfile
    bun run build
    cargo tauri build
  '';

  installPhase = if pkgs.stdenv.isDarwin then ''
    #!/bin/bash
    mkdir -p $out/bin $out/Applications
    cp -r src-tauri/target/release/bundle/macos/ByteLab.app $out/Applications
    makeWrapper "$out/Applications/ByteLab.app/Contents/MacOS/ByteLab" "$out/bin/bytelab"
  ''
  else ''
    #!/bin/bash
    mkdir -p $out/bin

    cp -r src-tauri/target/release/bytelab $out/bin/bytelab
  '';
}
