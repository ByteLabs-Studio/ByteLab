use iced::{
    Element, Length, Task,
    widget::{button, column, container, row, text},
};

#[derive(Debug, Clone)]
pub struct Settings {
    active_category: Category,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum Category {
    #[default]
    General,
    Behavior,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            active_category: Category::General,
        }
    }
}

#[derive(Debug, Clone)]
pub enum SettingsMessage {
    CategorySelected(Category),
    ExitSettings,
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
        }
    }

    pub fn view(&self) -> Element<'_, SettingsMessage> {
        let sidebar = column![
            button("General")
                .on_press(SettingsMessage::CategorySelected(Category::General))
                .width(Length::Fill),
            button("Behavior")
                .on_press(SettingsMessage::CategorySelected(Category::Behavior))
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
