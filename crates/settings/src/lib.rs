use iced::{
    Alignment::Center,
    Element, Length, Task, Theme,
    widget::{Space, button, column, container, pick_list, row, text},
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

    fn category_button<'a>(
        &self,
        label: &'a str,
        category: Category,
    ) -> Element<'a, SettingsMessage> {
        let is_active = self.active_category == category;

        button(
            row![
                container(Space::new().width(0))
                    .width(4)
                    .height(27)
                    .style(move |theme: &Theme| {
                        container::Style::default().background(if is_active {
                            theme.extended_palette().primary.base.color
                        } else {
                            iced::Color::TRANSPARENT
                        })
                    }),
                text(label).size(14),
            ]
            .spacing(12)
            .align_y(Center),
        )
        .width(Length::Fill)
        .padding(iced::Padding {
            left: 0.0,
            right: 12.0,
            top: 6.0,
            bottom: 6.0,
        })
        .on_press(SettingsMessage::CategorySelected(category))
        .style(move |theme: &Theme, status| {
            let palette = theme.extended_palette();
            let mut style = button::primary(theme, status);

            style.background = match status {
                button::Status::Hovered => Some(palette.background.weak.color.into()),
                button::Status::Pressed => Some(palette.background.weaker.color.into()),
                _ => {
                    if is_active {
                        Some(palette.background.weakest.color.into())
                    } else {
                        None
                    }
                }
            };

            style.text_color = if is_active {
                palette.background.weakest.text
            } else {
                palette.background.base.text
            };

            style
        })
        .into()
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
            self.category_button("General", Category::General),
            self.category_button("Behavior", Category::Behavior),
            self.category_button("Audio", Category::Audio),
        ]
        .spacing(4)
        .width(160);

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
                    Space::new().width(Length::Fill),
                    pick_list(
                        self.driver_options.clone(),
                        self.selected_driver.clone(),
                        SettingsMessage::DriverSelected
                    )
                    .width(200)
                ]
                .width(Length::Fill)
                .align_y(iced::Alignment::Center),
            ]
            .spacing(20),

            _ => column![text("Work in progress")],
        };

        container(row![sidebar, content.width(Length::Fill)].spacing(40))
            .padding(20)
            .width(Length::Fill)
            .height(Length::Fill)
            .into()
    }
}
