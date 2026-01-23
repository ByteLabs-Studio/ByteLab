use {serde::Deserialize, std::ops::Deref};

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub interface: Option<UserInterfaceOpts>,
    pub behavior: Option<UserBehaviorOpts>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct UserInterfaceOpts {
    pub scale: Option<UserInterfaceOptsScale>,
}

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Default, Deserialize, Debug, Clone)]
pub enum ArmBehaviors {
    #[default]
    Off,
    SoloNew,
    SoloExclusive,
}
