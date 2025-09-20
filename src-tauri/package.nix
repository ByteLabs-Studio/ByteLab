{
  pkgs ? import <nixpkgs> { },
  ...
}:
with pkgs;
rustPlatform.buildRustPackage (finalAttrs: {
  pname = "bytelab";
  version = "0.1.0";

  src = ../.;
  cargoHash = "sha256-lv5HWhAOk00O4H6Mi93yLhB0b894lRgB8oy9OaRR/yU=";
  cargoRoot = "src-tauri";
  buildAndTestSubdir = finalAttrs.cargoRoot;

  npmDeps = fetchNpmDeps {
    name = "${finalAttrs.pname}-${finalAttrs.version}-npm-deps";
    src = ../.;
    hash = "sha256-BKQ6ejssLBoN64yUxBCv8rzo/F0CaDj71Av4u1ZP50Q=";
  };

  nativeBuildInputs = with pkgs; [
    bun
    cargo
    rustc
    nodejs
    pkg-config
    makeWrapper
    cargo-tauri
    npmHooks.npmConfigHook
  ];

  buildPhase = ''
    #!/bin/bash
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
})
