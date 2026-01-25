use std::{fs, path::PathBuf};

pub fn config_path() -> PathBuf {
    let path = cfg!(unix)
        .then(|| std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from))
        .unwrap_or_else(|| std::env::var("LOCALAPPDATA").ok().map(PathBuf::from))
        .unwrap_or_else(|| std::env::home_dir().unwrap_or_default().join(".config"))
        .join("bytelabs")
        .join("config.toml");

    _ = path.parent().map(fs::create_dir_all);

    path
}
