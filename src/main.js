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
let customColors = [];      // hex strings from localStorage
let currentColor  = null;   // hex string of active full-screen color
let isFullscreen  = false;
let brightness    = 100;    // 5–200 range

// Timers
let tapTimer         = null;
let hideSliderTimer  = null;
let longPressTimer   = null;

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

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadCustomColors();
  renderPalette();
  bindEvents();
});

// ------------------------------------------------------------------
// Storage
// ------------------------------------------------------------------
const STORAGE_KEY = 'lightup_custom_colors';

function loadCustomColors() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    customColors = data ? JSON.parse(data) : [];
    if (!Array.isArray(customColors)) customColors = [];
  } catch {
    customColors = [];
  }
}

function saveCustomColors() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customColors));
}

// ------------------------------------------------------------------
// Render palette
// ------------------------------------------------------------------
function renderPalette() {
  renderPresets();
  renderCustomColors();
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

function createSwatchElement(hex, isPreset) {
  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  swatch.dataset.hex = hex;
  if (isPreset) swatch.dataset.preset = '';

  const colorBox = document.createElement('div');
  colorBox.className = 'swatch__color';
  colorBox.style.backgroundColor = hex;

  // Give very light swatches a subtle border so they don't blend into
  // the white page — here they won't, but it still helps on light
  // cards inside a dark surface.
  const light = isLightHex(hex);
  if (light) colorBox.classList.add('swatch__color--border');

  const label = document.createElement('span');
  label.className = 'swatch__label';
  label.textContent = hex;

  swatch.appendChild(colorBox);
  swatch.appendChild(label);

  // ---- Tap → enter full-screen ----
  swatch.addEventListener('click', () => {
    enterFullscreen(hex);
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

  // Visual feedback
  swatchEl.classList.add('swatch--deleting');

  setTimeout(() => {
    customColors = customColors.filter((c) => c !== hex);
    saveCustomColors();
    renderCustomColors();     // re-render the custom section

    // Scroll to keep position stable
    mainEl.scrollTop = mainEl.scrollHeight;
  }, 400);
}

// ------------------------------------------------------------------
// Add color (native picker via label for="colorPicker")
// ------------------------------------------------------------------
function onColorPicked() {
  const hex = colorPicker.value.toLowerCase();

  // Avoid duplicates
  const allHexes = [...PRESETS.map((p) => p.hex), ...customColors];
  if (allHexes.includes(hex)) return;

  customColors.push(hex);
  saveCustomColors();
  renderCustomColors();

  // Auto-scroll so new color is visible
  setTimeout(() => {
    mainEl.scrollTop = mainEl.scrollHeight;
  }, 50);
}

// ------------------------------------------------------------------
// Full-screen enter / exit
// ------------------------------------------------------------------
function enterFullscreen(hex) {
  currentColor = hex;
  isFullscreen = true;
  brightness   = 100;

  // Configure full-screen view
  fullscreenColor.style.backgroundColor = hex;
  brightnessSlider.value = brightness;
  brightnessValue.textContent = brightness + '%';

  // Apply initial brightness
  updateFullscreenBrightness();

  // Swap views
  app.hidden = true;
  fullscreen.hidden = false;

  // Hide brightness overlay initially
  brightnessOverlay.classList.remove('visible');

  // Attempt native full-screen (works on many mobile browsers)
  tryNativeFullscreen();
}

function exitFullscreen() {
  isFullscreen = false;
  currentColor = null;

  // Clean up timers
  clearTimers();

  // Reset brightness filter for next use
  fullscreenColor.style.filter = '';
  fullscreenColor.style.backgroundColor = '';

  // Swap views
  fullscreen.hidden = true;
  app.hidden = false;

  // Exit native full-screen if we entered it
  exitNativeFullscreen();
}

function tryNativeFullscreen() {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } catch {
    // Not supported — no problem
  }
}

function exitNativeFullscreen() {
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch {
    // Not supported
  }
}

// ------------------------------------------------------------------
// Brightness control
// ------------------------------------------------------------------
function updateFullscreenBrightness() {
  const val = brightness / 100; // 0.05 – 2.0
  fullscreenColor.style.filter = `brightness(${val})`;
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
    hideSliderTimer = null;
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
    // Second tap within threshold → double-tap → exit
    clearTimeout(tapTimer);
    tapTimer = null;
    clearTimeout(hideSliderTimer);
    hideSliderTimer = null;
    exitFullscreen();
    return;
  }

  // First tap — wait to see if it becomes a double-tap
  tapTimer = setTimeout(() => {
    // Single tap — toggle brightness slider
    tapTimer = null;
    toggleBrightnessOverlay();
  }, 300);
}

// ------------------------------------------------------------------
// Event binding
// ------------------------------------------------------------------
function bindEvents() {
  // Color picker: label for="colorPicker" opens it natively on tap
  colorPicker.addEventListener('change', onColorPicked);

  // Full-screen interactions
  fullscreen.addEventListener('click', (e) => {
    // Ignore clicks on the brightness overlay itself
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

  // Double-tap slider → reset to middle (100 / 100%)
  brightnessSlider.addEventListener('dblclick', (e) => {
    e.stopPropagation();    // don't bubble up to fullscreen's double-tap
    brightness = 100;
    brightnessSlider.value = brightness;
    brightnessValue.textContent = brightness + '%';
    updateFullscreenBrightness();
    resetHideSliderTimer();
  });

  // Keyboard shortcut: Escape to exit full-screen
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

/**
 * Rough heuristic for whether a hex colour is light enough to need
 * a visible border on a dark card.
 */
function isLightHex(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance (simplified)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 200;
}
