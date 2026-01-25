use iced::{
    Alignment::Center,
    Element, Length, Theme,
    widget::{Space, button, container, row, text},
};

pub fn category_button<'a>(
    label: &'a str,
    is_active: bool,
    category: super::Category,
) -> Element<'a, super::SettingsMessage> {
    let content = row![
        container(Space::new().width(0))
            .width(4)
            .height(27)
            .style(move |theme: &Theme| {
                container::Style::default().background(if is_active {
                    theme.extended_palette().primary.base.color
                } else {
                    iced::Color::TRANSPARENT
                })
            }),
        text(label).size(14),
    ]
    .spacing(12)
    .align_y(Center);

    button(content)
        .width(Length::Fill)
        .padding(iced::Padding {
            left: 0.0,
            right: 12.0,
            top: 6.0,
            bottom: 6.0,
        })
        .on_press(super::SettingsMessage::CategorySelected(category))
        .style(move |theme: &Theme, status| {
            let palette = theme.extended_palette();
            let mut style = button::primary(theme, status);

            style.background = match status {
                button::Status::Hovered => Some(palette.background.weak.color.into()),
                button::Status::Pressed => Some(palette.background.weaker.color.into()),
                _ => {
                    if is_active {
                        Some(palette.background.weakest.color.into())
                    } else {
                        None
                    }
                }
            };

            style.text_color = if is_active {
                palette.background.weakest.text
            } else {
                palette.background.base.text
            };

            style
        })
        .into()
}
