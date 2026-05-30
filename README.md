# Light4Me

Full-screen color illumination — use your screen as a colored flashlight.

Pick a color from the palette or create your own, then tap to fill the entire screen with that color. Double-tap to exit. Adjust brightness with a slider.

## Usage

- **Tap a color** — full-screen illumination
- **Double-tap** — exit full-screen mode
- **Single tap (full-screen)** — show/hide brightness slider
- **+ button** — add a custom color (native color picker)
- **Long-press a custom color** — delete it
- **Preset colors** — always available, cannot be deleted

## Run locally

```bash
python -m http.server 5173
# Then open http://localhost:5173/
```

Or with Node:
```bash
npx serve .
```

## Deploy

Cloudflare Pages:
```bash
npx wrangler pages deploy .
```

## Project structure

```
LightUp/
├── index.html             — app shell
├── manifest.webmanifest   — PWA manifest
├── sw.js                  — service worker (cache-first)
├── wrangler.jsonc         — Cloudflare config
├── assets/
│   ├── favicon.png         — master icon (512x512)
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── styles.css          — all styles
    └── main.js             — all logic
```
