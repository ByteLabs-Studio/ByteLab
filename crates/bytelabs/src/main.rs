use {
    bytelab_settings::{Settings, SettingsMessage},
    iced::{
        Center, Element, Length, Task, Theme, keyboard,
        widget::{button, column, text},
    },
    log::info,
};

fn main() -> iced::Result {
    env_logger::init();
    iced::application(ByteLab::default, ByteLab::update, ByteLab::view)
        .subscription(ByteLab::subscription)
        .theme(ByteLab::theme)
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
    EventOccurred(keyboard::Event),
}

impl ByteLab {
    fn theme(&self) -> Theme {
        Theme::Dark
    }

    fn subscription(&self) -> iced::Subscription<MainMessage> {
        keyboard::listen().map(MainMessage::EventOccurred)
    }

    fn update(&mut self, message: MainMessage) -> Task<MainMessage> {
        match message {
            MainMessage::EventOccurred(event) => {
                match event {
                    keyboard::Event::KeyPressed { key, modifiers, .. } => {
                        info!("{key:#?} {modifiers:#?}");
                        if key == keyboard::Key::Character(",".into())
                            && modifiers == keyboard::Modifiers::COMMAND
                        {
                            return Task::done(MainMessage::TogglePage(Page::Settings));
                        }

                        if key == keyboard::Key::Named(keyboard::key::Named::Escape)
                            && self.page == Page::Settings
                        {
                            return Task::done(MainMessage::NavigateBack);
                        }
                    }
                    _ => {}
                }
                Task::none()
            }

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
