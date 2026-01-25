use {
    bytelabs_config::Config,
    bytelabs_settings::{Settings, SettingsMessage},
    iced::{
        Center, Element, Length, Task, Theme, keyboard,
        widget::{button, column, text},
        window,
    },
    log::info,
    std::sync::{Arc, RwLock},
};

fn main() -> iced::Result {
    env_logger::init();

    if let Err(e) = Config::init_global(None) {
        eprintln!("Failed to initialize config: {:?}", e);
        std::process::exit(1);
    }

    iced::daemon(ByteLabs::new, ByteLabs::update, ByteLabs::view)
        .subscription(ByteLabs::subscription)
        .title("ByteLabs")
        .theme(ByteLabs::theme)
        .run()
}

struct ByteLabs {
    page: Page,
    config: Arc<RwLock<Config>>,
    settings_state: Settings,
    main_window: Option<window::Id>,
    settings_window: Option<window::Id>,
}

#[derive(Clone, PartialEq, Debug)]
enum Page {
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
        let config = Config::global();

        let (id, task) = window::open(window::Settings {
            size: iced::Size::new(800.0, 600.0),
            ..Default::default()
        });

        (
            Self {
                page: Page::Dashboard,
                settings_state: Settings::new(),
                config,
                main_window: Some(id),
                settings_window: None,
            },
            task.map(MainMessage::MainWindowOpened),
        )
    }

    fn theme(&self, _window: window::Id) -> Theme {
        self.config
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

            MainMessage::EventOccurred(event) => {
                if let keyboard::Event::KeyPressed { key, modifiers, .. } = event {
                    if key == keyboard::Key::Character(",".into())
                        && modifiers == keyboard::Modifiers::COMMAND
                    {
                        return Task::done(MainMessage::OpenSettings);
                    }

                    if key == keyboard::Key::Named(keyboard::key::Named::Escape) {
                        if let Some(id) = self.settings_window {
                            return window::close(id);
                        }
                    }
                }
                Task::none()
            }

            MainMessage::OpenSettings => {
                if self.settings_window.is_none() {
                    let (id, task) = window::open(window::Settings {
                        size: iced::Size::new(1000.0, 600.0),
                        resizable: false,
                        ..Default::default()
                    });

                    self.settings_window = Some(id);
                    return task.map(MainMessage::SettingsWindowOpened);
                }
                Task::none()
            }

            MainMessage::SettingsWindowOpened(id) => {
                self.settings_window = Some(id);
                Task::none()
            }

            MainMessage::WindowClosed(id) => {
                if Some(id) == self.settings_window {
                    self.settings_window = None;
                } else if Some(id) == self.main_window {
                    return iced::exit();
                }
                Task::none()
            }

            MainMessage::OpenPage(p) => {
                if self.page != p {
                    info!("Opening {p:#?}");
                    self.page = p;
                }
                Task::none()
            }

            MainMessage::Settings(settings_msg) => {
                match &settings_msg {
                    SettingsMessage::ThemeSelected(new_theme) => {
                        if let Ok(mut cfg) = self.config.write() {
                            if let Some(interface) = &mut cfg.interface {
                                interface.theme = Some(new_theme.clone());
                            }
                        }

                        if let Err(e) = Config::save_global() {
                            log::error!("Failed to autosave config: {:?}", e);
                        }
                    }
                    _ => {}
                }

                self.settings_state
                    .update(settings_msg)
                    .map(MainMessage::Settings)
            }
        }
    }

    fn view(&self, window_id: window::Id) -> Element<'_, MainMessage> {
        if Some(window_id) == self.settings_window {
            return self
                .settings_state
                .view(self.config.clone())
                .map(MainMessage::Settings);
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
