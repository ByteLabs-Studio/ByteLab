use {
    iced::Theme,
    serde::{Deserialize, Serialize},
    std::ops::Deref,
};


#[derive(Debug, Deserialize, Serialize, Clone, Default)]
pub struct AudioOpts {
    pub driver: Option<String>,
    pub device: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Config {
    pub interface: Option<UserInterfaceOpts>,
    pub behavior: Option<UserBehaviorOpts>,
    pub audio: Option<AudioOpts>,
}
impl Config {
    pub(crate) fn default() -> Config {
        Config {
            interface: None,
            behavior: None,
            audio: None,
        }
    }
}

fn serialize_theme<S>(theme: &Option<iced::Theme>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    use iced::Theme::*;
    match theme {
        Some(t) => {
            let theme_str = match t {
                Light => "light",
                Dark => "dark",
                Dracula => "dracula",
                Nord => "nord",
                SolarizedLight => "solarized-light",
                SolarizedDark => "solarized-dark",
                GruvboxLight => "gruvbox-light",
                GruvboxDark => "gruvbox-dark",
                CatppuccinLatte => "catpuccin-latte",
                CatppuccinFrappe => "catpuccin-frappe",
                CatppuccinMacchiato => "catpuccin-macchiato",
                CatppuccinMocha => "catpuccin-mocha",
                TokyoNight => "tokyo-night",
                TokyoNightStorm => "tokyo-night-storm",
                TokyoNightLight => "tokyo-night-light",
                KanagawaWave => "kanagawa-wave",
                KanagawaDragon => "kanagawa-dragon",
                KanagawaLotus => "kanagawa-lotus",
                Moonfly => "moonfly",
                Nightfly => "nightfly",
                Oxocarbon => "oxocarbon",
                Ferra => "ferra",
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
    use iced::Theme::*;
    let d = Option::<String>::deserialize(deserializer)?;

    match d.as_deref().map(|s| s.trim()) {
        Some("light") => Ok(Some(Light)),
        Some("dark") => Ok(Some(Dark)),
        Some("dracula") => Ok(Some(Dracula)),
        Some("nord") => Ok(Some(Nord)),
        Some("solarized-light") => Ok(Some(SolarizedLight)),
        Some("solarized-dark") => Ok(Some(SolarizedDark)),
        Some("gruvbox-light") => Ok(Some(GruvboxLight)),
        Some("gruvbox-dark") => Ok(Some(GruvboxDark)),
        Some("catpuccin-latte") => Ok(Some(CatppuccinLatte)),
        Some("catpuccin-frappe") => Ok(Some(CatppuccinFrappe)),
        Some("catpuccin-macchiato") => Ok(Some(CatppuccinMacchiato)),
        Some("catpuccin-mocha") => Ok(Some(CatppuccinMocha)),
        Some("tokyo-night") => Ok(Some(TokyoNight)),
        Some("tokyo-night-storm") => Ok(Some(TokyoNightStorm)),
        Some("tokyo-night-light") => Ok(Some(TokyoNightLight)),
        Some("kanagawa-wave") => Ok(Some(KanagawaWave)),
        Some("kanagawa-dragon") => Ok(Some(KanagawaDragon)),
        Some("kanagawa-lotus") => Ok(Some(KanagawaLotus)),
        Some("moonfly") => Ok(Some(Moonfly)),
        Some("nightfly") => Ok(Some(Nightfly)),
        Some("oxocarbon") => Ok(Some(Oxocarbon)),
        Some("ferra") => Ok(Some(Ferra)),

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
