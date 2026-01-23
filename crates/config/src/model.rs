use {serde::Deserialize, std::ops::Deref};

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub interface: Option<UserInterfaceOpts>,
    pub behavior: Option<UserBehaviorOpts>,
}

pub struct UserInterfaceOpts {
    pub scale: Option<UserInterfaceOptsScale>,
}

pub struct UserIntefaceOptsScale(f32);

impl Deref for UserIntefaceOptsScale {
    type Target = str;
    fn deref(&self) -> &str {
        &self.0
    }
}

impl Default for UserIntefaceOptsScale {
    fn default() -> Self {
        Self(1.0)
    }
}

pub struct UserBehaviorOpts {
    // When pausing the time state is 00:00:00.
    pub pause_throw_to_start: Option<BoolTrue>,
    // On new track init, the track will be solo-ed.
    pub init_track_auto_solo: Option<ArmBehaviors>,
    // On new track init, the track will be Record Armed.
    pub init_track_auto_arm: Option<ArmBehaviors>,
    // Self-explanatory
    pub init_track_volume: Option<f32>,
    // Self-explanatory
    pub init_track_pan: Option<f32>,
}

pub struct BoolTrue(bool);

impl Deref for BoolTrue {
    type Target = str;
    fn deref(&self) -> &str {
        &self.0
    }
}

impl Default for BoolTrue {
    fn default() -> Self {
        Self(true)
    }
}

#[derive(Default)]
pub enum ArmBehaviors {
    #[default]
    Off,
    SoloNew,
    SoloExclusive,
}
