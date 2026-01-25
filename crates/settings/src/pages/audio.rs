use iced::{
    Alignment,
    Element, Length,
    widget::{column, row, text, pick_list, Space},
};

pub fn view(
    selected_driver: Option<String>,
    driver_options: Vec<String>,
) -> Element<'static, crate::SettingsMessage> {
    let content = column![
        text("Audio System").size(24),
        row![
            text("Driver Model:"),
            Space::new().width(Length::Fill),
            pick_list(
                driver_options,
                selected_driver,
                crate::SettingsMessage::DriverSelected
            )
            .width(200)
        ]
        .width(Length::Fill)
        .align_y(Alignment::Center),
    ]
    .spacing(20);

    content.into()
}
