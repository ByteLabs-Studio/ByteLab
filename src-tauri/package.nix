{pkgs, naersk}:
with pkgs;
let
  rust-toolchain = rust-bin.selectLatestNightlyWith (toolchain: toolchain.default);
in
(callPackage naersk {
  cargo = rust-toolchain;
  rustc = rust-toolchain;
}).buildPackage {
  src = ./.;
  cargoBuild = _: ''cargo $cargo_options tauri bundle $cargo_build_options >> $cargo_build_output_json -b deb'';
  cargoBuildOptions = _: [];
  nativeBuildInputs = [
    gtk3    
    librsvg
    libsoup_3
    pkg-config
    gdk-pixbuf
    cargo-tauri.hook
  ] ++ lib.optionals stdenv.isLinux [
    webkitgtk_4_1
    glib-networking
    openssl
    webkitgtk_4_1
    alsa-lib
    wrapGAppsHook3
  ];
}
