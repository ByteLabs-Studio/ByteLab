use {
    crate::{Config, ConfigError, path},
    log::info,
    std::{fs, path::PathBuf},
};

pub fn load(config: Option<String>) -> Result<Config, ConfigError> {
    let path: PathBuf = config.map_or_else(path::config_path, PathBuf::from);

    info!("Checking config at: {}", path.display());

    if path.exists() {
        Ok(
            toml::from_str(&fs::read_to_string(&path).map_err(ConfigError::ReadError)?)
                .map_err(|e| ConfigError::ParseError(e.to_string()))?,
        )
    } else {
        info!(
            "Config not found. Creating path and default config at: {}",
            path.display()
        );

        let config = Config::default();

        fs::write(
            &path,
            toml::to_string_pretty(&config)
                .map_err(|e| e.to_string())
                .map_err(ConfigError::ParseError)?,
        )
        .map_err(ConfigError::ReadError)?;

        Ok(config)
    }
}
