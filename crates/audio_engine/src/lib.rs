use cpal::{
    FromSample, I24, Sample, SizedSample,
    traits::{DeviceTrait, HostTrait, StreamTrait},
};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioDrivers {
    JACK,
    ASIO,
    ALSA,
    CoreAudio,
    WASAPI,
    PipeWire,
}

impl std::fmt::Display for AudioDrivers {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let label = match self {
            AudioDrivers::JACK => "JACK",
            AudioDrivers::ASIO => "ASIO",
            AudioDrivers::ALSA => "ALSA",
            AudioDrivers::CoreAudio => "Core Audio",
            AudioDrivers::WASAPI => "WASAPI",
            AudioDrivers::PipeWire => "PipeWire",
        };
        write!(f, "{label}")
    }
}

impl AudioDrivers {
    pub fn label(&self) -> &'static str {
        match self {
            AudioDrivers::JACK => "JACK",
            AudioDrivers::ASIO => "ASIO",
            AudioDrivers::ALSA => "ALSA",
            AudioDrivers::CoreAudio => "Core Audio",
            AudioDrivers::WASAPI => "WASAPI",
            AudioDrivers::PipeWire => "PipeWire",
        }
    }
}

pub fn get_available_drivers() -> Vec<AudioDrivers> {
    if cfg!(target_os = "macos") {
        vec![AudioDrivers::CoreAudio, AudioDrivers::JACK]
    } else if cfg!(target_os = "windows") {
        vec![AudioDrivers::WASAPI, AudioDrivers::ASIO, AudioDrivers::JACK]
    } else if cfg!(target_os = "linux") {
        vec![
            AudioDrivers::ALSA,
            AudioDrivers::PipeWire,
            AudioDrivers::JACK,
        ]
    } else {
        vec![AudioDrivers::JACK]
    }
}

pub const MAX_TEST_TONE_FREQ: f32 = 10_000.0;
pub const MAX_TEST_TONE_GAIN: f32 = 0.50;

struct AudioState {
    stream: Mutex<Option<cpal::Stream>>,
    freq_bits: Arc<AtomicU32>,
    gain_bits: Arc<AtomicU32>,
    playing: AtomicBool,
}

static AUDIO_STATE: OnceLock<AudioState> = OnceLock::new();

fn get_audio_state() -> &'static AudioState {
    AUDIO_STATE.get_or_init(|| AudioState {
        stream: Mutex::new(None),
        freq_bits: Arc::new(AtomicU32::new(440.0f32.to_bits())),
        gain_bits: Arc::new(AtomicU32::new(0.5f32.to_bits())),
        playing: AtomicBool::new(false),
    })
}

pub fn start_test_tone(freq_hz: f32) -> Result<(), ()> {
    let state = get_audio_state();

    if state.playing.swap(true, Ordering::SeqCst) {
        state.freq_bits.store(freq_hz.to_bits(), Ordering::SeqCst);
        return Ok(());
    }

    state.freq_bits.store(freq_hz.to_bits(), Ordering::SeqCst);

    let host = cpal::default_host();
    let device = match host.default_output_device() {
        Some(d) => d,
        None => return Err(()),
    };

    let supported_config = match device.default_output_config() {
        Ok(c) => c,
        Err(_) => return Err(()),
    };

    let sample_format = supported_config.sample_format();
    let stream_config: cpal::StreamConfig = supported_config.into();

    let freq_arc = state.freq_bits.clone();

    let stream_res = match sample_format {
        cpal::SampleFormat::I8 => {
            build_continuous_stream::<i8>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::I16 => {
            build_continuous_stream::<i16>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::I24 => {
            build_continuous_stream::<I24>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::I32 => {
            build_continuous_stream::<i32>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::I64 => {
            build_continuous_stream::<i64>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::U8 => {
            build_continuous_stream::<u8>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::U16 => {
            build_continuous_stream::<u16>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::U32 => {
            build_continuous_stream::<u32>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::U64 => {
            build_continuous_stream::<u64>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::F32 => {
            build_continuous_stream::<f32>(&device, &stream_config, freq_arc.clone())
        }
        cpal::SampleFormat::F64 => {
            build_continuous_stream::<f64>(&device, &stream_config, freq_arc.clone())
        }
        _ => Err(()),
    };

    let stream = stream_res?;
    stream.play().map_err(|_| ())?;
    if let Ok(mut guard) = state.stream.lock() {
        *guard = Some(stream);
    }

    state.playing.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn stop_test_tone() -> Result<(), ()> {
    let state = get_audio_state();
    state.playing.store(false, Ordering::SeqCst);

    if let Ok(mut guard) = state.stream.lock() {
        if guard.is_some() {
            *guard = None;
        }
    }

    Ok(())
}

pub fn set_test_tone_frequency(freq_hz: f32) -> Result<(), ()> {
    let state = get_audio_state();
    let f = freq_hz.min(MAX_TEST_TONE_FREQ).max(0.0);
    state.freq_bits.store(f.to_bits(), Ordering::SeqCst);
    Ok(())
}

pub fn set_test_tone_gain(gain: f32) -> Result<(), ()> {
    let state = get_audio_state();
    let g = gain.max(0.0).min(MAX_TEST_TONE_GAIN);
    state.gain_bits.store(g.to_bits(), Ordering::SeqCst);
    Ok(())
}

pub fn woohoo_test_tone() -> Result<(), ()> {
    start_test_tone(440.0f32)?;
    std::thread::sleep(std::time::Duration::from_millis(1000));
    let _ = stop_test_tone();
    Ok(())
}

fn build_continuous_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    freq_arc: Arc<AtomicU32>,
) -> Result<cpal::Stream, ()>
where
    T: SizedSample + FromSample<f32> + Sample,
{
    let sample_rate = config.sample_rate as f32;
    let channels = config.channels as usize;

    let mut phase = 0f32;
    let err_fn = |err| eprintln!("an error occurred on stream: {err}");

    let mut smoothed_freq = f32::from_bits(freq_arc.load(Ordering::Relaxed));
    let tau_seconds = 0.005_f32;
    let alpha = 1.0_f32 - (-1.0 / (sample_rate * tau_seconds)).exp();

    let gain_arc = get_audio_state().gain_bits.clone();

    let callback = move |data: &mut [T], _: &cpal::OutputCallbackInfo| {
        use std::f32::consts::PI;
        for frame in data.chunks_mut(channels) {
            let target_freq = f32::from_bits(freq_arc.load(Ordering::Relaxed));
            smoothed_freq += (target_freq - smoothed_freq) * alpha;
            let gain = f32::from_bits(gain_arc.load(Ordering::Relaxed));
            let phase_inc = 2.0 * PI * smoothed_freq / sample_rate;
            phase = (phase + phase_inc) % (2.0 * PI);
            let value: T = T::from_sample(phase.sin() * gain);
            for sample in frame.iter_mut() {
                *sample = value;
            }
        }
    };

    let stream = device
        .build_output_stream(config, callback, err_fn, None)
        .map_err(|_| ())?;

    Ok(stream)
}
