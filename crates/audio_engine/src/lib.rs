pub extern crate cpal;
use {
    bytelabs_config::Config,
    cpal::{
        FromSample, Sample, SampleFormat, SizedSample,
        traits::{DeviceTrait, HostTrait, StreamTrait},
    },
    std::sync::atomic::{AtomicBool, AtomicU32, Ordering},
    std::sync::{Arc, Mutex, OnceLock},
};

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

    let config = Config::global();
    let config_guard = config.read().unwrap();
    let audio_config = config_guard.audio.as_ref();

    let host = audio_config
        .and_then(|a| a.driver.as_ref())
        .and_then(|driver_name| {
            cpal::available_hosts()
                .into_iter()
                .find(|id| id.to_string() == *driver_name)
                .and_then(|id| cpal::host_from_id(id).ok())
        })
        .unwrap_or_else(cpal::default_host);

    let device = audio_config
        .and_then(|a| a.device.as_ref())
        .and_then(|device_name| {
            host.output_devices()
                .ok()?
                .find(|d| d.description().ok().unwrap().name() == device_name)
        })
        .or_else(|| host.default_output_device())
        .ok_or(())?;

    let supported_config = match device.default_output_config() {
        Ok(c) => c,
        Err(_) => return Err(()),
    };

    let sample_format = supported_config.sample_format();
    let stream_config: cpal::StreamConfig = supported_config.into();
    let freq_arc = state.freq_bits.clone();
    let stream = (get_stream_builder(sample_format)?)(&device, &stream_config, freq_arc)?;

    stream.play().map_err(std::mem::drop)?;

    if let Ok(mut guard) = state.stream.lock() {
        guard.replace(stream);
    }

    state.playing.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn stop_test_tone() -> Result<(), ()> {
    let state = get_audio_state();
    state.playing.store(false, Ordering::SeqCst);

    if let Ok(mut guard) = state.stream.lock() {
        _ = guard.take();
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
    _ = stop_test_tone();
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

            frame.iter_mut().for_each(|sample| *sample = value);
        }
    };

    device
        .build_output_stream(config, callback, err_fn, None)
        .map_err(|_| ())
}

fn get_stream_builder(
    sample_format: SampleFormat,
) -> Result<
    impl Fn(&cpal::Device, &cpal::StreamConfig, Arc<AtomicU32>) -> Result<cpal::Stream, ()>,
    (),
> {
    use SampleFormat::*;
    Ok(match sample_format {
        I8 => build_continuous_stream::<i8>,
        I16 => build_continuous_stream::<i16>,
        I24 => build_continuous_stream::<cpal::I24>,
        I32 => build_continuous_stream::<i32>,
        I64 => build_continuous_stream::<i64>,
        U8 => build_continuous_stream::<u8>,
        U16 => build_continuous_stream::<u16>,
        U32 => build_continuous_stream::<u32>,
        U64 => build_continuous_stream::<u64>,
        F32 => build_continuous_stream::<f32>,
        F64 => build_continuous_stream::<f64>,
        _ => return Err(()),
    })
}
