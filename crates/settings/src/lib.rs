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

pub use sidebar_button::category_button as sidebar_category_button;
pub use pages::*;

#[derive(Debug, Clone)]
pub struct Settings {
    active_category: Category,
    selected_driver: Option<String>,
    driver_options: Vec<String>,
    theme: Theme,
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
    CategorySelected(Category),
    DriverSelected(String),
    ThemeSelected(Theme),
}

impl Settings {
    pub fn new(config: Arc<RwLock<Config>>) -> Self {
        let theme = config
            .read()
            .ok()
            .and_then(|cfg| cfg.interface.as_ref()?.theme.clone())
            .unwrap_or(Theme::Light);

        Self {
            active_category: Category::General,
            #[cfg(target_os = "linux")]
            selected_driver: Some("Pipewire".to_string()),
            #[cfg(target_os = "macos")]
            selected_driver: Some("Core Audio".to_string()),
            #[cfg(target_os = "windows")]
            selected_driver: Some("WASAPI".to_string()),
            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            selected_driver: Some("ALSA".to_string()),
            #[cfg(target_os = "linux")]
            driver_options: vec!["Pipewire".into(), "JACK".into(), "ALSA".into()],
            #[cfg(target_os = "macos")]
            driver_options: vec!["Core Audio".into(), "JACK".into()],
            #[cfg(target_os = "windows")]
            driver_options: vec!["WASAPI".into(), "JACK".into()],
            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            driver_options: vec!["ALSA".into()],
            theme,
        }
    }

    pub fn update(
        &mut self,
        message: SettingsMessage,
        config: Arc<RwLock<Config>>,
    ) -> Task<SettingsMessage> {
        match message {
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
                        let stored_theme = cfg_guard
                            .interface
                            .as_ref()
                            .and_then(|i| i.theme.clone());
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
            sidebar_category_button("General", self.active_category == Category::General, Category::General),
            sidebar_category_button("Behavior", self.active_category == Category::Behavior, Category::Behavior),
            sidebar_category_button("Audio", self.active_category == Category::Audio, Category::Audio),
        ]
        .spacing(4)
        .width(160);

        let content = match self.active_category {
            Category::General => {
                log::info!("Current theme in view: {:?}", self.theme);
                pages::general::view(self.theme.clone())
            }

            Category::Audio => pages::audio::view(self.selected_driver.clone(), self.driver_options.clone()),

            _ => pages::work_in_progress::view(),
        };

        container(row![sidebar, content].spacing(40))
            .padding(20)
            .width(Length::Fill)
            .height(Length::Fill)
            .into()
    }
}
