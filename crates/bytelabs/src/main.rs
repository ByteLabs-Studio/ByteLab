use {
    bytelab_logger::info,
    bytelab_settings::{Settings, SettingsMessage},
    iced::{
        Center, Element, Length, Task, Theme, keyboard,
        widget::{button, column, text},
    },
};

fn main() -> iced::Result {
    iced::application("ByteLab", ByteLab::update, ByteLab::view)
        .theme(ByteLab::theme)
        .subscription(ByteLab::subscription)
        .run()
}

struct ByteLab {
    page: Page,
    settings_state: Settings,
}

impl Default for ByteLab {
    fn default() -> Self {
        Self {
            page: Page::Dashboard,
            settings_state: Settings::new(),
        }
    }
}

#[derive(Clone, PartialEq, Debug)]
enum Page {
    Dashboard,
    Project(String),
    Settings,
}

#[derive(Debug, Clone)]
enum MainMessage {
    ExitProgram,
    NavigateBack,
    OpenPage(Page),
    TogglePage(Page),
    Settings(SettingsMessage),
}

impl ByteLab {
    fn theme(&self) -> Theme {
        Theme::Dark
    }

    fn subscription(&self) -> iced::Subscription<MainMessage> {
        keyboard::on_key_press(|key, modifier| match key {
            keyboard::Key::Named(keyboard::key::Named::Escape) => Some(MainMessage::NavigateBack),

            keyboard::Key::Character(c) if c.as_ref() == "," && modifier.command() => {
                Some(MainMessage::TogglePage(Page::Settings))
            }

            _ => None,
        })
    }

    fn update(&mut self, message: MainMessage) -> Task<MainMessage> {
        match message {
            MainMessage::ExitProgram => iced::exit(),

            MainMessage::OpenPage(p) => {
                if self.page == p {
                    return Task::none();
                }

                info!("Opening {p:#?}");
                self.page = p;
                Task::none()
            }

            MainMessage::TogglePage(p) => {
                if self.page == p {
                    self.page = Page::Dashboard;
                    return Task::none();
                }

                info!("Opening {p:#?}");
                self.page = p;
                Task::none()
            }

            MainMessage::Settings(settings_msg) => {
                if let SettingsMessage::ExitSettings = settings_msg {
                    self.page = Page::Dashboard;
                    return Task::none();
                }

                self.settings_state
                    .update(settings_msg)
                    .map(MainMessage::Settings)
            }

            MainMessage::NavigateBack => {
                if let Page::Settings = self.page {
                    self.page = Page::Dashboard;
                }
                Task::none()
            }
        }
    }

    fn view(&self) -> Element<'_, MainMessage> {
        match &self.page {
            Page::Dashboard => column![
                text("ByteLab").size(30),
                button(text("Open Settings")).on_press(MainMessage::OpenPage(Page::Settings)),
                button(text("Open Project")).on_press(MainMessage::OpenPage(Page::Project(
                    "sandwich.blproj".into()
                ))),
                button(text("Exit")).on_press(MainMessage::ExitProgram),
            ]
            .width(Length::Fill)
            .padding(20)
            .align_x(Center)
            .into(),

            Page::Settings => self.settings_state.view().map(MainMessage::Settings),

            Page::Project(x) => column![
                text(format!("Project: {x}")),
                button("Back").on_press(MainMessage::OpenPage(Page::Dashboard))
            ]
            .into(),
        }
    }
}
