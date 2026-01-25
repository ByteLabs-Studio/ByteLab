pub mod api;
pub mod error;
pub mod model;
pub mod path;
pub use crate::model::Config;

use {
    crate::error::ConfigError,
    std::sync::{Arc, OnceLock, RwLock},
};

static CONFIG_INSTANCE: OnceLock<Arc<RwLock<Config>>> = OnceLock::new();

impl Config {
    pub fn init_global(config_path: Option<String>) -> Result<(), ConfigError> {
        let cfg = api::load(config_path)?;
        CONFIG_INSTANCE
            .set(Arc::new(RwLock::new(cfg)))
            .map_err(|_| ConfigError::ParseError("Config already initialized".into()))
    }

    pub fn global() -> Arc<RwLock<Config>> {
        CONFIG_INSTANCE
            .get()
            .expect("Config not initialized")
            .clone()
    }

    pub fn save_global() -> Result<(), ConfigError> {
        let path = path::config_path();
        log::info!("Saving config to: {}", path.display());

        let toml_string = {
            let cfg = Self::global();
            let guard = cfg
                .read()
                .map_err(|_| ConfigError::ParseError("Lock poisoned".into()))?;
            toml::to_string_pretty(&*guard).map_err(|e| ConfigError::ParseError(e.to_string()))?
        };

        match std::fs::write(&path, toml_string) {
            Ok(_) => {
                log::info!("Config saved successfully to: {}", path.display());
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to save config to {}: {:?}", path.display(), e);
                Err(ConfigError::ReadError(e))
            }
        }
    }
}
