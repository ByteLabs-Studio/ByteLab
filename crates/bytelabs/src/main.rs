use {
    iced::{
        Border, Center, Element, Length, Task, Theme,
        theme::palette::{Pair, Primary},
        widget::{button, column, text},
    },
    std::{
        sync::{Arc, Mutex},
        time::Duration,
    },
};

fn main() -> iced::Result {
    iced::application("ByteLabs", ByteLabs::update, ByteLabs::view)
        .theme(ByteLabs::theme)
        .run_with(ByteLabs::new)
}

#[derive(Clone, Default)]
struct ConfigTheme {}

#[derive(Clone, Default)]
struct DesktopConfig {
    theme: iced::theme::Theme,
}

#[derive(Clone)]
struct ByteLabs {
    config: DesktopConfig,
}

#[derive(Debug, Clone)]
enum Message {
    ExitProgram,
}

impl ByteLabs {
    fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::ExitProgram => iced::exit(),
        }
    }

    fn view(&self) -> Element<'_, Message> {
        column![
            text("Froststrap").size(30),
            button("Close app")
                .on_press(Message::ExitProgram)
                .style(|theme: &Theme, status| {
                    use button::{Status, Style};
                    let Primary {
                        weak: Pair { color: weak, .. },
                        base: Pair { color: base, .. },
                        strong: Pair { color: strong, .. },
                    } = theme.extended_palette().primary;

                    let mut style =
                        Style::default().with_background(iced::Background::from(match status {
                            Status::Active | Status::Disabled => weak,
                            Status::Hovered => base,
                            Status::Pressed => strong,
                        }));

                    style.border = Border {
                        width: 1.0,
                        color: iced::Color::from_rgba8(0, 0, 0, 0.0),
                        radius: self.config.theme.roundness.into(),
                    };

                    style
                })
                .padding(10)
        ]
        .width(Length::Fill)
        .padding(20)
        .align_x(Center)
        .into()
    }

    fn theme(&self) -> Theme {
        self.config.theme.clone()
    }

    fn new() -> (Self, Task<Message>) {
        let config = match DesktopConfig::load(None) {
            Ok(cfg) => {
                // log::success!("Config loaded successfully");
                cfg
            }
            Err(e) => {
                // log::error!("{}", e.to_string());
                DesktopConfig::default()
            }
        };

        (
            Self { config },
            Task::future(async move {
                std::thread::sleep(Duration::from_millis(10));
            }),
        )
    }
}
