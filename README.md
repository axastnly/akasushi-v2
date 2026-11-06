# AKA — Restaurant & Lounge

Scroll-driven story site for AKA at Mileo The Palm, Dubai.
Vite + vanilla HTML/CSS/JS, GSAP ScrollTrigger for scroll animation, Lenis for smooth scrolling. No framework.

## Run it

```bash
npm install     # already done once
npm run dev     # http://localhost:5173
```

The dev server also binds to your LAN (`Network:` line in the terminal) so you can open the
same URL on an iPhone and check the pinning in real Safari.

```bash
npm run build && npm run preview   # production bundle
```

## Images you need to add

Everything under `public/` is served from the site root, so `public/assets/…` → `/assets/…`.

| File | Put it at | Status |
| --- | --- | --- |
| `bg.webp` | `public/assets/00-threshold/bg.webp` | **still needed** — 2400 × 1600, dark doorway with the vertical line of gold light |
| `door-left.png` | `public/assets/00-threshold/door-left.png` | ✅ in place |
| `door-right.png` | `public/assets/00-threshold/door-right.png` | ✅ in place |

Each image layer falls back independently: with `bg.webp` still missing, that one layer paints a
CSS stand-in (the gold light line + a dark radial glow) while the real doors render normally on
top. Drop `bg.webp` in and the stand-in disappears on its own — nothing else to change.

The layout assumes each door PNG is **just the panel**, about half a viewport wide (true of the
two files currently in place). If a future door image is a full-viewport frame with transparency
around the door instead, see the commented block at the bottom of `src/styles/scene-00.css` — it
is a three-line swap.

## Scenes

| | Scene | State |
| --- | --- | --- |
| 00 | Threshold | built |
| 01 | Unknown | placeholder |
| 02 | Awakening | placeholder |
| 03 | Art of Taste | placeholder |
| 04 | Connection | placeholder |
| 05 | Shift | placeholder |
| 06 | After Dark | placeholder |
| 07 | Moment | placeholder |

Each scene is a `<section class="scene" data-scene="NN">` wrapping a `.scene__pin` element —
`.scene__pin` is what GSAP pins, and it is sized `100svh`. To build the next one, add a module in
`src/scenes/` and register it in `src/scenes/index.js` under its number; sections without an entry
stay static.

## Fonts

Currently loaded: **IvyPresto Headline** (display copy) + **TT Drugs** (UI). Both self-hosted
licensed files in `public/assets/fonts/`, declared in `src/styles/fonts.css`. Swap by replacing
the woff2 files there and the two `--font-*` values in `src/styles/tokens.css`.

## Colours

Set as custom properties in `src/styles/tokens.css`:
`--black #0B0B0B` · `--gold #B58A4A` · `--red #8C151B` · `--ivory #EDE6DA`.
The deep red is defined and not yet used — it is there for a later scene.

## Motion notes

- Smooth scrolling runs through Lenis, driven off GSAP's ticker so ScrollTrigger and Lenis read
  the same frame.
- Touch scrolling is deliberately left native (`syncTouch: false`). Hijacking it costs frames on
  iPhone and is the usual cause of pinned sections feeling like they drift in Safari.
- `ScrollTrigger.config({ ignoreMobileResize: true })` stops mobile toolbar collapse from
  re-measuring pins mid-scroll.
- Pinned panels are sized in `svh`, not `vh`, so Safari's collapsing toolbar cannot change their
  height underneath a pin.
- `prefers-reduced-motion: reduce` disables Lenis entirely and swaps every scroll animation for a
  plain fade — scene 00 drops its pin, the doors rest open, the copy fades in.
