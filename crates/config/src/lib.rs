pub mod error;
pub mod load;
pub mod model;
pub mod path;
pub use crate::model::Config;

use {
    crate::error::ConfigError,
    std::sync::{Arc, OnceLock},
};

static CONFIG_INSTANCE: OnceLock<Arc<Config>> = OnceLock::new();

impl Config {
    pub fn init_global(config_path: Option<String>) -> Result<(), ConfigError> {
        let cfg = load::load(config_path)?;
        CONFIG_INSTANCE
            .set(Arc::new(cfg))
            .map_err(|_| ConfigError::ParseError("Config already initialized".into()))
    }

    pub fn global() -> Arc<Config> {
        CONFIG_INSTANCE
            .get()
            .expect("Config not initialized — call Config::init_global() first")
            .clone()
    }
}
