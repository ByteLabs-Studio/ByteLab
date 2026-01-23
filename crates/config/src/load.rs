use {
    crate::{path, Config, ConfigError},
    log::info,
    std::{fs, path::PathBuf},
};

pub fn load(config: Option<String>) -> Result<Config, ConfigError> {
    let path: PathBuf = config.map_or_else(path::config_path, PathBuf::from);

    info!("Loading config from: {}", path.display());

    if !path.exists() {
        return Err(ConfigError::FileNotFound(path));
    }

    let content = fs::read_to_string(&path).map_err(ConfigError::ReadError)?;
    let config: Config =
        toml::from_str(&content).map_err(|e| ConfigError::ParseError(e.to_string()))?;

    Ok(config)
}
