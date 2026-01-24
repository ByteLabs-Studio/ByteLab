use {
    iced::Theme,
    serde::{Deserialize, Serialize},
    std::ops::Deref,
};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Config {
    pub interface: Option<UserInterfaceOpts>,
    pub behavior: Option<UserBehaviorOpts>,
}
impl Config {
    pub(crate) fn default() -> Config {
        Config {
            interface: None,
            behavior: None,
        }
    }
}

fn serialize_theme<S>(theme: &Option<iced::Theme>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match theme {
        Some(t) => {
            let theme_str = match t {
                iced::Theme::Light => "light",
                iced::Theme::Dark => "dark",
                iced::Theme::Dracula => "dracula",
                iced::Theme::Nord => "nord",
                iced::Theme::SolarizedLight => "solarized-light",
                iced::Theme::SolarizedDark => "solarized-dark",
                iced::Theme::GruvboxLight => "gruvbox-light",
                iced::Theme::GruvboxDark => "gruvbox-dark",
                iced::Theme::CatppuccinLatte => "catpuccin-latte",
                iced::Theme::CatppuccinFrappe => "catpuccin-frappe",
                iced::Theme::CatppuccinMacchiato => "catpuccin-macchiato",
                iced::Theme::CatppuccinMocha => "catpuccin-mocha",
                iced::Theme::TokyoNight => "tokyo-night",
                iced::Theme::TokyoNightStorm => "tokyo-night-storm",
                iced::Theme::TokyoNightLight => "tokyo-night-light",
                iced::Theme::KanagawaWave => "kanagawa-wave",
                iced::Theme::KanagawaDragon => "kanagawa-dragon",
                iced::Theme::KanagawaLotus => "kanagawa-lotus",
                iced::Theme::Moonfly => "moonfly",
                iced::Theme::Nightfly => "nightfly",
                iced::Theme::Oxocarbon => "oxocarbon",
                iced::Theme::Ferra => "ferra",
                _ => "dark",
            };
            serializer.serialize_str(theme_str)
        }
        None => serializer.serialize_none(),
    }
}

fn deserialize_theme<'de, D>(deserializer: D) -> Result<Option<iced::Theme>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let d = Option::<String>::deserialize(deserializer)?;

    match d.as_deref().map(|s| s.trim()) {
        Some("light") => Ok(Some(iced::Theme::Light)),
        Some("dark") => Ok(Some(iced::Theme::Dark)),
        Some("dracula") => Ok(Some(iced::Theme::Dracula)),
        Some("nord") => Ok(Some(iced::Theme::Nord)),
        Some("solarized-light") => Ok(Some(iced::Theme::SolarizedLight)),
        Some("solarized-dark") => Ok(Some(iced::Theme::SolarizedDark)),
        Some("gruvbox-light") => Ok(Some(iced::Theme::GruvboxLight)),
        Some("gruvbox-dark") => Ok(Some(iced::Theme::GruvboxDark)),
        Some("catpuccin-latte") => Ok(Some(iced::Theme::CatppuccinLatte)),
        Some("catpuccin-frappe") => Ok(Some(iced::Theme::CatppuccinFrappe)),
        Some("catpuccin-macchiato") => Ok(Some(iced::Theme::CatppuccinMacchiato)),
        Some("catpuccin-mocha") => Ok(Some(iced::Theme::CatppuccinMocha)),
        Some("tokyo-night") => Ok(Some(iced::Theme::TokyoNight)),
        Some("tokyo-night-storm") => Ok(Some(iced::Theme::TokyoNightStorm)),
        Some("tokyo-night-light") => Ok(Some(iced::Theme::TokyoNightLight)),
        Some("kanagawa-wave") => Ok(Some(iced::Theme::KanagawaWave)),
        Some("kanagawa-dragon") => Ok(Some(iced::Theme::KanagawaDragon)),
        Some("kanagawa-lotus") => Ok(Some(iced::Theme::KanagawaLotus)),
        Some("moonfly") => Ok(Some(iced::Theme::Moonfly)),
        Some("nightfly") => Ok(Some(iced::Theme::Nightfly)),
        Some("oxocarbon") => Ok(Some(iced::Theme::Oxocarbon)),
        Some("ferra") => Ok(Some(iced::Theme::Ferra)),

        Some(x) => Err(serde::de::Error::custom(format!("Unknown theme: {}", x))),

        None => Ok(None),
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UserInterfaceOpts {
    #[serde(
        deserialize_with = "deserialize_theme",
        serialize_with = "serialize_theme"
    )]
    pub theme: Option<Theme>,
    pub scale: Option<UserInterfaceOptsScale>,
}

impl Default for UserInterfaceOpts {
    fn default() -> Self {
        Self {
            theme: Some(Theme::Light),
            scale: Some(UserInterfaceOptsScale(1.0)),
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UserInterfaceOptsScale(f32);

impl Deref for UserInterfaceOptsScale {
    type Target = f32;
    fn deref(&self) -> &f32 {
        &self.0
    }
}

impl Default for UserInterfaceOptsScale {
    fn default() -> Self {
        Self(1.0)
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UserBehaviorOpts {
    // When pausing the time state is 00:00:00.
    pub pause_throw_to_start: Option<BoolTrue>,
    // On new track init, the track will be solo-ed.
    pub init_track_auto_solo: Option<ArmBehaviors>,
    // On new track init, the track will be Record Armed.
    pub init_track_auto_arm: Option<ArmBehaviors>,
    // Self-explanatory.
    pub init_track_volume: Option<f32>,
    // Self-explanatory.
    pub init_track_pan: Option<f32>,
    // Initial metronome speed.
    pub init_project_bpm: Option<UserBpm>,
    // Initial metronome time-signature.
    pub init_project_time_signature: Option<String>,
    // Metronome count in time before track actually plays, 0 means instant.
    pub init_project_bar_countin: Option<u8>,
    // Arrangement view resolution: eg. "1/4", "1/8", "1/16"
    pub init_arrangement_resolution: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BoolTrue(bool);

impl Deref for BoolTrue {
    type Target = bool;
    fn deref(&self) -> &bool {
        &self.0
    }
}

impl Default for BoolTrue {
    fn default() -> Self {
        Self(true)
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UserBpm(f32);

impl Deref for UserBpm {
    type Target = f32;
    fn deref(&self) -> &f32 {
        &self.0
    }
}

impl Default for UserBpm {
    fn default() -> Self {
        Self(120.0)
    }
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub enum ArmBehaviors {
    #[default]
    Off,
    SoloNew,
    SoloExclusive,
}
