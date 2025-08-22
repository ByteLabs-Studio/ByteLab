const playButton = document.getElementById('play');
const pauseButton = document.getElementById('pause');
const stopButton = document.getElementById('stop');
const tempoSelect = document.getElementById('tempoSelect');
const hzSelect = document.getElementById('hzSelect');
const modeSelect = document.getElementById('modeSelect');
const volumeSlider = document.getElementById('volumeSlider');
const viewWaveCb = document.getElementById('viewWave');
const viewSpecCb = document.getElementById('viewSpec');
const viewHarmCb = document.getElementById('viewHarm');
const panelWave = document.getElementById('panelWave');
const panelSpec = document.getElementById('panelSpec');
const panelHarm = document.getElementById('panelHarm');
const editorEl = document.getElementById('editor');
const statusEl = document.getElementById('status');
const waveCanvas = document.getElementById('waveCanvas');
const specCanvas = document.getElementById('specCanvas');
const harmCanvas = document.getElementById('harmCanvas');
const errorBox = document.getElementById('errorBox');
const captureOscBtn = document.getElementById('captureOsc');
const uploadMp3Btn = document.getElementById('uploadMp3');
const mp3FileInput = document.getElementById('mp3FileInput');
const exactToggle = document.getElementById('exactToggle');
// Oscilloscope controls
const oscDelayEl = document.getElementById('oscDelay');
const oscPersistEl = document.getElementById('oscPersist');
const oscThickEl = document.getElementById('oscThick');
const oscSquareEl = document.getElementById('oscSquare');
// Wave/Spectrogram controls
const waveREl = document.getElementById('waveR');
const waveGEl = document.getElementById('waveG');
const waveBEl = document.getElementById('waveB');
const waveColorSwatch = document.getElementById('waveColorSwatch');
const specContrastEl = document.getElementById('specContrast');
const specBrightnessEl = document.getElementById('specBrightness');
// Effect controls
const effectSelect = document.getElementById('effectSelect');
const driveSlider = document.getElementById('driveSlider');
const bitsSlider = document.getElementById('bitsSlider');
const downsampleSlider = document.getElementById('downsampleSlider');
let aceEditor = null;

// Settings modal elements
const openSettingsBtn = document.getElementById('openSettings');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const cancelSettingsBtn = document.getElementById('cancelSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const setShowWave = document.getElementById('setShowWave');
const setShowSpec = document.getElementById('setShowSpec');
const setShowHarm = document.getElementById('setShowHarm');
const setSquareAspect = document.getElementById('setSquareAspect');

if (!playButton || !editorEl) {
  console.error('Required DOM elements not found: #play or #editor');
}

let audioCtx = null;
let processor = null;
let masterGain = null;
let lowpass = null;
let analyser = null;
let exprFunc = null;
let t = 0;
let isPlaying = false;
let isPaused = false;
let bbSampleRate = 8000; // configurable via Hz select
let tempoFactor = 1;     // 1.0 = normal; controlled by Tempo select
let vizRAF = 0;
let vizResizeHandler = null;
let desiredVolume = 0.8; // from volume slider
let currentMode = 'float'; // 'byte' | 'signed' | 'float' | 'func'
let exactMode = false;
// Oscilloscope state
let oscDelayVal = 25;     // 0..100 (% of buffer window)
let oscPersistVal = 28;   // 0..100 (higher -> longer trails)
let oscThickVal = 1.6;    // px
let oscSquare = true;     // square aspect
// Wave/Spectrogram state
let waveColor = { r: 57, g: 255, b: 20 }; // default neon green
let specContrastVal = 1.0;  // multiplier
let specBrightnessVal = 0.2; // additive (0..1)
// Effect state
let effectType = 'none';   // 'none' | 'distortion' | 'bitcrusher'
let drive = 0.5;           // 0..1
let crushBits = 8;         // 4..16
let downsample = 2;        // 1..16
let dsCounter = 0;         // sample-hold counter
let heldSample = 0;

function rgbStr({ r, g, b }) {
  const R = Math.max(0, Math.min(255, r|0));
  const G = Math.max(0, Math.min(255, g|0));
  const B = Math.max(0, Math.min(255, b|0));
  return `rgb(${R},${G},${B})`;
}

function updateWaveSwatch() {
  if (waveColorSwatch) waveColorSwatch.style.background = rgbStr(waveColor);
}

function updateStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.style.display = 'block';
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.style.display = 'none';
}

function parseLineColFromStack(err) {
  const s = String(err && err.stack || '');
  const m = s.match(/anonymous:(\d+):(\d+)/) || s.match(/<anonymous>:(\d+):(\d+)/);
  if (m) return { line: parseInt(m[1], 10), column: parseInt(m[2], 10) };
  return null;
}

function createExprFunc(exprText) {
  const wrapped = `return (\n${exprText}\n);`;
  try {
    // Provide common Math aliases so users can write abs(), log2(), cbrt(), random(), etc.
    const fn = new Function(
      't',
      'abs','sin','cos','tan','asin','acos','atan','atan2',
      'log','log2','exp','sqrt','cbrt','pow','hypot',
      'floor','ceil','round','trunc','sign',
      'min','max','random','isNaN','PI','E',
      wrapped
    );
    // Bind Math functions on call
    return (tt) => fn(
      tt,
      Math.abs, Math.sin, Math.cos, Math.tan, Math.asin, Math.acos, Math.atan, Math.atan2,
      Math.log, Math.log2, Math.exp, Math.sqrt, Math.cbrt, Math.pow, Math.hypot,
      Math.floor, Math.ceil, Math.round, Math.trunc, Math.sign,
      Math.min, Math.max, Math.random, isNaN, Math.PI, Math.E
    );
  } catch (e) {
    const lc = parseLineColFromStack(e);
    if (lc) {
      const userLine = Math.max(1, lc.line - 1);
      const msg = `compilation error: ${e.message} (at line ${userLine}, character ${lc.column})`;
      showError(msg);
      try {
        aceEditor?.getSession()?.setAnnotations([
          { row: userLine - 1, column: Math.max(0, lc.column - 1), text: e.message, type: 'error' }
        ]);
      } catch (_) { /* noop */ }
    } else {
      showError(`compilation error: ${e.message}`);
    }
    throw e;
  }
}

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function startProcessor() {
  const bufferSize = 1024;
  processor = audioCtx.createScriptProcessor(bufferSize, 0, 1);
  let lastSample = 0;
  let lastKind = 'float'; // 'float' | 'signed' | 'byte' (for func mode classification)

  let acc = 0;
  // For Float/Func modes: keep previous and next sample to linearly interpolate
  let interpPrev = 0;
  let interpNext = 0;
  let interpInit = false;

  processor.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
      // compute current step so Tempo/Hz update immediately
      const step = (bbSampleRate * tempoFactor) / audioCtx.sampleRate;
      acc += step;
      while (acc >= 1) {
        try {
          const v = exprFunc ? exprFunc(t) : 0;
          switch (currentMode) {
            case 'byte': {
              // 0..255 -> -1..1
              const vi = (v | 0) & 255;
              const computed = (vi - 128) / 128;
              interpPrev = interpNext; interpNext = computed; interpInit = true;
              lastSample = computed;
              break;
            }
            case 'signed': {
              // Proper 8-bit two's-complement wrap to -128..127
              // This matches classic signed bytebeat behavior with overflow
              let vi = (v | 0);
              vi = ((vi + 128) & 255) - 128; // wrap to int8
              const computed = vi / 128; // center around 0, -1..~1
              interpPrev = interpNext; interpNext = computed; interpInit = true;
              lastSample = computed;
              break;
            }
            case 'func': {
              // In Funcbeat, expression returns a function f(t) or a value.
              // We detect integer vs float outputs:
              //  - Integer in [-128..127] => treat as signed byte
              //  - Integer in [0..255]    => treat as unsigned byte
              //  - Otherwise               => float in [-1..1]
              let fv;
              if (typeof v === 'function') fv = v(t); else fv = Number(v);
              if (!Number.isFinite(fv)) fv = 0;
              if (Number.isInteger(fv)) {
                if (fv >= -128 && fv <= 127) {
                  // signed byte style
                  const vi = ((fv | 0) + 128 & 255) - 128; // wrap to int8
                  const computed = vi / 128;
                  interpPrev = interpNext; interpNext = computed; interpInit = true;
                  lastSample = computed;
                  lastKind = 'signed';
                } else if (fv >= 0 && fv <= 255) {
                  // unsigned byte style
                  const vi = (fv | 0) & 255;
                  const computed = (vi - 128) / 128;
                  interpPrev = interpNext; interpNext = computed; interpInit = true;
                  lastSample = computed;
                  lastKind = 'byte';
                } else {
                  // out-of-range integer -> clamp as float
                  const computed = Math.max(-1, Math.min(1, fv));
                  interpPrev = interpNext; interpNext = computed; interpInit = true;
                  lastSample = computed;
                  lastKind = 'float';
                }
              } else {
                const computed = Math.max(-1, Math.min(1, fv));
                interpPrev = interpNext; interpNext = computed; interpInit = true;
                lastSample = computed;
                lastKind = 'float';
              }
              break;
            }
            case 'float':
            default: {
              // Floatbeat: expression should return floats in [-1..1] (preserve smoothness)
              let fv = Number(v);
              if (!Number.isFinite(fv)) fv = 0;
              const computed = Math.max(-1, Math.min(1, fv));
              interpPrev = interpNext; interpNext = computed; interpInit = true;
              lastSample = computed;
              break;
            }
          }
        } catch (err) {
          lastSample = 0;
        }
        t++;
        acc -= 1;
      }
      // Compute base sample (interpolate only when appropriate)
      let s;
      if (currentMode === 'float') {
        // Floatbeat always interpolates to reduce stair-stepping
        s = interpInit ? (interpPrev + (interpNext - interpPrev) * acc) : lastSample;
      } else if (currentMode === 'func') {
        // Funcbeat: interpolate only for float outputs; for integer-style, keep steps
        if (lastKind === 'float') {
          s = interpInit ? (interpPrev + (interpNext - interpPrev) * acc) : lastSample;
        } else {
          s = lastSample;
          if (!exactMode) s = Math.tanh(s * 1.5); // same gentle saturation behavior as byte/signed
        }
      } else {
        // Byte/Signed modes
        s = lastSample;
        if (!exactMode) s = Math.tanh(s * 1.5); // gentle saturation for non-exact byte/signed
      }

      // Apply selected effect
      s = applyEffectSample(s);

      out[i] = Math.max(-1, Math.min(1, s));
    }
  };

  lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  updateFilterCutoff();
  lowpass.Q.value = 0.7;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = desiredVolume;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.2;

  // Connect graph with respect to exact mode
  connectGraph();

  startVisualization();
}

function stop() {
  if (processor) {
    try { processor.disconnect(); } catch (_) { /* noop */ }
    processor.onaudioprocess = null;
    processor = null;
  }
  if (lowpass) { try { lowpass.disconnect(); } catch (_) {} lowpass = null; }
  if (masterGain) { try { masterGain.disconnect(); } catch (_) {} masterGain = null; }
  if (analyser) { try { analyser.disconnect(); } catch (_) {} analyser = null; }
  if (audioCtx) {
    try { audioCtx.close(); } catch (_) { /* noop */ }
  }
  audioCtx = null;
  isPlaying = false;
  isPaused = false;
  t = 0;
  updateStatus('stopped');
  stopVisualization();
  clearVisualizers();
}

function play() {
  const exprText = getExpr();
  if (!exprText) return;
  ensureContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  try {
    exprFunc = createExprFunc(exprText);
    clearError();
    aceEditor?.getSession()?.clearAnnotations();
  } catch (e) {
    console.error('Invalid expression:', e);
    updateStatus('invalid expression');
    return;
  }

  if (!processor) {
    startProcessor();
  }

  isPlaying = true;
  isPaused = false;
  updateStatus('playing');
}

function pause() {
  if (!audioCtx || !isPlaying) return;
  if (audioCtx.state === 'running') {
    audioCtx.suspend();
    isPaused = true;
    updateStatus('paused');
  }
}

if (playButton) {
  playButton.addEventListener('click', () => {
    if (isPaused && audioCtx) {
      audioCtx.resume();
      isPaused = false;
      updateStatus('playing');
      return;
    }
    play();
  });
}

if (pauseButton) {
  pauseButton.addEventListener('click', () => pause());
}

if (stopButton) {
  stopButton.addEventListener('click', () => stop());
}

function initAce() {
  if (!window.ace || !editorEl) return;
  aceEditor = ace.edit('editor');
  aceEditor.setTheme('ace/theme/tomorrow_night');
  aceEditor.session.setMode('ace/mode/javascript');
  aceEditor.setOptions({
    fontSize: '14px',
    showPrintMargin: false,
    tabSize: 2,
    useSoftTabs: true,
    wrap: true,
  });
  try {
    exprFunc = createExprFunc(getExpr());
    clearError();
    aceEditor.getSession().clearAnnotations();
  } catch (_) { /* shown already */ }

  let lastGoodFunc = null;
  aceEditor.session.on('change', () => {
    const txt = getExpr();
    try {
      const compiled = createExprFunc(txt);
      lastGoodFunc = compiled;
      exprFunc = compiled;
      clearError();
      aceEditor.getSession().clearAnnotations();
      if (isPlaying && !isPaused) updateStatus('playing • updated');
      else if (isPaused) updateStatus('paused • updated');
    } catch (e) {
      updateStatus('syntax error (unchanged)');
    }
  });
}

function getExpr() {
  return aceEditor?.getValue()?.trim() || '';
}

initAce();

function setupCanvas(canvas) {
  if (!canvas) return { ctx: null, w: 0, h: 0 };
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const pxw = Math.max(1, Math.floor(rect.width * dpr));
  const pxh = Math.max(1, Math.floor(rect.height * dpr));
  canvas.width = pxw;
  canvas.height = pxh;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height, pxw, pxh, dpr };
}

function startVisualization() {
  if (!analyser) return;
  const timeData = new Uint8Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  let wctx, sctx, hctx, ww, wh, spxw, spxh, hpw, hph, wdpr, sdpr, hdpr;
  const resize = () => {
    ({ ctx: wctx, w: ww, h: wh, pxw: _, pxh: __, dpr: wdpr } = setupCanvas(waveCanvas));
    const spec = setupCanvas(specCanvas);
    sctx = spec.ctx; spxw = spec.pxw; spxh = spec.pxh;
    const harm = setupCanvas(harmCanvas);
    hctx = harm.ctx; hpw = harm.w; hph = harm.h; hdpr = harm.dpr;
  };
  resize();
  let resizeTimer = 0;
  vizResizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      clearVisualizers();
    }, 80);
  };
  window.addEventListener('resize', vizResizeHandler);

  const bgWave = '#0a0c12';
  // dynamic line color for waveform and oscilloscope
  let line = rgbStr(waveColor);
  const harmGrid = '#26233a';

  const render = () => {
    vizRAF = requestAnimationFrame(render);
    if (!analyser) return;

    if (wctx && waveCanvas) {
      if (panelWave && panelWave.style.display === 'none') {
        // skip drawing when hidden
      } else {
        analyser.getByteTimeDomainData(timeData);
        wctx.clearRect(0, 0, ww, wh);
        wctx.fillStyle = bgWave;
        wctx.fillRect(0, 0, ww, wh);
        // Draw filled waveform using min/max vertical bars per pixel column
        const step = timeData.length / ww;
        wctx.fillStyle = line; // keep same color
        for (let x = 0; x < ww; x++) {
          const i0 = Math.floor(x * step);
          const i1 = Math.floor((x + 1) * step);
          let lo = 255, hi = 0;
          for (let i = i0; i < i1; i++) {
            const v = timeData[i] | 0;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          // Fallback if bin empty
          if (i1 <= i0) {
            const v = timeData[i0] | 0;
            lo = Math.min(lo, v); hi = Math.max(hi, v);
          }
          const yTop = (1 - (hi / 255)) * wh;
          const yBot = (1 - (lo / 255)) * wh;
          const h = Math.max(1, yBot - yTop);
          wctx.fillRect(x, yTop, 1, h);
        }
      }
    }

    if (sctx && specCanvas) {
      if (panelSpec && panelSpec.style.display === 'none') {
        // skip when hidden
      } else {
        analyser.getByteFrequencyData(freqData);
        sctx.save();
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        try {
          if (spxw && spxh) {
            const img = sctx.getImageData(1, 0, spxw - 1, spxh);
            sctx.putImageData(img, 0, 0);
          }
        } catch (_) {}
        const x = Math.max(0, (spxw || 1) - 1);
        for (let y = 0; y < (spxh || 0); y++) {
          const bin = Math.min(freqData.length - 1, Math.floor(Math.pow(1 - y / (spxh || 1), 2) * freqData.length));
          // Apply contrast and brightness
          let mag = freqData[bin] / 255;
          mag = Math.max(0, Math.min(1, mag * specContrastVal + specBrightnessVal));
          const r = Math.floor(10 * mag);
          const g = Math.floor(80 * mag + 40);
          const b = Math.floor(200 * mag + 30);
          sctx.fillStyle = `rgb(${r},${g},${b})`;
          sctx.fillRect(x, y, 1, 1);
        }
        sctx.restore();
      }
    }

    // Oscilloscope (Lissajous) visualizer: plot s(t - Δ) on X vs s(t) on Y
    if (hctx && harmCanvas) {
      if (panelHarm && panelHarm.style.display === 'none') {
        // hidden
      } else {
        const Wfull = hpw || harmCanvas.clientWidth || 0;
        const Hfull = hph || harmCanvas.clientHeight || 0;
        // persistence fade (alpha lower => longer trails). Map 0..100 -> 0.5..0.05
        const fadeAlpha = 0.5 - 0.45 * Math.max(0, Math.min(100, oscPersistVal)) / 100;
        hctx.save();
        hctx.globalCompositeOperation = 'source-over';
        hctx.fillStyle = `rgba(11,10,18,${fadeAlpha.toFixed(3)})`;
        hctx.fillRect(0, 0, Wfull, Hfull);

        // crosshair
        hctx.strokeStyle = harmGrid;
        hctx.lineWidth = 1;
        hctx.beginPath();
        hctx.moveTo(0.5, Math.floor(Hfull/2)+0.5); hctx.lineTo(Wfull-0.5, Math.floor(Hfull/2)+0.5);
        hctx.moveTo(Math.floor(Wfull/2)+0.5, 0.5); hctx.lineTo(Math.floor(Wfull/2)+0.5, Hfull-0.5);
        hctx.stroke();

        // fetch time-domain data
        analyser.getByteTimeDomainData(timeData);
        const N = timeData.length;
        // Delay: map 0..100 -> 0..0.5 of window (0..50%)
        const delayRatio = Math.max(0, Math.min(100, oscDelayVal)) / 200; // 0..0.5
        const lag = Math.max(1, Math.floor(N * delayRatio));

        // Square aspect: draw into a centered square viewport
        const L = oscSquare ? Math.min(Wfull, Hfull) : null;
        const W = oscSquare ? L : Wfull;
        const H = oscSquare ? L : Hfull;
        const offX = oscSquare ? Math.floor((Wfull - W)/2) : 0;
        const offY = oscSquare ? Math.floor((Hfull - H)/2) : 0;
        const pad = 10;
        const scaleX = (W/2 - pad);
        const scaleY = (H/2 - pad);

        // draw XY polyline
        // refresh dynamic color each frame (in case sliders moved while paused)
        line = rgbStr(waveColor);
        hctx.strokeStyle = line;
        hctx.shadowColor = line;
        hctx.shadowBlur = 12;
        hctx.lineWidth = oscThickVal;
        hctx.beginPath();
        const stride = 2; // skip some samples for perf
        for (let i = 0; i < N - lag; i += stride) {
          const sY = (timeData[i] - 128) / 128;           // -1..1
          const sX = (timeData[i + lag] - 128) / 128;     // delayed
          const x = offX + Math.floor(W/2 + sX * scaleX) + 0.5;
          const y = offY + Math.floor(H/2 - sY * scaleY) + 0.5;
          if (i === 0) hctx.moveTo(x, y); else hctx.lineTo(x, y);
        }
        hctx.stroke();
        hctx.restore();
      }
    }
  };

  vizRAF = requestAnimationFrame(render);
}

function stopVisualization() {
  if (vizRAF) cancelAnimationFrame(vizRAF);
  vizRAF = 0;
  if (vizResizeHandler) {
    window.removeEventListener('resize', vizResizeHandler);
    vizResizeHandler = null;
  }
}

function clearCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function clearVisualizers() {
  clearCanvas(waveCanvas);
  clearCanvas(specCanvas);
  clearCanvas(harmCanvas);
}

function updateFilterCutoff() {
  if (!lowpass || !audioCtx) return;
  // Effective synthesis rate (controls Nyquist of the generated signal)
  const effRate = Math.max(1, bbSampleRate * tempoFactor);
  const nyq = Math.min(audioCtx.sampleRate * 0.49, effRate * 0.5);
  if (exactMode) {
    // Open filter wide for exact mode
    lowpass.frequency.value = 20000;
  } else {
    // Gentle margin below Nyquist to suppress aliasing
    lowpass.frequency.value = Math.max(1000, Math.min(18000, nyq * 0.9));
  }
}

// Wire up Tempo and Hz controls
if (tempoSelect) {
  tempoSelect.addEventListener('change', () => {
    const v = parseFloat(tempoSelect.value);
    if (!Number.isNaN(v) && v > 0) tempoFactor = v;
    updateFilterCutoff();
  });
}
if (hzSelect) {
  hzSelect.addEventListener('change', () => {
    const v = parseInt(hzSelect.value, 10);
    if (!Number.isNaN(v) && v > 0) bbSampleRate = v;
    updateFilterCutoff();
  });
  // initialize from the current select value (default 8000)
  const initialHz = parseInt(hzSelect.value, 10);
  if (!Number.isNaN(initialHz) && initialHz > 0) bbSampleRate = initialHz;
  // ensure filter matches initial effective rate
  updateFilterCutoff();
}

// Mode selector wiring
if (modeSelect) {
  const mv = String(modeSelect.value || '').toLowerCase();
  if (mv) currentMode = mv;
  syncEffectGroupDisabled();
  modeSelect.addEventListener('change', () => {
    const v = String(modeSelect.value || '').toLowerCase();
    if (v) currentMode = v;
    syncEffectGroupDisabled();
  });
}

// Exact toggle wiring
if (exactToggle) {
  exactMode = !!exactToggle.checked;
  exactToggle.addEventListener('change', () => {
    exactMode = !!exactToggle.checked;
    updateFilterCutoff();
    connectGraph();
    updateStatus(exactMode ? 'exact mode on' : 'exact mode off');
  });
}

// Oscilloscope controls wiring
if (oscDelayEl) {
  oscDelayVal = parseInt(oscDelayEl.value, 10) || 25;
  oscDelayEl.addEventListener('input', () => {
    const v = parseInt(oscDelayEl.value, 10);
    if (!Number.isNaN(v)) oscDelayVal = v;
  });
}
if (oscPersistEl) {
  oscPersistVal = parseInt(oscPersistEl.value, 10) || 28;
  oscPersistEl.addEventListener('input', () => {
    const v = parseInt(oscPersistEl.value, 10);
    if (!Number.isNaN(v)) oscPersistVal = v;
  });
}
if (oscThickEl) {
  oscThickVal = parseFloat(oscThickEl.value) || 1.6;
  oscThickEl.addEventListener('input', () => {
    const v = parseFloat(oscThickEl.value);
    if (!Number.isNaN(v)) oscThickVal = v;
  });
}
if (oscSquareEl) {
  oscSquare = !!oscSquareEl.checked;
  oscSquareEl.addEventListener('change', () => {
    oscSquare = !!oscSquareEl.checked;
  });
}

// Wave color wiring
function clamp255(n){ return Math.max(0, Math.min(255, n|0)); }
if (waveREl && waveGEl && waveBEl) {
  waveColor.r = clamp255(parseInt(waveREl.value, 10) || 57);
  waveColor.g = clamp255(parseInt(waveGEl.value, 10) || 255);
  waveColor.b = clamp255(parseInt(waveBEl.value, 10) || 20);
  updateWaveSwatch();
  const onWaveColor = () => {
    waveColor.r = clamp255(parseInt(waveREl.value, 10));
    waveColor.g = clamp255(parseInt(waveGEl.value, 10));
    waveColor.b = clamp255(parseInt(waveBEl.value, 10));
    updateWaveSwatch();
  };
  waveREl.addEventListener('input', onWaveColor);
  waveGEl.addEventListener('input', onWaveColor);
  waveBEl.addEventListener('input', onWaveColor);
}

// Spectrogram controls wiring
if (specContrastEl) {
  const v = parseFloat(specContrastEl.value);
  if (!Number.isNaN(v)) specContrastVal = v;
  specContrastEl.addEventListener('input', () => {
    const vv = parseFloat(specContrastEl.value);
    if (!Number.isNaN(vv)) specContrastVal = vv;
  });
}
if (specBrightnessEl) {
  const v = parseFloat(specBrightnessEl.value);
  if (!Number.isNaN(v)) specBrightnessVal = v;
  specBrightnessEl.addEventListener('input', () => {
    const vv = parseFloat(specBrightnessEl.value);
    if (!Number.isNaN(vv)) specBrightnessVal = vv;
  });
}

// Volume slider wiring
if (volumeSlider) {
  // init desired volume
  const iv = parseFloat(volumeSlider.value);
  if (!Number.isNaN(iv)) desiredVolume = iv;
  volumeSlider.addEventListener('input', () => {
    const v = parseFloat(volumeSlider.value);
    if (!Number.isNaN(v)) {
      desiredVolume = v;
      if (masterGain) masterGain.gain.value = v;
    }
  });
}

// View toggles wiring
function setPanelVisible(panel, visible) {
  if (!panel) return;
  panel.style.display = visible ? '' : 'none';
}

if (viewWaveCb) {
  setPanelVisible(panelWave, viewWaveCb.checked);
  viewWaveCb.addEventListener('change', () => setPanelVisible(panelWave, viewWaveCb.checked));
}
if (viewSpecCb) {
  setPanelVisible(panelSpec, viewSpecCb.checked);
  viewSpecCb.addEventListener('change', () => setPanelVisible(panelSpec, viewSpecCb.checked));
}
if (viewHarmCb) {
  setPanelVisible(panelHarm, viewHarmCb.checked);
  viewHarmCb.addEventListener('change', () => setPanelVisible(panelHarm, viewHarmCb.checked));
}

// Capture Oscilloscope image -> clipboard or PNG download
if (captureOscBtn) {
  captureOscBtn.addEventListener('click', async () => {
    try {
      if (!harmCanvas) return;
      // ensure there is some content; if panel hidden, make a note
      if (panelHarm && panelHarm.style.display === 'none') {
        updateStatus('Oscilloscope is hidden — showing it helps capture');
      }
      await new Promise((r) => setTimeout(r, 16)); // let one frame render

      // Build a transparent version by removing the background color
      const w = harmCanvas.width, h = harmCanvas.height;
      const srcCtx = harmCanvas.getContext('2d');
      const img = srcCtx.getImageData(0, 0, w, h);

      // Estimate background color by averaging the four corners
      const idx = (x, y) => 4 * (y * w + x);
      const samples = [
        idx(0, 0), idx(w - 1, 0), idx(0, h - 1), idx(w - 1, h - 1),
      ];
      let r = 0, g = 0, b = 0;
      for (const i of samples) { r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; }
      r = Math.round(r / samples.length);
      g = Math.round(g / samples.length);
      b = Math.round(b / samples.length);

      // Zero alpha where pixel is close to background (tolerance)
      const tol = 8; // tweak if needed
      for (let i = 0; i < img.data.length; i += 4) {
        const dr = img.data[i] - r;
        const dg = img.data[i + 1] - g;
        const db = img.data[i + 2] - b;
        const isBg = Math.abs(dr) <= tol && Math.abs(dg) <= tol && Math.abs(db) <= tol;
        if (isBg) img.data[i + 3] = 0;
      }

      // Additional mask: keep only bright-green dominant pixels (scope trace), drop crosshair/grid
      for (let i = 0; i < img.data.length; i += 4) {
        const R = img.data[i], G = img.data[i + 1], B = img.data[i + 2];
        if (img.data[i + 3] === 0) continue; // already background
        const gDom = G - Math.max(R, B); // green dominance
        // keep only strongly green pixels; otherwise make transparent
        if (gDom < 20 || G < 40) {
          img.data[i + 3] = 0;
        }
      }

      // Put into a transparent offscreen canvas
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const octx = out.getContext('2d');
      octx.putImageData(img, 0, 0);

      out.toBlob(async (blob) => {
        if (!blob) return;
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            updateStatus('Oscilloscope copied to clipboard');
            return;
          }
        } catch (_) { /* fallback to download */ }

        const url = URL.createObjectURL(blob);
        const ts = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const fname = `ByteLab_scope_osc_${ts.getFullYear()}-${pad(ts.getMonth()+1)}-${pad(ts.getDate())}_${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}.png`;
        const a = document.createElement('a');
        a.href = url; a.download = fname; a.click();
        URL.revokeObjectURL(url);
        updateStatus('Oscilloscope saved as PNG');
      }, 'image/png');
    } catch (e) {
      updateStatus('capture failed');
      console.error('Capture scope failed:', e);
    }
  });
}

// ---- MP3 -> Byte array (0..255) converter ----
async function decodeMp3ArrayBufferToPCM(ab) {
  // Use a temporary AudioContext to decode MP3
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuf = await ctx.decodeAudioData(ab);
    const rate = audioBuf.sampleRate;
    const chs = audioBuf.numberOfChannels;
    if (chs <= 1) {
      return { pcm: audioBuf.getChannelData(0), sampleRate: rate };
    }
    // Average all channels to mono for consistent bytebeat usage
    const len = audioBuf.length;
    const out = new Float32Array(len);
    for (let c = 0; c < chs; c++) {
      const ch = audioBuf.getChannelData(c);
      for (let i = 0; i < len; i++) out[i] += ch[i];
    }
    const inv = 1 / chs;
    for (let i = 0; i < len; i++) out[i] *= inv;
    return { pcm: out, sampleRate: rate };
  } finally {
    try { await ctx.close(); } catch (_) {}
  }
}

function resampleMonoFloat32(src, srcRate, dstRate, nearest = false) {
  if (srcRate === dstRate) return src.slice();
  const dur = src.length / srcRate;
  const dstLen = Math.max(1, Math.floor(dur * dstRate));
  const out = new Float32Array(dstLen);
  const ratio = srcRate / dstRate;
  if (nearest) {
    for (let i = 0; i < dstLen; i++) {
      const srcPos = Math.round(i * ratio);
      const idx = Math.max(0, Math.min(src.length - 1, srcPos));
      out[i] = Math.max(-1, Math.min(1, src[idx]));
    }
  } else {
    for (let i = 0; i < dstLen; i++) {
      const srcPos = i * ratio;
      const i0 = Math.floor(srcPos);
      const i1 = Math.min(src.length - 1, i0 + 1);
      const frac = srcPos - i0;
      const s = src[i0] * (1 - frac) + src[i1] * frac;
      out[i] = Math.max(-1, Math.min(1, s));
    }
  }
  return out;
}

function floatToU8(float32) {
  const N = float32.length;
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    // map -1..1 -> 0..255
    let s = float32[i];
    if (!Number.isFinite(s)) s = 0;
    const u = Math.max(0, Math.min(255, Math.round((s * 0.5 + 0.5) * 255)));
    out[i] = u;
  }
  return out;
}

function simplifyU8(bytes, maxSamples = 500000) {
  // Crop to preserve original values and timing; no averaging to avoid timbre changes
  if (bytes.length <= maxSamples) return bytes;
  return bytes.slice(0, maxSamples);
}

async function handleMp3File(file) {
  try {
    updateStatus('Decoding MP3…');
    const ab = await file.arrayBuffer();
    const { pcm, sampleRate } = await decodeMp3ArrayBufferToPCM(ab);
    const targetRate = Math.max(1, bbSampleRate | 0);
    updateStatus(`Resampling to ${targetRate} Hz…`);
    const nearest = exactMode || currentMode === 'byte' || currentMode === 'signed';
    const resampled = resampleMonoFloat32(pcm, sampleRate, targetRate, nearest);
    const rawBytes = floatToU8(resampled);
    const bytes = simplifyU8(rawBytes, 500000); // cap to keep things light
    // Store globally to avoid bloating the editor or clipboard
    window.byteBuffer = bytes;
    // Choose a snippet that matches the current mode for faithful playback
    let snippet;
    switch (currentMode) {
      case 'byte':
        // Return 0..255 directly; engine maps to audio
        snippet = 'window.byteBuffer&&window.byteBuffer.length?window.byteBuffer[t%window.byteBuffer.length]:0';
        break;
      case 'signed':
        // Return -128..127 for signed bytebeat
        snippet = 'window.byteBuffer&&window.byteBuffer.length?(window.byteBuffer[t%window.byteBuffer.length]-128):0';
        break;
      case 'float':
      case 'func':
      default:
        // Normalized float in [-1,1]
        snippet = '(t)=>{const b=window.byteBuffer;return (!b||!b.length)?0:((b[t%b.length]-128)/128)}';
        break;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(snippet);
    } else {
      const ta = document.createElement('textarea');
      ta.value = snippet; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    const simplifiedMsg = rawBytes.length !== bytes.length ? ` (cropped from ${rawBytes.length})` : '';
    updateStatus(`Loaded ${bytes.length} samples into window.byteBuffer${simplifiedMsg}. Snippet copied for mode "${currentMode}".`);
  } catch (e) {
    console.error(e);
    updateStatus('MP3 convert failed');
  }
}

if (uploadMp3Btn && mp3FileInput) {
  uploadMp3Btn.addEventListener('click', () => {
    mp3FileInput.value = '';
    mp3FileInput.click();
  });
  mp3FileInput.addEventListener('change', async () => {
    const f = mp3FileInput.files && mp3FileInput.files[0];
    if (!f) return;
    await handleMp3File(f);
  });
}

function safeDisconnect(node) { try { node.disconnect(); } catch (_) {} }

function connectGraph() {
  if (!processor || !masterGain) return;
  // clear existing
  try {
    safeDisconnect(processor);
    if (lowpass) safeDisconnect(lowpass);
    safeDisconnect(masterGain);
  } catch (_) {}
  if (exactMode || !lowpass) {
    // Bypass filter for exact reproduction
    processor.connect(masterGain);
  } else {
    processor.connect(lowpass);
    lowpass.connect(masterGain);
  }
  masterGain.connect(audioCtx.destination);
  if (analyser) masterGain.connect(analyser);
}

function applyEffectSample(x) {
  switch (effectType) {
    case 'distortion': {
      // Map drive 0..1 -> gain 1..20
      const gain = 1 + drive * 19;
      return Math.tanh(x * gain);
    }
    case 'bitcrusher': {
      const bits = Math.max(1, Math.min(24, crushBits|0));
      const step = 1 / (Math.pow(2, bits - 1));
      if (dsCounter <= 0) {
        // quantize current sample and hold
        heldSample = Math.round(x / step) * step;
        dsCounter = Math.max(1, downsample|0);
      }
      dsCounter--;
      return heldSample;
    }
    case 'none':
    default:
      return x;
  }
}

// Effect controls wiring
if (effectSelect) {
  const v = String(effectSelect.value || 'none');
  effectType = v;
  effectSelect.addEventListener('change', () => {
    effectType = String(effectSelect.value || 'none');
  });
}
if (driveSlider) {
  const v = parseFloat(driveSlider.value);
  if (!Number.isNaN(v)) drive = Math.max(0, Math.min(1, v));
  driveSlider.addEventListener('input', () => {
    const vv = parseFloat(driveSlider.value);
    if (!Number.isNaN(vv)) drive = Math.max(0, Math.min(1, vv));
  });
}
if (bitsSlider) {
  const v = parseInt(bitsSlider.value, 10);
  if (!Number.isNaN(v)) crushBits = v;
  bitsSlider.addEventListener('input', () => {
    const vv = parseInt(bitsSlider.value, 10);
    if (!Number.isNaN(vv)) crushBits = vv;
  });
}
if (downsampleSlider) {
  const v = parseInt(downsampleSlider.value, 10);
  if (!Number.isNaN(v)) downsample = v;
  downsampleSlider.addEventListener('input', () => {
    const vv = parseInt(downsampleSlider.value, 10);
    if (!Number.isNaN(vv)) downsample = vv;
  });
}

// Enable/disable effect controls based on mode
function syncEffectGroupDisabled() {
  const group = document.getElementById('effectGroup');
  const controls = [effectSelect, driveSlider, bitsSlider, downsampleSlider];
  const disabled = currentMode === 'float' || currentMode === 'func';
  if (group) {
    if (disabled) group.classList.add('disabled'); else group.classList.remove('disabled');
  }
  for (const el of controls) {
    if (el) el.disabled = disabled;
  }
}

// ----- Settings: persistence and modal -----
const SETTINGS_KEY = 'bytebeat.settings.v1';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}
function saveSettings(obj) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj)); } catch (_) {}
}
function applySettings(obj) {
  if (!obj) return;
  // Panel visibility
  if (typeof obj.showWave === 'boolean' && viewWaveCb) {
    viewWaveCb.checked = obj.showWave; setPanelVisible(panelWave, obj.showWave);
  }
  if (typeof obj.showSpec === 'boolean' && viewSpecCb) {
    viewSpecCb.checked = obj.showSpec; setPanelVisible(panelSpec, obj.showSpec);
  }
  if (typeof obj.showHarm === 'boolean' && viewHarmCb) {
    viewHarmCb.checked = obj.showHarm; setPanelVisible(panelHarm, obj.showHarm);
  }
  // Square aspect
  if (typeof obj.squareAspect === 'boolean' && oscSquareEl) {
    oscSquareEl.checked = obj.squareAspect; oscSquare = obj.squareAspect;
  }
}
function prefillSettingsModalFromCurrent() {
  if (!settingsModal) return;
  if (setShowWave && viewWaveCb) setShowWave.checked = !!viewWaveCb.checked;
  if (setShowSpec && viewSpecCb) setShowSpec.checked = !!viewSpecCb.checked;
  if (setShowHarm && viewHarmCb) setShowHarm.checked = !!viewHarmCb.checked;
  if (setSquareAspect && oscSquareEl) setSquareAspect.checked = !!oscSquareEl.checked;
}
function showSettings() {
  prefillSettingsModalFromCurrent();
  settingsModal?.classList.add('show');
}
function hideSettings() {
  settingsModal?.classList.remove('show');
}
// Wire modal buttons
openSettingsBtn?.addEventListener('click', showSettings);
closeSettingsBtn?.addEventListener('click', hideSettings);
cancelSettingsBtn?.addEventListener('click', hideSettings);
settingsModal?.addEventListener('click', (e) => {
  if (e.target === settingsModal) hideSettings();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideSettings();
});
saveSettingsBtn?.addEventListener('click', () => {
  const obj = {
    showWave: !!setShowWave?.checked,
    showSpec: !!setShowSpec?.checked,
    showHarm: !!setShowHarm?.checked,
    squareAspect: !!setSquareAspect?.checked,
  };
  saveSettings(obj);
  applySettings(obj);
  hideSettings();
  updateStatus('settings saved');
});

// Load and apply saved settings on startup
applySettings(loadSettings());
