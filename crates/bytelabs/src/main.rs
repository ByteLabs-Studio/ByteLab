use iced::{
    Center, Element, Length, Task, keyboard,
    theme::Theme,
    widget::{button, column, text},
};

fn main() -> iced::Result {
    iced::application("BytleLab", ByteLab::update, ByteLab::view)
        .theme(ByteLab::theme)
        .subscription(ByteLab::subscription)
        .run()
}

#[derive(Default)]
struct ByteLab {
    theme: Theme,
}

#[derive(Debug, Clone, Copy)]
enum Message {
    ExitProgram,
    OpenDash,
}

impl ByteLab {
    fn theme(&self) -> Theme {
        self.theme.clone()
    }

    fn subscription(&self) -> iced::Subscription<Message> {
        keyboard::on_key_press(|key, _| {
            matches!(key, keyboard::Key::Named(keyboard::key::Named::F2))
                .then_some(Message::OpenDash)
        })
    }

    fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::ExitProgram => iced::exit(),
            Message::OpenDash => iced::exit(),
        }
    }

    fn view(&self) -> Element<'_, Message> {
        column![
            text("ByteLab").size(30),
            button(text("Open Dashboard")).on_press(Message::OpenDash),
        ]
        .width(Length::Fill)
        .padding(20)
        .align_x(Center)
        .into()
    }
}
