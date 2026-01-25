use iced::{
    Alignment,
    Element, Length, Theme,
    widget::{column, row, text, pick_list, Space},
};

pub fn view(current_theme: Theme) -> Element<'static, crate::SettingsMessage> {
    let content = column![
        text("General Settings").size(24),
        row![
            text("Color Scheme:"),
            Space::new().width(Length::Fill),
            pick_list(
                Theme::ALL,
                Some(current_theme),
                crate::SettingsMessage::ThemeSelected
            )
            .width(200)
        ]
        .align_y(Alignment::Center),
    ]
    .spacing(20);

    content.into()
}
