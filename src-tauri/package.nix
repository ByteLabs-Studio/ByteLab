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

  nativeBuildInputs =
    [
      bun
      nodejs
      pkg-config
      cargo-tauri.hook
      npmHooks.npmConfigHook
    ] ++ lib.optionals stdenv.isLinux [ wrapGAppsHook3 ];

    buildInputs =  lib.optionals stdenv.isLinux [
      glibc
      webkitgtk_4_1
      libsoup_3
      gtk3
    ];

  postInstall = lib.strings.optionalString stdenv.isDarwin ''
    mkdir $out/bin
    ln -sf $out/Applications/ByteLab.app/Contents/MacOS/bytelab $out/bin/bytelab
  '';
})
