pub mod pages;
mod sidebar_button;

use {
    bytelabs_config::Config,
    iced::{
        Element, Length, Task, Theme,
        widget::{column, container, row},
    },
    log,
    std::sync::{Arc, RwLock},
};

pub use pages::*;
pub use sidebar_button::category_button as sidebar_category_button;

#[derive(Debug, Clone)]
pub struct Settings {
    active_category: Category,
    selected_driver: Option<String>,
    driver_options: Vec<String>,
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
        let theme = config
            .read()
            .ok()
            .and_then(|cfg| cfg.interface.as_ref()?.theme.clone())
            .unwrap_or(Theme::Light);

        let selected_driver: Option<String> = Some(
            bytelabs_aios::get_available_drivers()
                .iter()
                .cloned()
                .nth(0)
                .map(|d| d.label())
                .unwrap_or("No driver")
                .into(),
        );

        let driver_options: Vec<String> = bytelabs_aios::get_available_drivers()
            .iter()
            .map(|d| d.to_string())
            .collect();

        Self {
            active_category: Category::General,
            selected_driver,
            driver_options,
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
                            log::error!("Failed to start test tone");
                        }
                    }
                } else {
                    match bytelabs_aios::stop_test_tone() {
                        Ok(()) => {
                            self.test_tone_playing = false;
                        }
                        Err(_) => {
                            log::error!("Failed to stop test tone");
                        }
                    }
                }
                Task::none()
            }

            SettingsMessage::SetTestToneFrequency(new_freq) => {
                self.test_tone_freq = new_freq;
                if self.test_tone_playing {
                    if let Err(_) = bytelabs_aios::set_test_tone_frequency(new_freq) {
                        log::error!("Failed to update test tone frequency");
                    }
                }
                Task::none()
            }

            SettingsMessage::SetTestToneGain(new_gain) => {
                self.test_tone_gain = new_gain;
                if self.test_tone_playing {
                    if let Err(_) = bytelabs_aios::set_test_tone_gain(new_gain) {
                        log::error!("Failed to update test tone gain");
                    }
                }
                Task::none()
            }

            SettingsMessage::CategorySelected(category) => {
                self.active_category = category;
                Task::none()
            }

            SettingsMessage::DriverSelected(driver) => {
                self.selected_driver = Some(driver);
                Task::none()
            }

            SettingsMessage::ThemeSelected(new_theme) => {
                log::info!("Updating theme to: {:?}", new_theme);

                self.theme = new_theme.clone();

                match config.write() {
                    Ok(mut cfg) => {
                        let interface = cfg.interface.get_or_insert_with(Default::default);
                        interface.theme = Some(new_theme.clone());
                        log::info!("Wrote theme to config in-memory: {:?}", interface.theme);
                    }
                    Err(e) => {
                        log::error!("Failed to acquire write lock on config: {:?}", e);
                    }
                }

                if let Err(e) = Config::save_global() {
                    log::error!("Failed to autosave config: {:?}", e);
                } else {
                    log::info!("Config autosave succeeded");
                    if let Ok(cfg_guard) = config.read() {
                        let stored_theme =
                            cfg_guard.interface.as_ref().and_then(|i| i.theme.clone());
                        log::info!("Stored theme after save: {:?}", stored_theme);
                    } else {
                        log::error!("Failed to acquire read lock to verify stored theme");
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
        .spacing(4)
        .width(160);

        let content = match self.active_category {
            Category::General => pages::general::view(self.theme.clone()),

            Category::Audio => pages::audio::view(
                self.selected_driver.clone(),
                self.driver_options.clone(),
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
