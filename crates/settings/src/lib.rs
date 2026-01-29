pub mod pages;
mod sidebar_button;

use {
    bytelabs_aios::cpal::traits::{DeviceTrait, HostTrait},
    bytelabs_config::Config,
    iced::{
        Element, Length, Task, Theme,
        widget::{column, container, row},
    },
    log::{error, info},
    std::sync::{Arc, RwLock},
};

pub use pages::*;
pub use sidebar_button::category_button as sidebar_category_button;

#[derive(Debug, Clone)]
pub struct Settings {
    active_category: Category,
    selected_driver: Option<String>,
    driver_options: Vec<String>,
    selected_device: Option<String>,
    device_options: Vec<String>,
    theme: Theme,
    test_tone_playing: bool,
    test_tone_freq: f32,
    test_tone_gain: f32,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum Category {
    #[default]
    General,
    Behavior,
    Audio,
}

#[derive(Debug, Clone)]
pub enum SettingsMessage {
    PlayTestTone,
    SetTestToneFrequency(f32),
    SetTestToneGain(f32),
    CategorySelected(Category),
    DriverSelected(String),
    DeviceSelected(String),
    ThemeSelected(Theme),
}

impl Default for Settings {
    fn default() -> Self {
        Self::new()
    }
}

impl Settings {
    pub fn new() -> Self {
        let config = bytelabs_config::Config::global();
        let config_guard = config.read().unwrap();

        let theme = config_guard
            .interface
            .as_ref()
            .and_then(|i| i.theme.clone())
            .unwrap_or(Theme::Light);

        let audio_config = config_guard.audio.as_ref();

        let driver_options: Vec<String> = bytelabs_aios::cpal::available_hosts()
            .iter()
            .map(|id| id.to_string())
            .collect();

        let selected_driver = audio_config
            .and_then(|a| a.driver.clone())
            .or_else(|| driver_options.first().cloned());

        let (device_options, selected_device) = if let Some(driver_name) = &selected_driver {
            let host_id = bytelabs_aios::cpal::available_hosts()
                .into_iter()
                .find(|id| id.to_string() == *driver_name)
                .unwrap();

            let host = bytelabs_aios::cpal::host_from_id(host_id).unwrap();

            let device_options: Vec<String> = host
                .output_devices()
                .unwrap()
                .filter_map(|d| Some(d.description().unwrap().name().into()))
                .collect();

            let selected_device = audio_config.and_then(|a| a.device.clone()).or_else(|| {
                host.default_output_device()
                    .and_then(|d| Some(d.description().unwrap().name().into()))
            });
            (device_options, selected_device)
        } else {
            (Vec::new(), None)
        };

        Self {
            active_category: Category::General,
            selected_driver,
            driver_options,
            selected_device,
            device_options,
            theme,
            test_tone_playing: false,
            test_tone_freq: 440.0,
            test_tone_gain: 0.5,
        }
    }

    pub fn update(
        &mut self,
        message: SettingsMessage,
        config: Arc<RwLock<Config>>,
    ) -> Task<SettingsMessage> {
        match message {
            SettingsMessage::PlayTestTone => {
                if !self.test_tone_playing {
                    match bytelabs_aios::start_test_tone(self.test_tone_freq) {
                        Ok(()) => {
                            self.test_tone_playing = true;
                        }
                        Err(_) => {
                            error!("Failed to start test tone");
                        }
                    }
                } else {
                    match bytelabs_aios::stop_test_tone() {
                        Ok(()) => {
                            self.test_tone_playing = false;
                        }
                        Err(_) => {
                            error!("Failed to stop test tone");
                        }
                    }
                }
                Task::none()
            }

            SettingsMessage::SetTestToneFrequency(new_freq) => {
                self.test_tone_freq = new_freq;
                if self.test_tone_playing {
                    if let Err(_) = bytelabs_aios::set_test_tone_frequency(new_freq) {
                        error!("Failed to update test tone frequency");
                    }
                }
                Task::none()
            }

            SettingsMessage::SetTestToneGain(new_gain) => {
                self.test_tone_gain = new_gain;
                if self.test_tone_playing {
                    if let Err(_) = bytelabs_aios::set_test_tone_gain(new_gain) {
                        error!("Failed to update test tone gain");
                    }
                }
                Task::none()
            }

            SettingsMessage::CategorySelected(category) => {
                self.active_category = category;
                Task::none()
            }

            SettingsMessage::DriverSelected(driver_name) => {
                self.selected_driver = Some(driver_name.clone());

                let host_id = bytelabs_aios::cpal::available_hosts()
                    .into_iter()
                    .find(|id| id.to_string() == driver_name)
                    .unwrap();
                let host = bytelabs_aios::cpal::host_from_id(host_id).unwrap();

                self.device_options = host
                    .output_devices()
                    .unwrap()
                    .filter_map(|d| Some(d.description().unwrap().name().into()))
                    .collect();
                self.selected_device = host
                    .default_output_device()
                    .and_then(|d| Some(d.description().unwrap().name().into()));

                if let Ok(mut config) = config.write() {
                    let audio = config.audio.get_or_insert_with(Default::default);
                    audio.driver = Some(driver_name);
                    audio.device = self.selected_device.clone();
                }

                if let Err(e) = Config::save_global() {
                    error!("Failed to autosave config: {:?}", e);
                }

                Task::none()
            }

            SettingsMessage::DeviceSelected(device_name) => {
                self.selected_device = Some(device_name.clone());
                if let Ok(mut config) = config.write() {
                    config.audio.get_or_insert_with(Default::default).device = Some(device_name);
                }
                if let Err(e) = Config::save_global() {
                    error!("Failed to autosave config: {:?}", e);
                }
                Task::none()
            }

            SettingsMessage::ThemeSelected(new_theme) => {
                info!("Updating theme to: {:?}", new_theme);

                self.theme = new_theme.clone();

                match config.write() {
                    Ok(mut cfg) => {
                        let interface = cfg.interface.get_or_insert_with(Default::default);
                        interface.theme = Some(new_theme.clone());
                        info!("Wrote theme to config in-memory: {:?}", interface.theme);
                    }
                    Err(e) => {
                        error!("Failed to acquire write lock on config: {:?}", e);
                    }
                }

                if let Err(e) = Config::save_global() {
                    error!("Failed to autosave config: {:?}", e);
                } else {
                    info!("Config autosave succeeded");
                    if let Ok(cfg_guard) = config.read() {
                        let stored_theme =
                            cfg_guard.interface.as_ref().and_then(|i| i.theme.clone());
                        info!("Stored theme after save: {:?}", stored_theme);
                    } else {
                        error!("Failed to acquire read lock to verify stored theme");
                    }
                }

                Task::none()
            }
        }
    }

    pub fn view(&self) -> Element<'_, SettingsMessage> {
        let sidebar = column![
            sidebar_category_button(
                "General",
                self.active_category == Category::General,
                Category::General
            ),
            sidebar_category_button(
                "Behavior",
                self.active_category == Category::Behavior,
                Category::Behavior
            ),
            sidebar_category_button(
                "Audio",
                self.active_category == Category::Audio,
                Category::Audio
            ),
        ]
        .spacing(5)
        .width(200);

        let content = match self.active_category {
            Category::General => pages::general::view(self.theme.clone()),

            Category::Audio => pages::audio::view(
                self.selected_driver.clone(),
                self.driver_options.clone(),
                self.selected_device.clone(),
                self.device_options.clone(),
                self.test_tone_playing,
                self.test_tone_freq,
                self.test_tone_gain,
            ),
            _ => pages::work_in_progress::view(),
        };

        container(row![sidebar, content].spacing(40))
            .padding(20)
            .width(Length::Fill)
            .height(Length::Fill)
            .into()
    }
}
