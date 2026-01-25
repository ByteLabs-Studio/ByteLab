use iced::{
    Element,
    widget::{column, text},
};

pub fn view() -> Element<'static, crate::SettingsMessage> {
    let content = column![
        text("Work in progress").size(24),
    ]
    .spacing(20);

    content.into()
}
