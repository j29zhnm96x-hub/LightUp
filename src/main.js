'use strict';

/* ==================================================================
   Light4Me — full-screen color illumination app
   ================================================================== */

// ------------------------------------------------------------------
// Presets (pinned — never deletable)
// ------------------------------------------------------------------
const PRESETS = [
  { hex: '#ffffff', label: 'White' },
  { hex: '#fff8e1', label: 'Warm White' },
  { hex: '#ff1744', label: 'Red' },
  { hex: '#00e676', label: 'Green' },
  { hex: '#2979ff', label: 'Blue' },
  { hex: '#ffab00', label: 'Amber' },
  { hex: '#d500f9', label: 'Purple' },
  { hex: '#00e5ff', label: 'Cyan' },
];

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
let customColors  = [];
let currentColor  = null;
let isFullscreen  = false;
let brightness    = 100;

// Cycle state
let isCycleSelect = false;
let cycleColors   = [];
let cycleTime     = 10;        // total cycle seconds
let isCycling     = false;
let cyclePaused   = false;
let cycleRAF      = null;
let cycleStart    = 0;
let pauseStart    = 0;

// Cycle presets
let cyclePresets = [];

// Timers
let tapTimer        = null;
let hideSliderTimer = null;
let longPressTimer  = null;

// ------------------------------------------------------------------
// DOM references
// ------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const app               = $('app');
const presetsContainer  = $('presets');
const customsContainer  = $('customs');
const divider           = $('divider');
const fullscreen        = $('fullscreen');
const fullscreenColor   = $('fullscreenColor');
const brightnessOverlay = $('brightnessOverlay');
const brightnessSlider  = $('brightnessSlider');
const brightnessValue   = $('brightnessValue');
const colorPicker       = $('colorPicker');
const mainEl            = $('main');

// Cycle DOM refs
const cycleBtn         = $('cycleBtn');
const cycleSelector    = $('cycleSelector');
const cyclePreview     = $('cyclePreview');
const cycleHint        = $('cycleHint');
const cycleTimeInput   = $('cycleTimeInput');
const cyclePlayBtn     = $('cyclePlayBtn');
const cycleSaveBtn     = $('cycleSaveBtn');
const cycleStatusBar   = $('cycleStatusBar');
const cycleStatusLabel = $('cycleStatusLabel');
const cycleControls    = $('cycleControls');
const cycleToggleBtn   = $('cycleToggleBtn');
const cycleTimeDisplay = $('cycleTimeDisplay');
const cycleExitBtn     = $('cycleExitBtn');
const cycleSaveFsBtn   = $('cycleSaveFsBtn');
const presetCycleDiv   = $('presetCycleDivider');
const presetCycles     = $('presetCycles');

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadCustomColors();
  loadCyclePresets();
  renderPalette();
  bindEvents();
});

// ------------------------------------------------------------------
// Color Storage
// ------------------------------------------------------------------
const STORAGE_KEY      = 'lightup_custom_colors';
const PRESETS_KEY      = 'light4me_cycles';

function loadCustomColors() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    customColors = data ? JSON.parse(data) : [];
    if (!Array.isArray(customColors)) customColors = [];
  } catch { customColors = []; }
}

function saveCustomColors() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customColors));
}

function loadCyclePresets() {
  try {
    const data = localStorage.getItem(PRESETS_KEY);
    cyclePresets = data ? JSON.parse(data) : [];
    if (!Array.isArray(cyclePresets)) cyclePresets = [];
  } catch { cyclePresets = []; }
}

function saveCyclePresets() {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(cyclePresets));
}

// ------------------------------------------------------------------
// Render palette
// ------------------------------------------------------------------
function renderPalette() {
  renderPresets();
  renderCustomColors();
  renderCyclePresets();
}

function renderPresets() {
  presetsContainer.innerHTML = '';
  for (const preset of PRESETS) {
    presetsContainer.appendChild(createSwatchElement(preset.hex, true));
  }
}

function renderCustomColors() {
  customsContainer.innerHTML = '';
  if (customColors.length === 0) {
    divider.hidden = true;
    return;
  }
  divider.hidden = false;
  for (const hex of customColors) {
    customsContainer.appendChild(createSwatchElement(hex, false));
  }
}

// ------------------------------------------------------------------
// Cycle presets rendering
// ------------------------------------------------------------------
function renderCyclePresets() {
  presetCycles.innerHTML = '';

  if (cyclePresets.length === 0) {
    presetCycleDiv.hidden = true;
    return;
  }

  presetCycleDiv.hidden = false;

  for (let i = 0; i < cyclePresets.length; i++) {
    const preset = cyclePresets[i];

    const row = document.createElement('div');
    row.className = 'preset-cycle';
    row.dataset.index = i;

    const dots = document.createElement('div');
    dots.className = 'preset-cycle__dots';
    for (const hex of preset.colors) {
      const dot = document.createElement('span');
      dot.className = 'preset-cycle__dot';
      dot.style.backgroundColor = hex;
      dots.appendChild(dot);
    }

    const name = document.createElement('span');
    name.className = 'preset-cycle__name';
    name.textContent = preset.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'preset-cycle__delete';
    delBtn.textContent = '\u2715';
    delBtn.setAttribute('aria-label', 'Delete preset');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCyclePreset(i);
    });

    row.appendChild(dots);
    row.appendChild(name);
    row.appendChild(delBtn);

    row.addEventListener('click', () => {
      loadCyclePreset(preset);
    });

    presetCycles.appendChild(row);
  }
}

// ------------------------------------------------------------------
// Swatch element
// ------------------------------------------------------------------
function createSwatchElement(hex, isPreset) {
  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  swatch.dataset.hex = hex;
  if (isPreset) swatch.dataset.preset = '';

  const colorBox = document.createElement('div');
  colorBox.className = 'swatch__color';
  colorBox.style.backgroundColor = hex;

  const light = isLightHex(hex);
  if (light) colorBox.classList.add('swatch__color--border');

  const label = document.createElement('span');
  label.className = 'swatch__label';
  label.textContent = hex;

  swatch.appendChild(colorBox);
  swatch.appendChild(label);

  // ---- Interaction ----
  swatch.addEventListener('click', () => {
    if (isCycleSelect) {
      toggleCycleColor(hex);
    } else {
      enterFullscreen(hex);
    }
  });

  // ---- Long-press → delete (custom only) ----
  if (!isPreset) {
    swatch.addEventListener('pointerdown', onLongPressStart);
    swatch.addEventListener('pointerup',   onLongPressEnd);
    swatch.addEventListener('pointerleave', onLongPressEnd);
  }

  return swatch;
}

// ------------------------------------------------------------------
// Long-press delete
// ------------------------------------------------------------------
function onLongPressStart(e) {
  const swatch = e.currentTarget;
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    const hex = swatch.dataset.hex;
    if (!hex) return;
    deleteColor(hex, swatch);
  }, 500);
}

function onLongPressEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function deleteColor(hex, swatchEl) {
  if (!customColors.includes(hex)) return;
  swatchEl.classList.add('swatch--deleting');
  setTimeout(() => {
    customColors = customColors.filter((c) => c !== hex);
    // Also remove from cycle if selected
    const idx = cycleColors.indexOf(hex);
    if (idx !== -1) {
      cycleColors.splice(idx, 1);
      updateCycleSelector();
    }
    saveCustomColors();
    renderCustomColors();
    mainEl.scrollTop = mainEl.scrollHeight;
  }, 400);
}

// ------------------------------------------------------------------
// Add color
// ------------------------------------------------------------------
let colorBeforePick = null;

function commitCustomColor(hex) {
  const allHexes = [...PRESETS.map((p) => p.hex), ...customColors];
  if (allHexes.includes(hex)) return;
  customColors.push(hex);
  saveCustomColors();
  renderCustomColors();
  setTimeout(() => { mainEl.scrollTop = mainEl.scrollHeight; }, 50);
}

// ------------------------------------------------------------------
// CYCLE: toggle select mode
// ------------------------------------------------------------------
function toggleCycleSelect() {
  isCycleSelect = !isCycleSelect;

  if (isCycleSelect) {
    // Enter cycle-select mode
    cycleBtn.classList.add('topbar__cycle-btn--active');
    cycleSelector.hidden = false;
    cycleColors = [];
    updateCycleSelector();
    // Mark all swatches with cycle-mode class
    document.querySelectorAll('.swatch').forEach((s) => {
      s.classList.add('swatch--cycle-mode');
    });
  } else {
    exitCycleSelect();
  }
}

function exitCycleSelect() {
  isCycleSelect = false;
  cycleBtn.classList.remove('topbar__cycle-btn--active');
  cycleSelector.hidden = true;
  cycleColors = [];
  document.querySelectorAll('.swatch').forEach((s) => {
    s.classList.remove('swatch--cycle-mode', 'swatch--selected');
  });
}

// ------------------------------------------------------------------
// CYCLE: toggle a color in the cycle list
// ------------------------------------------------------------------
function toggleCycleColor(hex) {
  const idx = cycleColors.indexOf(hex);
  if (idx !== -1) {
    cycleColors.splice(idx, 1);
  } else {
    cycleColors.push(hex);
  }
  updateCycleSelector();
}

function updateCycleSelector() {
  // Update swatch highlights
  document.querySelectorAll('.swatch').forEach((s) => {
    const hex = s.dataset.hex;
    if (cycleColors.includes(hex)) {
      s.classList.add('swatch--selected');
    } else {
      s.classList.remove('swatch--selected');
    }
  });

  // Update preview
  cyclePreview.innerHTML = '';
  if (cycleColors.length === 0) {
    cyclePreview.appendChild(cycleHint);
  } else {
    for (const hex of cycleColors) {
      const dot = document.createElement('span');
      dot.className = 'cycle-selector__dot';
      dot.style.backgroundColor = hex;
      cyclePreview.appendChild(dot);
    }
  }

  // Enable/disable buttons
  const enough = cycleColors.length >= 2;
  cyclePlayBtn.disabled = !enough;
  cycleSaveBtn.disabled = !enough;
}

// ------------------------------------------------------------------
// CYCLE: start
// ------------------------------------------------------------------
function startCycle() {
  if (cycleColors.length < 2) return;

  // Read time
  cycleTime = parseInt(cycleTimeInput.value, 10) || 10;
  if (cycleTime < 1) cycleTime = 1;
  if (cycleTime > 3600) cycleTime = 3600;
  cycleTimeInput.value = cycleTime;

  // Capture colors before exitCycleSelect clears them
  const colors = cycleColors.slice();

  isFullscreen = true;
  isCycling = true;
  cyclePaused = false;
  currentColor = colors[0];
  brightness = 100;

  // Exit cycle-select mode (clears cycleColors, but we have a copy)
  exitCycleSelect();

  // Restore cycleColors for the animation loop
  cycleColors = colors;

  // Setup fullscreen
  fullscreenColor.style.backgroundColor = colors[0];
  brightnessSlider.value = brightness;
  brightnessValue.textContent = brightness + '%';
  updateFullscreenBrightness();

  // Show fullscreen
  app.hidden = true;
  fullscreen.hidden = false;
  brightnessOverlay.classList.remove('visible');

  // Show cycle UI
  cycleStatusBar.hidden = false;
  cycleControls.hidden = false;
  cycleToggleBtn.textContent = '\u23F8'; // pause
  cycleTimeDisplay.textContent = cycleTime + 's';
  updateCycleStatusLabel();

  // Start animation
  cycleStart = performance.now();
  cycleRAF = requestAnimationFrame(cycleFrame);

  tryNativeFullscreen();
}

function updateCycleStatusLabel() {
  const names = cycleColors.map((h) => h.toUpperCase());
  cycleStatusLabel.textContent = 'Cycling: ' + names.join(' \u2192 ');
}

// ------------------------------------------------------------------
// CYCLE: animation frame
// ------------------------------------------------------------------
function cycleFrame(timestamp) {
  if (!isCycling) return;

  if (cyclePaused) {
    cycleRAF = requestAnimationFrame(cycleFrame);
    return;
  }

  const n = cycleColors.length;
  if (n < 2) { cycleRAF = requestAnimationFrame(cycleFrame); return; }
  const elapsed = (timestamp - cycleStart) / 1000;
  const phase = elapsed % cycleTime;
  const segDuration = cycleTime / n;
  const segIndex = Math.floor(phase / segDuration);
  const segProgress = (phase % segDuration) / segDuration;

  const fromHex = cycleColors[segIndex];
  const toHex   = cycleColors[(segIndex + 1) % n];
  if (!fromHex || !toHex) { cycleRAF = requestAnimationFrame(cycleFrame); return; }
  const rgb = lerpColor(fromHex, toHex, segProgress);

  fullscreenColor.style.backgroundColor = rgb;

  cycleRAF = requestAnimationFrame(cycleFrame);
}

function lerpColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.substring(1, 3), 16);
  const g1 = parseInt(hex1.substring(3, 5), 16);
  const b1 = parseInt(hex1.substring(5, 7), 16);
  const r2 = parseInt(hex2.substring(1, 3), 16);
  const g2 = parseInt(hex2.substring(3, 5), 16);
  const b2 = parseInt(hex2.substring(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

// ------------------------------------------------------------------
// CYCLE: pause / unpause
// ------------------------------------------------------------------
function toggleCyclePause() {
  if (cyclePaused) {
    // Unpause
    const pauseDur = performance.now() - pauseStart;
    cycleStart += pauseDur;
    cyclePaused = false;
    cycleToggleBtn.textContent = '\u23F8'; // pause
  } else {
    cyclePaused = true;
    pauseStart = performance.now();
    cycleToggleBtn.textContent = '\u25B6'; // play
  }
}

// ------------------------------------------------------------------
// CYCLE: save preset
// ------------------------------------------------------------------
function saveCyclePreset() {
  if (cycleColors.length < 2) return;

  const name = prompt('Name this color cycle:', '');
  if (!name || !name.trim()) return;

  cyclePresets.push({
    name: name.trim(),
    colors: [...cycleColors],
    createdAt: Date.now()
  });

  saveCyclePresets();
  renderCyclePresets();
}

function deleteCyclePreset(index) {
  cyclePresets.splice(index, 1);
  saveCyclePresets();
  renderCyclePresets();
}

function loadCyclePreset(preset) {
  // Activate cycle-select mode with preset colors
  if (!isCycleSelect) {
    toggleCycleSelect();
  }
  cycleColors = [...preset.colors];
  updateCycleSelector();

  // Scroll palette area into view
  mainEl.scrollTop = 0;
}

// ------------------------------------------------------------------
// Full-screen enter
// ------------------------------------------------------------------
function enterFullscreen(hex) {
  // If in cycle-select mode, exit it
  if (isCycleSelect) exitCycleSelect();

  currentColor = hex;
  isFullscreen = true;
  brightness   = 100;

  fullscreenColor.style.backgroundColor = hex;
  brightnessSlider.value = brightness;
  brightnessValue.textContent = brightness + '%';
  updateFullscreenBrightness();

  app.hidden = true;
  fullscreen.hidden = false;
  brightnessOverlay.classList.remove('visible');

  tryNativeFullscreen();
}

// ------------------------------------------------------------------
// Full-screen exit
// ------------------------------------------------------------------
function exitFullscreen() {
  // Remember cycle state before clearing
  const wasCycling = isCycling;
  const savedColors = cycleColors.length > 0 ? cycleColors.slice() : null;
  const savedTime = cycleTime;

  // Stop cycling
  isCycling = false;
  cyclePaused = false;
  if (cycleRAF) {
    cancelAnimationFrame(cycleRAF);
    cycleRAF = null;
  }

  isFullscreen = false;
  currentColor = null;

  clearTimers();

  fullscreenColor.style.filter = '';
  fullscreenColor.style.backgroundColor = '';

  // Hide cycle UI
  cycleStatusBar.hidden = true;
  cycleControls.hidden = true;

  fullscreen.hidden = true;
  app.hidden = false;

  exitNativeFullscreen();

  // If we were cycling, re-enter cycle-select mode with colors loaded
  // so the user can save the preset or tweak and play again
  if (wasCycling && savedColors && savedColors.length >= 2) {
    cycleColors = savedColors;
    cycleTimeInput.value = savedTime;

    isCycleSelect = true;
    cycleBtn.classList.add('topbar__cycle-btn--active');
    cycleSelector.hidden = false;

    updateCycleSelector();

    document.querySelectorAll('.swatch').forEach((s) => {
      s.classList.add('swatch--cycle-mode');
      const hex = s.dataset.hex;
      if (cycleColors.includes(hex)) {
        s.classList.add('swatch--selected');
      }
    });
  }
}

// ------------------------------------------------------------------
// Native fullscreen API
// ------------------------------------------------------------------
function tryNativeFullscreen() {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } catch { /* noop */ }
}

function exitNativeFullscreen() {
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch { /* noop */ }
}

// ------------------------------------------------------------------
// Brightness
// ------------------------------------------------------------------
function updateFullscreenBrightness() {
  const val = brightness / 100;
  fullscreenColor.style.filter = 'brightness(' + val + ')';
}

function showBrightnessOverlay() {
  brightnessOverlay.classList.add('visible');
  resetHideSliderTimer();
}

function hideBrightnessOverlay() {
  brightnessOverlay.classList.remove('visible');
}

function toggleBrightnessOverlay() {
  if (brightnessOverlay.classList.contains('visible')) {
    hideBrightnessOverlay();
  } else {
    showBrightnessOverlay();
  }
}

function resetHideSliderTimer() {
  if (hideSliderTimer) {
    clearTimeout(hideSliderTimer);
  }
  hideSliderTimer = setTimeout(() => {
    hideBrightnessOverlay();
    hideSliderTimer = null;
  }, 2000);
}

// ------------------------------------------------------------------
// Double-tap detection
// ------------------------------------------------------------------
function handleFullscreenPointer() {
  if (tapTimer) {
    clearTimeout(tapTimer);
    tapTimer = null;
    clearTimeout(hideSliderTimer);
    hideSliderTimer = null;
    exitFullscreen();
    return;
  }
  tapTimer = setTimeout(() => {
    tapTimer = null;
    toggleBrightnessOverlay();
  }, 300);
}

// ------------------------------------------------------------------
// Event binding
// ------------------------------------------------------------------
function bindEvents() {
  // Color picker
  colorPicker.addEventListener('focus', () => {
    colorBeforePick = colorPicker.value;
  });
  colorPicker.addEventListener('blur', () => {
    if (colorBeforePick !== null) {
      const picked = colorPicker.value;
      colorBeforePick = null;
      if (picked !== colorBeforePick) {
        commitCustomColor(picked.toLowerCase());
      }
    }
  });

  // Cycle button
  cycleBtn.addEventListener('click', toggleCycleSelect);

  // Cycle time input
  cycleTimeInput.addEventListener('change', () => {
    let val = parseInt(cycleTimeInput.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 3600) val = 3600;
    cycleTimeInput.value = val;
  });

  // Cycle play
  cyclePlayBtn.addEventListener('click', startCycle);

  // Cycle save
  cycleSaveBtn.addEventListener('click', saveCyclePreset);

  // Full-screen interactions
  fullscreen.addEventListener('click', (e) => {
    if (brightnessOverlay.contains(e.target)) return;
    handleFullscreenPointer();
  });

  // Brightness slider
  brightnessSlider.addEventListener('input', () => {
    brightness = parseInt(brightnessSlider.value, 10);
    brightnessValue.textContent = brightness + '%';
    updateFullscreenBrightness();
    resetHideSliderTimer();
  });

  // Double-tap slider → reset to 100
  brightnessSlider.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    brightness = 100;
    brightnessSlider.value = brightness;
    brightnessValue.textContent = brightness + '%';
    updateFullscreenBrightness();
    resetHideSliderTimer();
  });

  // Cycle toggle (pause/play)
  cycleToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCyclePause();
    resetHideSliderTimer();
  });

  // Cycle exit button
  cycleExitBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exitFullscreen();
  });

  // Cycle save from fullscreen
  cycleSaveFsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const colors = cycleColors.slice();
    if (colors.length < 2) return;
    const name = prompt('Name this color cycle:', '');
    if (!name || !name.trim()) return;
    cyclePresets.push({ name: name.trim(), colors, createdAt: Date.now() });
    saveCyclePresets();
    renderCyclePresets();
    resetHideSliderTimer();
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreen) {
      exitFullscreen();
    }
  });
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function clearTimers() {
  if (tapTimer) {
    clearTimeout(tapTimer);
    tapTimer = null;
  }
  if (hideSliderTimer) {
    clearTimeout(hideSliderTimer);
    hideSliderTimer = null;
  }
}

function isLightHex(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 200;
}
