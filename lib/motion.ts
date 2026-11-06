/* ── Motion runtime: GSAP + ScrollTrigger + Lenis ───────────────────────── */
"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let registered = false;
export function ensureGsapRegistered() {
  if (registered) return;
  registered = true;
  gsap.registerPlugin(ScrollTrigger);
  // iOS/Android collapse their toolbars while you scroll, which fires
  // `resize` mid-scroll. Without this, every pinned section re-measures
  // and visibly jumps.
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger };

export const mm = gsap.matchMedia();

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const MOTION_REDUCED = "(prefers-reduced-motion: reduce)";

let activeLenis: Lenis | null = null;
// Content after the pinned threshold scene (the experience section) only
// reaches its real on-page position at the end of that scene's GSAP-driven
// scroll-jacked timeline — a plain anchor jump (native, or Lenis's own
// `anchors` handling) resolves against static layout and lands near the
// top of the pin instead. Anything that needs to skip past the intro has
// to scroll the real scroller (Lenis) to that ScrollTrigger's `end` value.
export function getLenis(): Lenis | null {
  return activeLenis;
}

export function startSmoothScroll(): Lenis | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia(MOTION_REDUCED).matches) return null;

  const lenis = new Lenis({
    lerp: 0.22,
    wheelMultiplier: 1.2,
    smoothWheel: true,
    syncTouch: false,
  });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  activeLenis = lenis;
  return lenis;
}

export function refreshWhenSettled() {
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}

export function trackScrollState() {
  const update = () => {
    document.body.classList.toggle("has-scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}
