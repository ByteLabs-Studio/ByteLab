const playButton = document.getElementById('play');
const pauseButton = document.getElementById('pause');
const stopButton = document.getElementById('stop');
const tempoSelect = document.getElementById('tempoSelect');
const hzSelect = document.getElementById('hzSelect');
const modeSelect = document.getElementById('modeSelect');
const syntaxThemeSel = document.getElementById('syntaxTheme');
const syntaxThemeLink = document.getElementById('syntaxThemeLink');
const volumeSlider = document.getElementById('volumeSlider');
const viewWaveCb = document.getElementById('viewWave');
const viewSpecCb = document.getElementById('viewSpec');
const viewHarmCb = document.getElementById('viewHarm');
const panelWave = document.getElementById('panelWave');
const panelSpec = document.getElementById('panelSpec');
const panelHarm = document.getElementById('panelHarm');
const editorEl = document.getElementById('editor');
const statusEl = document.getElementById('status');
const statusBox = document.getElementById('statusBox');
const waveCanvas = document.getElementById('waveCanvas');
const specCanvas = document.getElementById('specCanvas');
const harmCanvas = document.getElementById('harmCanvas');
const errorBox = document.getElementById('errorBox');
const captureOscBtn = document.getElementById('captureOsc');
const uploadMp3Btn = document.getElementById('uploadMp3');
const mp3FileInput = document.getElementById('mp3FileInput');
const exactToggle = document.getElementById('exactToggle');
const lintToggle = document.getElementById('lintToggle');
let lintEnabled = false;
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
let AceRange = null;
let errorMarkerId = null;

// Settings modal elements
const openSettingsBtn = document.getElementById('openSettings');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const cancelSettingsBtn = document.getElementById('cancelSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const applySettingsBtn = document.getElementById('applySettings');
const setShowWave = document.getElementById('setShowWave');
const setShowSpec = document.getElementById('setShowSpec');
const setShowHarm = document.getElementById('setShowHarm');
const setSquareAspect = document.getElementById('setSquareAspect');
const setHideDisabled = document.getElementById('setHideDisabled');
const tabAppearance = document.getElementById('tabAppearance');
const tabGeneral = document.getElementById('tabGeneral');
const tabAccessibility = document.getElementById('tabAccessibility');
const tabAudio = document.getElementById('tabAudio');
const paneAppearance = document.getElementById('paneAppearance');
const paneGeneral = document.getElementById('paneGeneral');
const paneAccessibility = document.getElementById('paneAccessibility');
const paneAudio = document.getElementById('paneAudio');
const themeSelect = document.getElementById('themeSelect');
const uiScale = document.getElementById('uiScale');
const defaultModeSel = document.getElementById('defaultMode');
const defaultHzSel = document.getElementById('defaultHz');

// Utilities group buttons
const muteBtn = document.getElementById('mute');
const resetAudioBtn = document.getElementById('resetAudio');
const copyCodeBtn = document.getElementById('copyCode');
const randomColorBtn = document.getElementById('randomColor');
const clearEditorBtn = document.getElementById('clearEditor');

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
let bbSampleRate = 8000;
let tempoFactor = 1;
let vizRAF = 0;
let vizResizeHandler = null;
let desiredVolume = 0.8;
let lastNonZeroVol = 0.8;
let muted = false;
let currentMode = 'float';
let exactMode = false;
// Program mode display buffer (updated when user code throws display strings)
window._programDisplay = '';
// Oscilloscope state
let oscDelayVal = 25;
let oscPersistVal = 28;
let oscThickVal = 1.6;
let oscSquare = true;
// Wave/Spectrogram state
let waveColor = { r: 57, g: 255, b: 20 }; // default neon green
let specContrastVal = 1.0;
let specBrightnessVal = 0.2;
// Effect state
let effectType = 'none';
let drive = 0.5;
let crushBits = 8;
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
  if (statusBox) {
    statusBox.textContent = text;
    statusBox.classList.add('show');
    clearTimeout(statusHideTimer);
    statusHideTimer = setTimeout(() => {
      statusBox.classList.remove('show');
    }, 2500);
  }
}

let statusHideTimer = 0;

function showError(message) {
  if (!errorBox) return;
  if (!lintEnabled) return; // suppress UI errors when linting is off
  errorBox.textContent = message;
  errorBox.classList.add('show');
}

function clearError() {
  if (!errorBox) return;
  errorBox.classList.remove('show');
  // also clear any markers/annotations
  try {
    if (aceEditor) {
      if (errorMarkerId != null) {
        aceEditor.getSession().removeMarker(errorMarkerId);
        errorMarkerId = null;
      }
      aceEditor.getSession().clearAnnotations();
    }
  } catch (_) {}
}

function parseLineColFromStack(err) {
  const s = String(err && err.stack || '');
  const m = s.match(/anonymous:(\d+):(\d+)/) || s.match(/<anonymous>:(\d+):(\d+)/);
  if (m) return { line: parseInt(m[1], 10), column: parseInt(m[2], 10) };
  return null;
}

function tokenAt(lineText, col) {
  const i = Math.max(0, Math.min(lineText.length, (col|0) - 1));
  // Expand to a wordish token or single punctuator
  const isWord = /[\w$]/;
  if (isWord.test(lineText[i])) {
    let s = i, e = i;
    while (s > 0 && isWord.test(lineText[s-1])) s--;
    while (e < lineText.length && isWord.test(lineText[e])) e++;
    return { token: lineText.slice(s, e), start: s, end: e };
  }
  return { token: lineText[i] || '', start: i, end: Math.min(i+1, lineText.length) };
}

function hintFor(errorMsg, tk, mode) {
  const m = String(errorMsg || '').toLowerCase();
  const t = String(tk || '').toLowerCase();
  // Common helpful hints
  if (/unexpected identifier/.test(m) && (t === 'let' || t === 'const' || t === 'function')) {
    return 'Hint: Declare variables/functions in Mode "Program", or convert to an expression.';
  }
  if (/unexpected token/.test(m) && /;/.test(errorMsg || '') && mode !== 'program') {
    return 'Hint: Remove trailing semicolons in expression modes or switch Mode to "Program".';
  }
  if (/is not defined/.test(m)) {
    return 'Hint: Define the variable first (Program mode) or use a literal/Math expression.';
  }
  if (/return/.test(m) && mode === 'program') {
    return 'Hint: Define a global function main(sr) and return a value per tick.';
  }
  return '';
}

function underlineInAce(row, startCol, endCol, type='ace_error-marker') {
  if (!aceEditor || !AceRange || !lintEnabled) return;
  try {
    if (errorMarkerId != null) {
      aceEditor.getSession().removeMarker(errorMarkerId);
    }
    const range = new AceRange(row, startCol, row, Math.max(startCol+1, endCol));
    errorMarkerId = aceEditor.getSession().addMarker(range, type, 'text', true);
  } catch (_) {}
}

function reportCompileError(e, srcText, mode, lineAdjust) {
  const lc = parseLineColFromStack(e);
  if (!lintEnabled) return; // UI suppressed
  if (lc) {
    const userLine = Math.max(1, lc.line - (lineAdjust|0));
    const row = Math.max(0, userLine - 1);
    const col = Math.max(1, lc.column|0);
    const lines = String(srcText||'').split(/\n/);
    const lineText = lines[row] ?? '';
    const { token, start, end } = tokenAt(lineText, col);
    const baseMsg = e.message;
    const hint = hintFor(baseMsg, token, mode);
    const caretLine = `${lineText}`;
    const caret = `${' '.repeat(Math.max(0, start))}${'^'.repeat(Math.max(1, end-start))}`;
    const msg = `${baseMsg}${token ? ` near '${token}'` : ''} (line ${userLine}, col ${col}).${hint ? ' ' + hint : ''}\n${caretLine}\n${caret}`;
    showError(`compilation error: ${msg}`);
    try {
      aceEditor?.getSession()?.setAnnotations([
        { row, column: Math.max(0, col - 1), text: baseMsg, type: 'error' }
      ]);
    } catch (_) {}
    underlineInAce(row, start, end);
  } else {
    showError(`compilation error: ${e.message}`);
  }
}

function createExprFunc(exprText) {
  // Attempt 1: treat as a pure expression (strip trailing semicolons which cause "Unexpected token ';'")
  const exprTrim = (exprText || '').trim().replace(/;+\s*$/g, '');
  const compileAsExpression = () => new Function(
    't',
    'abs','sin','cos','tan','asin','acos','atan','atan2',
    'log','log2','exp','sqrt','cbrt','pow','hypot',
    'floor','ceil','round','trunc','sign',
    'min','max','random','isNaN','PI','E','int',
    `return (\n${exprTrim}\n);`
  );

  // Attempt 2: arrow function, e.g. "t => ..." or "(t)=>{...}"
  const compileAsArrow = () => {
    const maybeFn = Function(`return (${exprText})`)();
    if (typeof maybeFn !== 'function') throw new Error('Not an arrow function');
    return function ArrowCaller(t) { return maybeFn(t); };
  };

  // Attempt 3: statements – return last assigned variable if any; otherwise look for __ret
  const compileAsStatements = () => new Function(
    't',
    'abs','sin','cos','tan','asin','acos','atan','atan2',
    'log','log2','exp','sqrt','cbrt','pow','hypot',
    'floor','ceil','round','trunc','sign',
    'min','max','random','isNaN','PI','E','int',
    // Note: no strict mode here to allow legacy octal literals users may paste
    // expose Math helpers via local consts for convenience (already passed as params)
    `let __ret;\n` +
    `${exprText}\n` +
    // Try to infer last assigned identifier to return
    `let __lastLine = (${JSON.stringify(exprText)}).trim().split(/\n/).filter(l=>l.trim()).slice(-1)[0]||'';\n` +
    `let __m = __lastLine.match(/^\s*([\w$]+)\s*=.*;?\s*$/);\n` +
    `let __name = __m ? __m[1] : '__ret';\n` +
    `return (typeof eval(__name) !== 'undefined' ? eval(__name) : (typeof __ret !== 'undefined' ? __ret : 0));`
  );

  let factory;
  let mode = 'expr';
  try {
    factory = compileAsExpression();
  } catch (e1) {
    try {
      const arrowCaller = compileAsArrow();
      // Wrap the arrow caller in the same signature as expression functions
      return (tt) => arrowCaller(tt);
    } catch (e2) {
      try {
        factory = compileAsStatements();
        mode = 'stmts';
      } catch (e3) {
        const e = e3 || e2 || e1;
        reportCompileError(e, exprText, 'expr', 1);
        throw e;
      }
    }
  }

  // Return a runner that calls the compiled function with math intrinsics
  return (tt) => factory(
    tt,
    Math.abs, Math.sin, Math.cos, Math.tan, Math.asin, Math.acos, Math.atan, Math.atan2,
    Math.log, Math.log2, Math.exp, Math.sqrt, Math.cbrt, Math.pow, Math.hypot,
    Math.floor, Math.ceil, Math.round, Math.trunc, Math.sign,
    Math.min, Math.max, Math.random, isNaN, Math.PI, Math.E, Math.floor
  );
}

function createProgramFunc(programText, srSel) {
  const wrapped = `// ByteLab Program wrapper (non-strict to permit legacy octal literals)\nvar t = 0;\nvar sr = ${Number(srSel)||8000};\ntry {\n${programText}\n} catch (e) { /* allow definitions requiring t on first call */ }\nreturn function (__tt__) {\n  t = __tt__|0;\n  try {\n    // main() should be defined by the user program\n    var v = (typeof main === 'function') ? main(sr) : 0;\n    v = Number(v);\n    if (!Number.isFinite(v)) v = 0;\n    return Math.max(-1, Math.min(1, v));\n  } catch (e) {\n    // If user program uses throw display pattern, relay to UI\n    if (typeof e === 'string') { window._programDisplay = e; return 0; }\n    return 0;\n  }\n};`;
  try {
    const boot = new Function(
      // Provide common math aliases and helpers to the user program scope
      'abs','sin','cos','tan','asin','acos','atan','atan2',
      'log','log2','exp','sqrt','cbrt','pow','hypot',
      'floor','ceil','round','trunc','sign',
      'min','max','random','PI','E','int',
      wrapped
    );
    const int = (x) => Math.floor(x);
    const tick = boot(
      Math.abs, Math.sin, Math.cos, Math.tan, Math.asin, Math.acos, Math.atan, Math.atan2,
      Math.log, Math.log2, Math.exp, Math.sqrt, Math.cbrt, Math.pow, Math.hypot,
      Math.floor, Math.ceil, Math.round, Math.trunc, Math.sign,
      Math.min, Math.max, Math.random, Math.PI, Math.E, int
    );
    if (typeof tick !== 'function') throw new Error('Program must define main(sr)');
    return (tt) => tick(tt);
  } catch (e) {
    reportCompileError(e, programText, 'program', 0);
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
  let lastKind = 'float';
  let acc = 0;
  let interpPrev = 0;
  let interpNext = 0;
  let interpInit = false;

  processor.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
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
            case 'program': {
              let fv = Number(v);
              if (!Number.isFinite(fv)) fv = 0;
              const computed = Math.max(-1, Math.min(1, fv));
              interpPrev = interpNext; interpNext = computed; interpInit = true;
              lastSample = computed;
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
      let s;
      if (currentMode === 'float' || currentMode === 'program') {
        // Floatbeat always interpolates to reduce stair-stepping, hopefully I simulated this correctly
        s = interpInit ? (interpPrev + (interpNext - interpPrev) * acc) : lastSample;
      } else if (currentMode === 'func') {
        // Funcbeat: interpolate only for float outputs; for integer-style, keep steps
        if (lastKind === 'float') {
          s = interpInit ? (interpPrev + (interpNext - interpPrev) * acc) : lastSample;
        } else {
          s = lastSample;
          if (!exactMode) s = Math.tanh(s * 1.5); // should be the same gentle saturation behavior as byte/signed
        }
      } else {
        s = lastSample;
        if (!exactMode) s = Math.tanh(s * 1.5); // gentle saturation for non-exact byte/signed
      }

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
    exprFunc = (currentMode === 'program') ? createProgramFunc(exprText, bbSampleRate) : createExprFunc(exprText);
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
    scrollPastEnd: 0,
  }); 
  aceEditor.renderer.setScrollMargin(0, 0, 0, 0);
  const resizeEditorToContent = () => {
    if (!aceEditor || !editorEl) return;
    const lh = aceEditor.renderer.lineHeight || 16;
    const screenLen = aceEditor.getSession().getScreenLength();
    const lines = Math.max(1, screenLen); 
    const padding = 12; 
    const minH = 80;
    // Cap editor height to half the viewport to avoid compressing status/error bars
    const maxH = Math.floor(window.innerHeight * 0.5); 
    const target = Math.min(maxH, Math.max(minH, Math.round(lines * lh + padding)));
    editorEl.style.height = target + 'px';
    aceEditor.resize();
  };
  setTimeout(resizeEditorToContent, 0);
  try {
    exprFunc = (currentMode === 'program') ? createProgramFunc(getExpr(), bbSampleRate) : createExprFunc(getExpr());
    clearError();
    aceEditor.getSession().clearAnnotations();
  } catch (_) { /* shown already */ }

  let lastGoodFunc = null;
  let compileTimer = 0;
  aceEditor.session.on('change', () => {
    // Debounce to avoid transient errors while pasting/replacing, originally showed an error for a split second when overwriting an expression
    clearTimeout(compileTimer);
    compileTimer = setTimeout(() => {
      const txt = getExpr();
      try {
        const compiled = (currentMode === 'program') ? createProgramFunc(txt, bbSampleRate) : createExprFunc(txt);
        lastGoodFunc = compiled;
        exprFunc = compiled;
        clearError();
        aceEditor.getSession().clearAnnotations();
        if (isPlaying && !isPaused) updateStatus('playing • updated');
        else if (isPaused) updateStatus('paused • updated');
      } catch (_) {
        // Suppress status message on error to avoid flicker
      }
      resizeEditorToContent();
    }, 10);
  });
  window.addEventListener('resize', resizeEditorToContent);
  try { AceRange = window.ace?.require('ace/range').Range || null; } catch (_) { AceRange = null; }
}

function getExpr() {
  return aceEditor?.getValue()?.trim() || '';
}

initAce();

function setupCanvas(canvas) {
  if (!canvas) return { ctx: null, w: 0, h: 0 };
  const dpr = window.devicePixelRatio || 1;
  const zoom = getUiZoom();
  const rect = canvas.getBoundingClientRect();
  // rect.* are in post-zoom CSS pixels; convert back to pre-zoom logical CSS units for stable logic
  const logicalW = rect.width / zoom;
  const logicalH = rect.height / zoom;
  const pxw = Math.max(1, Math.floor(logicalW * dpr));
  const pxh = Math.max(1, Math.floor(logicalH * dpr));
  canvas.width = pxw;
  canvas.height = pxh;
  const ctx = canvas.getContext('2d');
  // Compensate for zoom so drawing uses logical CSS units regardless of zoom
  ctx.setTransform(dpr / zoom, 0, 0, dpr / zoom, 0, 0);
  return { ctx, w: logicalW, h: logicalH, pxw, pxh, dpr };
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
      } else {
        analyser.getByteTimeDomainData(timeData);
        wctx.clearRect(0, 0, ww, wh);
        wctx.fillStyle = bgWave;
        wctx.fillRect(0, 0, ww, wh);
        // Draw filled waveform using min/max vertical bars per pixel column
        const step = timeData.length / ww;
        wctx.fillStyle = line; /* keep same color, maybe I will do this for the spectrogram too, not sure yet since the spectrogram colors are based on the frequency,
                              so I would need to calculate the average frequency for each column and then apply the same color */
        for (let x = 0; x < ww; x++) {
          const i0 = Math.floor(x * step);
          const i1 = Math.floor((x + 1) * step);
          let lo = 255, hi = 0;
          for (let i = i0; i < i1; i++) {
            const v = timeData[i] | 0;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
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
      } else {
        const Wfull = hpw || harmCanvas.clientWidth || 0;
        const Hfull = hph || harmCanvas.clientHeight || 0;
        const fadeAlpha = 0.5 - 0.45 * Math.max(0, Math.min(100, oscPersistVal)) / 100;
        hctx.save();
        hctx.globalCompositeOperation = 'source-over';
        hctx.fillStyle = `rgba(11,10,18,${fadeAlpha.toFixed(3)})`;
        hctx.fillRect(0, 0, Wfull, Hfull);

        // crosshair, I might make this configurable, or make it a toggleable feature
        hctx.strokeStyle = harmGrid;
        hctx.lineWidth = 1;
        hctx.beginPath();
        hctx.moveTo(0.5, Math.floor(Hfull/2)+0.5); hctx.lineTo(Wfull-0.5, Math.floor(Hfull/2)+0.5);
        hctx.moveTo(Math.floor(Wfull/2)+0.5, 0.5); hctx.lineTo(Math.floor(Wfull/2)+0.5, Hfull-0.5);
        hctx.stroke();

        // fetch time-domain data
        analyser.getByteTimeDomainData(timeData);
        const N = timeData.length;
        const delayRatio = Math.max(0, Math.min(100, oscDelayVal)) / 200; // 0..0.5
        const lag = Math.max(1, Math.floor(N * delayRatio));

        const L = oscSquare ? Math.min(Wfull, Hfull) : null;
        const W = oscSquare ? L : Wfull;
        const H = oscSquare ? L : Hfull;
        const offX = oscSquare ? Math.floor((Wfull - W)/2) : 0;
        const offY = oscSquare ? Math.floor((Hfull - H)/2) : 0;
        const pad = 10;
        const scaleX = (W/2 - pad);
        const scaleY = (H/2 - pad);

        line = rgbStr(waveColor);
        hctx.strokeStyle = line;
        hctx.shadowColor = line;
        hctx.shadowBlur = 12;
        hctx.lineWidth = oscThickVal;
        hctx.beginPath();
        const stride = 2;
        for (let i = 0; i < N - lag; i += stride) {
          const sY = (timeData[i] - 128) / 128;
          const sX = (timeData[i + lag] - 128) / 128;
          const x = offX + Math.floor(W/2 + sX * scaleX) + 0.5;
          const y = offY + Math.floor(H/2 - sY * scaleY) + 0.5;
          if (i === 0) hctx.moveTo(x, y); else hctx.lineTo(x, y);
        }
        hctx.stroke();
        hctx.restore();
      }
    }

    if (window._programDisplay) {
      if (statusBox) {
        statusBox.textContent = String(window._programDisplay);
        statusBox.classList.add('show');
      }
      window._programDisplay = '';
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
  const effRate = Math.max(1, bbSampleRate * tempoFactor);
  const nyq = Math.min(audioCtx.sampleRate * 0.49, effRate * 0.5);
  if (exactMode) {
    lowpass.frequency.value = 20000;
  } else {
    lowpass.frequency.value = Math.max(1000, Math.min(18000, nyq * 0.9));
  }
}

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
  const initialHz = parseInt(hzSelect.value, 10);
  if (!Number.isNaN(initialHz) && initialHz > 0) bbSampleRate = initialHz;
  updateFilterCutoff();
}

if (modeSelect) {
  const mv = String(modeSelect.value || '').toLowerCase();
  if (mv) currentMode = mv;
  syncEffectGroupDisabled();
  modeSelect.addEventListener('change', () => {
    const v = String(modeSelect.value || '').toLowerCase();
    if (v) currentMode = v;
    syncEffectGroupDisabled();
    try {
      const txt = getExpr();
      exprFunc = (currentMode === 'program') ? createProgramFunc(txt, bbSampleRate) : createExprFunc(txt);
      clearError();
      aceEditor?.getSession()?.clearAnnotations();
      if (isPlaying && !isPaused) updateStatus('playing • mode changed');
    } catch (_) { /* errors already surfaced */ }
  });
}

if (exactToggle) {
  exactMode = !!exactToggle.checked;
  exactToggle.addEventListener('change', () => {
    exactMode = !!exactToggle.checked;
    updateFilterCutoff();
    connectGraph();
    updateStatus(exactMode ? 'exact mode on' : 'exact mode off');
  });
}

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

if (volumeSlider) {
  const iv = parseFloat(volumeSlider.value);
  if (!Number.isNaN(iv)) desiredVolume = iv;
  if (muteBtn) {
    if (desiredVolume <= 0) { muted = true; muteBtn.textContent = 'Unmute'; }
    else { muted = false; muteBtn.textContent = 'Mute'; }
  }
  volumeSlider.addEventListener('input', () => {
    const v = parseFloat(volumeSlider.value);
    if (!Number.isNaN(v)) {
      desiredVolume = v;
      if (v > 0) lastNonZeroVol = v;
      if (masterGain) masterGain.gain.value = v;
      if (muteBtn) {
        if (v <= 0 && !muted) {
          muted = true;
          muteBtn.textContent = 'Unmute';
          updateStatus('muted');
        } else if (v > 0 && muted) {
          muted = false;
          muteBtn.textContent = 'Mute';
          updateStatus('unmuted');
        }
      }
    }
  });
}

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

if (captureOscBtn) {
  captureOscBtn.addEventListener('click', async () => {
    try {
      if (!harmCanvas) return;
      if (panelHarm && panelHarm.style.display === 'none') {
        updateStatus('Oscilloscope is hidden — showing it helps capture');
      }
      await new Promise((r) => setTimeout(r, 16));

      const w = harmCanvas.width, h = harmCanvas.height;
      const srcCtx = harmCanvas.getContext('2d');
      const img = srcCtx.getImageData(0, 0, w, h);

      const idx = (x, y) => 4 * (y * w + x);
      const samples = [
        idx(0, 0), idx(w - 1, 0), idx(0, h - 1), idx(w - 1, h - 1),
      ];
      let r = 0, g = 0, b = 0;
      for (const i of samples) { r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; }
      r = Math.round(r / samples.length);
      g = Math.round(g / samples.length);
      b = Math.round(b / samples.length);

      const tol = 8;
      for (let i = 0; i < img.data.length; i += 4) {
        const dr = img.data[i] - r;
        const dg = img.data[i + 1] - g;
        const db = img.data[i + 2] - b;
        const isBg = Math.abs(dr) <= tol && Math.abs(dg) <= tol && Math.abs(db) <= tol;
        if (isBg) img.data[i + 3] = 0;
      }

      for (let i = 0; i < img.data.length; i += 4) {
        const R = img.data[i], G = img.data[i + 1], B = img.data[i + 2];
        if (img.data[i + 3] === 0) continue;
        const gDom = G - Math.max(R, B);
        if (gDom < 20 || G < 40) {
          img.data[i + 3] = 0;
        }
      }

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

async function decodeMp3ArrayBufferToPCM(ab) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuf = await ctx.decodeAudioData(ab);
    const rate = audioBuf.sampleRate;
    const chs = audioBuf.numberOfChannels;
    if (chs <= 1) {
      return { pcm: audioBuf.getChannelData(0), sampleRate: rate };
    }
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
    const bytes = simplifyU8(rawBytes, 500000);
    window.byteBuffer = bytes;
    let snippet;
    switch (currentMode) {
      case 'byte':
        snippet = 'window.byteBuffer&&window.byteBuffer.length?window.byteBuffer[t%window.byteBuffer.length]:0';
        break;
      case 'signed':
        snippet = 'window.byteBuffer&&window.byteBuffer.length?(window.byteBuffer[t%window.byteBuffer.length]-128):0';
        break;
      case 'float':
      case 'func':
      default:
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
  try {
    safeDisconnect(processor);
    if (lowpass) safeDisconnect(lowpass);
    safeDisconnect(masterGain);
  } catch (_) {}
  if (exactMode || !lowpass) {
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
      const gain = 1 + drive * 19;
      return Math.tanh(x * gain);
    }
    case 'bitcrusher': {
      const bits = Math.max(1, Math.min(24, crushBits|0));
      const step = 1 / (Math.pow(2, bits - 1));
      if (dsCounter <= 0) {
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

function syncEffectGroupDisabled() {
  const group = document.getElementById('effectGroup');
  const controls = [effectSelect, driveSlider, bitsSlider, downsampleSlider];
  const disabled = currentMode === 'float' || currentMode === 'func' || currentMode === 'program';
  if (group) {
    if (disabled) group.classList.add('disabled'); else group.classList.remove('disabled');
  }
  for (const el of controls) {
    if (el) el.disabled = disabled;
  }
}

function setSyntaxStyles(syntaxChoice) {
  const uiTheme = document.documentElement.getAttribute('data-theme') || themeSelect?.value || '';
  let name = syntaxChoice || 'tomorrow-night';
  if (name === 'detect') name = uiTheme;
  const fileMap = {
    rose: 'rosepine',
  };
  const fileBase = fileMap[name] || name;
  if (!name || name === 'system' || name === 'tomorrow-night') {
    if (syntaxThemeLink) syntaxThemeLink.setAttribute('href', '');
    document.documentElement.setAttribute('data-syntax', 'tomorrow-night');
    return;
  }
  if (!syntaxThemeLink) return;
  syntaxThemeLink.onload = () => {
    document.documentElement.setAttribute('data-syntax', name);
  };
  syntaxThemeLink.onerror = () => {
    syntaxThemeLink.setAttribute('href', '');
    document.documentElement.setAttribute('data-syntax', 'tomorrow-night');
  };
  syntaxThemeLink.setAttribute('href', `themes/syntaxes/${fileBase}.css`);
}

if (lintToggle) {
  lintEnabled = !!lintToggle.checked;
  lintToggle.addEventListener('change', () => {
    lintEnabled = !!lintToggle.checked;
    if (!lintEnabled) {
      // Clear any visible diagnostics when turning lint off
      clearError();
      try { aceEditor?.getSession()?.clearAnnotations(); } catch (_) {}
      updateStatus('lint off');
    } else {
      updateStatus('lint on');
      // Optionally trigger a lint pass on enable
      try {
        const txt = getExpr();
        if (txt) {
          if (currentMode === 'program') createProgramFunc(txt, bbSampleRate); else createExprFunc(txt);
        } else {
          clearError();
          try { aceEditor?.getSession()?.clearAnnotations(); } catch (_) {}
        }
      } catch (_) { /* diagnostics already shown */ }
    }
  });
}

if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    if (!muted) {
      const v = parseFloat(volumeSlider?.value || '0.8');
      if (!Number.isNaN(v) && v > 0) lastNonZeroVol = v;
      if (volumeSlider) {
        volumeSlider.value = '0';
        volumeSlider.dispatchEvent(new Event('input'));
      }
      if (masterGain) masterGain.gain.value = 0;
      muted = true;
      muteBtn.textContent = 'Unmute';
      updateStatus('muted');
    } else {
      const v = Number.isFinite(lastNonZeroVol) ? lastNonZeroVol : 0.8;
      if (volumeSlider) {
        volumeSlider.value = String(v);
        volumeSlider.dispatchEvent(new Event('input'));
      }
      if (masterGain) masterGain.gain.value = v;
      muted = false;
      muteBtn.textContent = 'Mute';
      updateStatus('unmuted');
    }
  });
}

if (resetAudioBtn) {
  resetAudioBtn.addEventListener('click', () => {
    if (tempoSelect) { tempoSelect.value = '1'; tempoSelect.dispatchEvent(new Event('change')); }
    if (hzSelect) { hzSelect.value = '44100'; hzSelect.dispatchEvent(new Event('change')); }
    if (volumeSlider) { volumeSlider.value = '0.8'; volumeSlider.dispatchEvent(new Event('input')); }
    if (exactToggle) { exactToggle.checked = false; exactToggle.dispatchEvent(new Event('change')); }
    if (effectSelect) { effectSelect.value = 'none'; effectSelect.dispatchEvent(new Event('change')); }
    if (driveSlider) { driveSlider.value = '0.5'; driveSlider.dispatchEvent(new Event('input')); }
    if (bitsSlider) { bitsSlider.value = '8'; bitsSlider.dispatchEvent(new Event('input')); }
    if (downsampleSlider) { downsampleSlider.value = '2'; downsampleSlider.dispatchEvent(new Event('input')); }
    updateFilterCutoff();
    connectGraph();
    updateStatus('audio controls reset');
  });
}

if (copyCodeBtn) {
  copyCodeBtn.addEventListener('click', async () => {
    const txt = getExpr();
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(txt);
      else {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      updateStatus('code copied');
    } catch (e) {
      console.error('Copy failed', e);
      updateStatus('copy failed');
    }
  });
}

if (randomColorBtn) {
  randomColorBtn.addEventListener('click', () => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    if (waveREl) waveREl.value = String(r);
    if (waveGEl) waveGEl.value = String(g);
    if (waveBEl) waveBEl.value = String(b);
    waveColor = { r, g, b };
    updateWaveSwatch();
    updateStatus('color randomized');
  });
}

if (clearEditorBtn) {
  clearEditorBtn.addEventListener('click', () => {
    try { aceEditor?.setValue('', -1); } catch (_) {}
    updateStatus('editor cleared');
  });
}

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
  if (typeof obj.showWave === 'boolean' && viewWaveCb) {
    viewWaveCb.checked = obj.showWave; setPanelVisible(panelWave, obj.showWave);
  }
  if (typeof obj.showSpec === 'boolean' && viewSpecCb) {
    viewSpecCb.checked = obj.showSpec; setPanelVisible(panelSpec, obj.showSpec);
  }
  if (typeof obj.showHarm === 'boolean' && viewHarmCb) {
    viewHarmCb.checked = obj.showHarm; setPanelVisible(panelHarm, obj.showHarm);
  }
  if (typeof obj.squareAspect === 'boolean' && oscSquareEl) {
    oscSquareEl.checked = obj.squareAspect; oscSquare = obj.squareAspect;
  }
  if (typeof obj.hideDisabled === 'boolean') {
    if (obj.hideDisabled) document.documentElement.setAttribute('data-hide-disabled', '');
    else document.documentElement.removeAttribute('data-hide-disabled');
    if (setHideDisabled) setHideDisabled.checked = obj.hideDisabled;
  }
  if (typeof obj.theme === 'string') {
    document.documentElement.setAttribute('data-theme', obj.theme);
    if (themeSelect) themeSelect.value = obj.theme;
  }
  if (typeof obj.syntaxTheme === 'string') {
    if (syntaxThemeSel) syntaxThemeSel.value = obj.syntaxTheme;
    setSyntaxStyles(obj.syntaxTheme);
  }
  if (typeof obj.uiScale === 'number') {
    document.documentElement.style.zoom = String(obj.uiScale);
    // Expose ui scale to CSS so layout can compensate for zoom
    try { document.documentElement.style.setProperty('--ui-scale', String(obj.uiScale)); } catch (_) {}
    if (uiScale) uiScale.value = String(obj.uiScale);
    // Notify layout listeners so canvases and editor recompute sizes under new zoom
    window.dispatchEvent(new Event('resize'));
  }
  if (typeof obj.defaultMode === 'string') {
    if (defaultModeSel) defaultModeSel.value = obj.defaultMode;
  }
  if (typeof obj.defaultHz === 'string' || typeof obj.defaultHz === 'number') {
    const val = String(obj.defaultHz);
    if (defaultHzSel) defaultHzSel.value = val;
  }
}
function prefillSettingsModalFromCurrent() {
  if (!settingsModal) return;
  if (setShowWave && viewWaveCb) setShowWave.checked = !!viewWaveCb.checked;
  if (setShowSpec && viewSpecCb) setShowSpec.checked = !!viewSpecCb.checked;
  if (setShowHarm && viewHarmCb) setShowHarm.checked = !!viewHarmCb.checked;
  if (setSquareAspect && oscSquareEl) setSquareAspect.checked = !!oscSquareEl.checked;
  if (setHideDisabled) setHideDisabled.checked = document.documentElement.hasAttribute('data-hide-disabled');
  if (themeSelect) themeSelect.value = themeSelect.value || document.documentElement.getAttribute('data-theme') || 'matrix';
  if (uiScale) uiScale.value = String(parseFloat(document.documentElement.style.zoom || '1') || 1);
  if (defaultModeSel && modeSelect) defaultModeSel.value = modeSelect.value || 'float';
  if (defaultHzSel && hzSelect) defaultHzSel.value = String(hzSelect.value || '8000');
  if (syntaxThemeSel) {
    const saved = loadSettings();
    syntaxThemeSel.value = (saved && saved.syntaxTheme) || syntaxThemeSel.value || document.documentElement.getAttribute('data-syntax') || 'detect';
  }
}
function showSettings() {
  prefillSettingsModalFromCurrent();
  settingsModal?.classList.add('show');
}
function hideSettings() {
  settingsModal?.classList.remove('show');
}
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
    hideDisabled: !!setHideDisabled?.checked,
    theme: themeSelect?.value || 'matrix',
    syntaxTheme: syntaxThemeSel?.value || 'tomorrow-night',
    uiScale: parseFloat(uiScale?.value || '1') || 1,
    defaultMode: defaultModeSel?.value || 'float',
    defaultHz: defaultHzSel?.value || '44100',
  };
  saveSettings(obj);
  applySettings(obj);
  hideSettings();
  updateStatus('settings saved');
});
applySettingsBtn?.addEventListener('click', () => {
  const obj = {
    showWave: !!setShowWave?.checked,
    showSpec: !!setShowSpec?.checked,
    showHarm: !!setShowHarm?.checked,
    squareAspect: !!setSquareAspect?.checked,
    hideDisabled: !!setHideDisabled?.checked,
    theme: themeSelect?.value || 'matrix',
    syntaxTheme: syntaxThemeSel?.value || 'tomorrow-night',
    uiScale: parseFloat(uiScale?.value || '1') || 1,
    defaultMode: defaultModeSel?.value || 'float',
    defaultHz: defaultHzSel?.value || '44100',
  };
  saveSettings(obj);
  applySettings(obj);
  updateStatus('settings applied');
});

function selectSettingsTab(tabBtn, pane) {
  const tabs = [tabAppearance, tabGeneral, tabAccessibility, tabAudio];
  const panes = [paneAppearance, paneGeneral, paneAccessibility, paneAudio];
  tabs.forEach((t) => t && t.setAttribute('aria-selected', String(t === tabBtn)));
  panes.forEach((p) => { if (p) p.hidden = p !== pane; });
}
tabAppearance?.addEventListener('click', () => selectSettingsTab(tabAppearance, paneAppearance));
tabGeneral?.addEventListener('click', () => selectSettingsTab(tabGeneral, paneGeneral));
tabAccessibility?.addEventListener('click', () => selectSettingsTab(tabAccessibility, paneAccessibility));
tabAudio?.addEventListener('click', () => selectSettingsTab(tabAudio, paneAudio));

const initialSettings = Object.assign({ theme: 'matrix', syntaxTheme: 'detect' }, loadSettings() || {});
applySettings(initialSettings);
setSyntaxStyles(initialSettings.syntaxTheme);

// Populate custom titlebar text with app name and version
try {
  const { ipcRenderer } = require('electron');
  ipcRenderer.invoke('get-app-info').then(info => {
    const el = document.getElementById('appTitle');
    if (el && info && info.name && info.version) {
      el.textContent = `${info.name} v${info.version}`;
    }
  }).catch(() => {});
} catch (_) { /* non-electron context */ }

function getUiZoom() {
  const z = parseFloat(document.documentElement.style.zoom || '1');
  return Number.isFinite(z) && z > 0 ? z : 1;
}
