use {
    crate::{Config, ConfigError, path},
    log::info,
    std::{fs, path::PathBuf},
};

pub fn load(config: Option<String>) -> Result<Config, ConfigError> {
    let path: PathBuf = config.map_or_else(path::config_path, PathBuf::from);

    info!("Checking config at: {}", path.display());

    if !path.exists() {
        info!(
            "Config not found. Creating path and default config at: {}",
            path.display()
        );

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(ConfigError::ReadError)?;
        }

        let default_config = Config::default();

        let toml_string = toml::to_string_pretty(&default_config)
            .map_err(|e| ConfigError::ParseError(e.to_string()))?;

        fs::write(&path, toml_string).map_err(ConfigError::ReadError)?;

        return Ok(default_config);
    }

    let content = fs::read_to_string(&path).map_err(ConfigError::ReadError)?;
    let config: Config =
        toml::from_str(&content).map_err(|e| ConfigError::ParseError(e.to_string()))?;

    Ok(config)
}
