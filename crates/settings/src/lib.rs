use iced::{
    Element, Length, Task,
    widget::{button, column, container, horizontal_space, pick_list, row, text},
};

#[derive(Debug, Clone)]
pub struct Settings {
    active_category: Category,
    selected_driver: Option<String>,
    driver_options: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum Category {
    #[default]
    General,
    Behavior,
    Audio,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            active_category: Category::General,
            selected_driver: Some("Pipewire".to_string()),
            #[cfg(target_os = "linux")]
            driver_options: vec!["Pipewire".into(), "JACK".into(), "ALSA".into()],
            #[cfg(target_os = "macos")]
            driver_options: vec!["Core Audio".into(), "JACK".into()],
            #[cfg(target_os = "windows")]
            driver_options: vec!["WASAPI".into(), "JACK".into()],
            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            driver_options: vec!["WASAPI".into(), "JACK".into()],
        }
    }
}

#[derive(Debug, Clone)]
pub enum SettingsMessage {
    CategorySelected(Category),
    ExitSettings,
    DriverSelected(String),
}

impl Settings {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn update(&mut self, message: SettingsMessage) -> Task<SettingsMessage> {
        match message {
            SettingsMessage::CategorySelected(category) => {
                self.active_category = category;
                Task::none()
            }
            SettingsMessage::ExitSettings => Task::none(),

            SettingsMessage::DriverSelected(driver) => {
                self.selected_driver = Some(driver);
                Task::none()
            }
        }
    }

    pub fn view(&self) -> Element<'_, SettingsMessage> {
        let sidebar = column![
            button("General")
                .on_press(SettingsMessage::CategorySelected(Category::General))
                .back
                .width(Length::Fill),
            button("Behavior")
                .on_press(SettingsMessage::CategorySelected(Category::Behavior))
                .width(Length::Fill),
            button("Audio")
                .on_press(SettingsMessage::CategorySelected(Category::Audio))
                .width(Length::Fill),
        ]
        .spacing(10)
        .width(150);

        let content = match self.active_category {
            Category::General => column![
                text("General Settings").size(24),
                button("Back to Dashboard").on_press(SettingsMessage::ExitSettings)
            ]
            .spacing(20),

            Category::Audio => column![
                text("Audio System").size(24),
                row![
                    text("Driver Model"),
                    horizontal_space(),
                    pick_list(
                        self.driver_options.clone(),
                        self.selected_driver.clone(),
                        SettingsMessage::DriverSelected
                    )
                    .width(150)
                ]
                .width(Length::Fill)
                .align_y(iced::Alignment::Center),
            ]
            .spacing(20),

            _ => column![text("Work in progress")],
        };

        container(row![sidebar, content.width(Length::Fill)].spacing(20))
            .padding(20)
            .width(Length::Fill)
            .height(Length::Fill)
            .center_x(Length::Fill)
            .into()
    }
}
