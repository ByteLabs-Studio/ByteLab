use gpui::*;

struct ByteLabs {
    text: String,
}

impl Render for ByteLabs {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .bg(rgb(0x2e7d32))
            .size_full()
            .justify_center()
            .items_center()
            .text_xl()
            .text_color(rgb(0xffffff))
            .child(format!("Hello, {}!", &self.text))
    }
}

actions!(image, [Quit]);

pub fn main() {
    gpui::Application::new().run(move |cx: &mut App| {
        let bounds =
            WindowBounds::Windowed(gpui::Bounds::centered(None, size(px(400.), px(200.)), cx));

        cx.open_window(
            WindowOptions {
                window_bounds: Some(bounds),
                titlebar: Some(gpui::TitlebarOptions {
                    title: Some("ByteLabs".into()),
                    appears_transparent: false,
                    traffic_light_position: Some(point(px(12.0), px(6.0))),
                }),
                window_min_size: Some(gpui::Size {
                    width: px(360.0),
                    height: px(240.0),
                }),
                ..Default::default()
            },
            move |_window, cx| {
                cx.new(move |_| ByteLabs {
                    text: "World".into(),
                })
            },
        )
        .unwrap();

        cx.on_action(|_: &Quit, cx| cx.quit());
        cx.bind_keys([KeyBinding::new("cmd-q", Quit, None)]);
    });
}
