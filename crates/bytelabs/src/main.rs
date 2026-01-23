use {
    bytelab_logger::info,
    iced::{
        Center, Element, Length, Task, keyboard, task,
        theme::Theme,
        widget::{button, column, text},
    },
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
    page: Pages,
}

#[derive(Default)]
enum Pages {
    #[default]
    Dashboard,
    Project(String),
    Settings,
}

#[derive(Debug, Clone)]
enum Message {
    ExitProgram,
    OpenSettings,
    OpenDashboard,
    OpenProject(String),
}

impl ByteLab {
    fn theme(&self) -> Theme {
        // self.theme.clone()
        Theme::Dark
    }

    fn subscription(&self) -> iced::Subscription<Message> {
        keyboard::on_key_press(|key, modifier| {
            // info!("Key pressed: {key:#?} {modifier:#?}");
            if modifier == keyboard::Modifiers::CTRL && key == keyboard::Key::Character(",".into())
            {
                Some(Message::OpenSettings)
            } else {
                None
            }
        })
    }

    fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::ExitProgram => iced::exit(),
            Message::OpenSettings => {
                info!("Opening Settings");
                self.page = Pages::Settings;
                task::Task::none()
            }
            Message::OpenDashboard => {
                info!("Opening Dashboard");
                self.page = Pages::Dashboard;
                task::Task::none()
            }
            Message::OpenProject(x) => {
                info!("Opening Project {x}");
                self.page = Pages::Project(x);
                task::Task::none()
            }
        }
    }

    fn view(&self) -> Element<'_, Message> {
        match &self.page {
            Pages::Dashboard => column![
                text("ByteLab").size(30),
                button(text("Open Settings")).on_press(Message::OpenSettings),
                button(text("Open Project: a")).on_press(Message::OpenProject(
                    "/home/invra/docs/bytelab/sandwhich.blproj".into()
                )),
                button(text("Exit")).on_press(Message::ExitProgram),
            ]
            .width(Length::Fill)
            .padding(20)
            .align_x(Center)
            .into(),
            Pages::Settings => text("yo").into(),
            Pages::Project(x) => text(format!("Project: {x}")).into(),
        }
    }
}
