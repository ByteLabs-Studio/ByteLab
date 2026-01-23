mod colorize;
use chrono::{Datelike, Timelike};

use crate::colorize::{Color, ColorExt};
use std::fmt;

#[allow(dead_code)]
pub enum LogLevel {
    Info,
    Success,
    Warning,
    Error,
    Debug,
}

impl LogLevel {
    const fn as_str(&self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Success => "success",
            Self::Warning => "warn",
            Self::Error => "error",
            Self::Debug => "debug",
        }
    }

    const fn get_color(&self) -> Color {
        match self {
            Self::Info => Color::Cyan,
            Self::Success => Color::Green,
            Self::Warning => Color::Yellow,
            Self::Error => Color::Red,
            Self::Debug => Color::Blue,
        }
    }
}

pub fn log_internal(level: LogLevel, args: fmt::Arguments<'_>) {
    let color = level.get_color();

    println!(
        "{} {}",
        format!(
            "[{}-{}-{}T{}:{}:{} {}]:",
            chrono::Utc::now().year(),
            chrono::Utc::now().month(),
            chrono::Utc::now().day(),
            chrono::Utc::now().hour(),
            chrono::Utc::now().minute(),
            chrono::Utc::now().second(),
            level.as_str().to_uppercase()
        )
        .color(color)
        .bold(),
        args
    );
}

#[macro_export]
macro_rules! info {
    ($($arg:tt)*) => {
        bytelab_logger::log_internal(bytelab_logger::LogLevel::Info, format_args!($($arg)*));
    };
}

#[macro_export]
macro_rules! success {
    ($($arg:tt)*) => {
        bytelab_logger::log_internal(bytelab_logger::LogLevel::Success, format_args!($($arg)*));
    };
}

#[macro_export]
macro_rules! warning {
    ($($arg:tt)*) => {
        bytelab_logger::log_internal(bytelab_logger::LogLevel::Warning, format_args!($($arg)*));
    };
}

#[macro_export]
macro_rules! error {
    ($($arg:tt)*) => {
        bytelab_logger::log_internal(bytelab_logger::LogLevel::Error, format_args!($($arg)*));
    };
}

#[macro_export]
macro_rules! debug {
    ($($arg:tt)*) => {
        bytelab_logger::log_internal(bytelab_logger::LogLevel::Debug, format_args!($($arg)*));
    };
}
