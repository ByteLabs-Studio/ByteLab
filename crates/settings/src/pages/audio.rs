use iced::{
    Alignment, Element, Length,
    widget::{Space, button, column, pick_list, row, slider, text},
};

pub fn view(
    selected_driver: Option<String>,
    driver_options: Vec<String>,
    selected_device: Option<String>,
    device_options: Vec<String>,
    test_tone_playing: bool,
    test_tone_freq: f32,
    test_tone_gain: f32,
) -> Element<'static, crate::SettingsMessage> {
    let play_label = if test_tone_playing { "Stop" } else { "Play" };

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
        ],
        row![
            text("Output Device:"),
            Space::new().width(Length::Fill),
            pick_list(
                device_options,
                selected_device,
                crate::SettingsMessage::DeviceSelected
            )
            .width(200)
        ],
        row![
            text("Test Tone"),
            Space::new().width(Length::Fill),
            button(play_label)
                .on_press(crate::SettingsMessage::PlayTestTone)
                .width(100)
        ]
        .width(Length::Fill)
        .align_y(Alignment::Center),
        row![
            text("Frequency (Hz):"),
            slider(
                20.0..=bytelabs_aios::MAX_TEST_TONE_FREQ,
                test_tone_freq,
                crate::SettingsMessage::SetTestToneFrequency
            )
            .width(300),
            Space::new().width(10),
            text(format!("{:.1} Hz", test_tone_freq)),
        ]
        .align_y(Alignment::Center),
        row![
            text("Gain:"),
            slider(
                0.0..=bytelabs_aios::MAX_TEST_TONE_GAIN,
                test_tone_gain,
                crate::SettingsMessage::SetTestToneGain
            )
            .step(0.0001)
            .width(300),
            Space::new().width(10),
            text(format!("{:.2}", test_tone_gain)),
        ]
        .align_y(Alignment::Center),
    ]
    .spacing(20);

    content.into()
}
