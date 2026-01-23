use std::path::PathBuf;

#[derive(Debug)]
pub enum ConfigError {
    FileNotFound(PathBuf),
    ReadError(std::io::Error),
    ParseError(String),
    ValidationErrors(Vec<String>),
    AlreadyInitialized,
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::FileNotFound(path) => {
                write!(f, "Config file not found at: {}", path.display())
            }
            Self::ReadError(e) => write!(f, "Failed to read config file: {e}"),
            Self::ParseError(e) => write!(f, "Failed to parse TOML: {e}"),
            Self::ValidationErrors(errors) => {
                writeln!(f, "Config validation failed:")?;
                for e in errors {
                    writeln!(f, "- {e}")?;
                }
                Ok(())
            }
            Self::AlreadyInitialized => write!(f, "Config already initialized"),
        }
    }
}
