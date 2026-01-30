use {
    bytelabs_config::{Config, error::ConfigError},
    bytelabs_settings::{Settings, SettingsMessage},
    iced::{
        Center, Element, Length, Task, Theme, keyboard,
        widget::{button, column, text},
        window,
    },
    log::info,
};

#[derive(Default)]
struct ByteLabs {
    page: Page,
    settings_state: Settings,
    main_window: Option<window::Id>,
    settings_window: Option<window::Id>,
}

#[derive(Debug)]
pub enum Error {
    ConfigurationError(ConfigError),
    GraphicsError(iced::Error),
}

#[derive(Clone, PartialEq, Debug, Default)]
enum Page {
    #[default]
    Dashboard,
    Project(String),
}

#[derive(Debug, Clone)]
enum MainMessage {
    OpenPage(Page),
    Settings(SettingsMessage),
    EventOccurred(keyboard::Event),
    OpenSettings,
    MainWindowOpened(window::Id),
    SettingsWindowOpened(window::Id),
    WindowClosed(window::Id),
}

impl ByteLabs {
    fn new() -> (Self, Task<MainMessage>) {
        let (_, task) = window::open(window::Settings {
            ..Default::default()
        });

        (Self::default(), task.map(MainMessage::MainWindowOpened))
    }

    fn theme(&self, _window: window::Id) -> Theme {
        Config::global()
            .read()
            .ok()
            .and_then(|cfg| cfg.interface.as_ref()?.theme.clone())
            .unwrap_or(Theme::Light)
    }

    fn subscription(&self) -> iced::Subscription<MainMessage> {
        iced::Subscription::batch(vec![
            keyboard::listen().map(MainMessage::EventOccurred),
            window::close_events().map(MainMessage::WindowClosed),
        ])
    }

    fn update(&mut self, message: MainMessage) -> Task<MainMessage> {
        match message {
            MainMessage::MainWindowOpened(id) => {
                self.main_window = Some(id);
                Task::none()
            }
            MainMessage::EventOccurred(keyboard::Event::KeyPressed {
                key: keyboard::Key::Character(c),
                modifiers: keyboard::Modifiers::COMMAND,
                ..
            }) if c == "," => Task::done(MainMessage::OpenSettings),
            MainMessage::EventOccurred(keyboard::Event::KeyPressed {
                key: keyboard::Key::Named(keyboard::key::Named::Escape),
                ..
            }) => {
                if let Some(id) = self.settings_window {
                    return window::close(id);
                }
                Task::none()
            }
            MainMessage::EventOccurred(_) => Task::none(),
            MainMessage::OpenSettings if self.settings_window.is_none() => {
                let (id, tid) = window::open(window::Settings {
                    size: iced::Size::new(1000.0, 600.0),
                    resizable: false,
                    ..Default::default()
                });

                if cfg!(target_os = "macos") {
                    self.settings_window = Some(id);
                }
                tid.map(MainMessage::SettingsWindowOpened)
            }
            MainMessage::OpenSettings => Task::none(),
            MainMessage::SettingsWindowOpened(id) => {
                self.settings_window = Some(id);
                Task::none()
            }
            MainMessage::WindowClosed(id) if Some(id) == self.settings_window => {
                _ = bytelabs_aios::stop_test_tone();
                self.settings_window.take();
                Task::none()
            }
            MainMessage::WindowClosed(id) if Some(id) == self.main_window => return iced::exit(),
            MainMessage::OpenPage(p) if self.page != p => {
                info!("Opening {p:#?}");
                self.page = p;
                Task::none()
            }
            MainMessage::OpenPage(_) => Task::none(),
            MainMessage::Settings(settings_msg) => {
                log::info!("Received settings message: {:?}", settings_msg);
                self.settings_state
                    .update(settings_msg, Config::global())
                    .map(MainMessage::Settings)
            }
            MainMessage::WindowClosed(_) => Task::none(),
        }
    }

    fn view(&self, window_id: window::Id) -> Element<'_, MainMessage> {
        if Some(window_id) == self.settings_window {
            return self.settings_state.view().map(MainMessage::Settings);
        }

        let content = match &self.page {
            Page::Dashboard => column![
                text("ByteLabs").size(30),
                button(text("Open Settings")).on_press(MainMessage::OpenSettings),
                button(text("Open Project")).on_press(MainMessage::OpenPage(Page::Project(
                    "sandwich.blproj".into()
                ))),
            ],

            Page::Project(x) => column![
                text(format!("Project: {x}")),
                button("Back").on_press(MainMessage::OpenPage(Page::Dashboard))
            ],
        };

        content
            .width(Length::Fill)
            .padding(20)
            .align_x(Center)
            .into()
    }
}

fn main() -> Result<(), Error> {
    env_logger::init();

    Config::init_global(None).map_err(Error::ConfigurationError)?;
    iced::daemon(ByteLabs::new, ByteLabs::update, ByteLabs::view)
        .subscription(ByteLabs::subscription)
        .title("ByteLabs")
        .theme(ByteLabs::theme)
        .run()
        .map_err(Error::GraphicsError)
}
