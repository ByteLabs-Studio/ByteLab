use std::{path::PathBuf, str::FromStr};

pub fn config_path() -> PathBuf {
    let path = if cfg!(unix) {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| std::env::home_dir().unwrap_or_default().join(".config"))
            .join("bytelabs/config.toml")
    } else {
        PathBuf::from_str(&std::env::var("LOCALAPPDATA").unwrap())
            .unwrap()
            .join("bytelabs/config.toml")
    };

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).ok();
        }
    }

    path
}
