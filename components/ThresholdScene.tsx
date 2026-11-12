"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  ScrollTrigger,
  mm,
  MOTION_OK,
  MOTION_REDUCED,
  getLenis,
} from "@/lib/motion";
import { WebCodecsPlayer } from "@/lib/webcodecsPlayer";
import { logDebug } from "@/lib/debugLog";
import { asset } from "@/lib/paths";
import {
  NUDGE_ENABLED,
  NUDGE_IDLE_DELAYS_MS,
  NUDGE_OUT_DURATION_S,
  NUDGE_HOLD_MS,
  NUDGE_RETURN_DURATION_S,
  WIPE_VH,
  TITLE_VH,
  FINALE_VH,
  CAPTION_TRANSITION,
  CAPTION_BEAT_STARTS_PCT,
  CAPTION_TRANSITION_WINDOW,
  CAPTION_EDGE_FADE,
  CAPTION_TRAVEL_EASE,
  CAPTION_TRAVEL_DISTANCE_VW,
  CAPTION_TRAVEL_DRIFT_PX,
  CAPTION_CROSSFADE_SPLIT,
  INK_SWEEP_FRACTION,
  INK_EDGE_JITTER_PCT,
  INK_STROKE_COLOR_RGB,
  INK_STROKE_OPACITY,
  INK_STROKE_WIDTH_PCT,
  INK_STROKE_OVERHANG_PCT,
  INK_STROKE_BLUR_PX,
  INK_STROKE_TAPER_PCT,
  RISE_TRAVEL_FROM_VH,
  RISE_TRAVEL_TO_VH,
  RISE_SPEED_FACTOR,
  RISE_OVERLAP,
  RISE_FADE_EDGE,
  RISE_KANJI_SPEED_FACTOR,
  RISE_FIGMA_REF,
  RISE_LAYOUT,
  RISE_SIDE_OFFSET_PX,
  RISE_KANJI_SIZE_PX,
  RISE_TYPE_PX,
  RISE_KANJI_BLEND,
  RISE_KANJI_COLOR,
  RISE_KANJI_BLUR_PX,
  CUE_IN_DELAY_S,
  CUE_IN_DURATION_S,
  CUE_IN_EASE,
  CUE_IN_Y_PX,
  CUE_IN_BLUR_PX,
  CUE_IN_STAGGER_S,
  CUE_OUT_SCROLL_PX,
  CUE_NUDGE_SCALE,
  CUE_NUDGE_IN_DURATION_S,
  CUE_NUDGE_IN_EASE,
  CUE_NUDGE_OUT_DURATION_S,
  CUE_NUDGE_OUT_EASE,
  CUE_NUDGE_GLOW,
} from "@/lib/scrollIncentives";
import Button from "./Button";
import { useReserveModal } from "./ReserveModalProvider";

/* Ported from the Vite site's scene-00-threshold.js — same four-phase
   choreography (auto intro → wipe scrub → title card → finale scrub),
   same pin/ScrollTrigger mechanics. The only real change: phases 2 and 4
   scrub WebCodecsPlayer instances instead of seeking <video> elements or
   drawing pre-extracted AVIF frames — see lib/webcodecsPlayer.ts. */

// Phase lengths in viewport-heights of scroll — the actual video scrub
// speeds (WIPE_VH/TITLE_VH/FINALE_VH) live in lib/scrollIncentives.ts.
// Wipe and title card were originally 0.28 / 0.22 of +=650%. The finale
// was 325vh for the original 25.08s clip; finale-*.mp4 is now trimmed to
// end on its pitch-black frame (~14.3s), so its share shrinks
// proportionally (325 × 14.33 / 25.08 ≈ 186vh) to keep the same
// scroll-per-second scrub feel.
const TOTAL_VH = WIPE_VH + TITLE_VH + FINALE_VH;
const PIN_LENGTH = `+=${TOTAL_VH}%`;
const WIPE_FRACTION = WIPE_VH / TOTAL_VH;
const TITLE_FRACTION = TITLE_VH / TOTAL_VH;
// bg--main -> bgShot (the webp) is a fixed-duration fade with scroll
// completely locked (see lenis.stop()/start() in the effect below) — not
// scroll-driven, because there's nothing to drive it with: no scroll
// input reaches the page until this fade's onComplete calls lenis.start().
// That's what makes the handoff deterministic every time, instead of
// racing however fast the user happens to scroll.
const BG_FADE_DURATION = 1.4;
// Once unlocked, bgShot itself fades over this fraction of scroll to
// reveal wipeCanvas underneath.
const BG_SHOT_FADE_FRACTION = 0.03;
// wipeCanvas's own scrub (below) only starts advancing past this point —
// without it, the wipe video's progress would race ahead in lockstep with
// bgShot's fade-out, so by the time bgShot finishes revealing it, it's
// already well past its first frame (a visible jump instead of a clean
// reveal). Holding wipeProgress at 0 until bgShot's fade is done
// guarantees wipeCanvas is still on frame 0 — matching bgShot — no matter
// how fast that fade gets scrolled through.
const PACE = 1.4;
// Hero copy ("A Taste Of Japan" + buttons) fades out in lockstep with
// bg-wipe.mp4's own fade to black. Normalised frame brightness (1 = full,
// 0 = black) measured from the file for frames 47..75 of its 76 frames —
// before 47 the copy is fully visible, after 75 it's gone.
const WIPE_FADE_FIRST_FRAME = 47;
const WIPE_FADE_CURVE = [
  1, 1, 0.98, 0.95, 0.9, 0.85, 0.78, 0.73, 0.68, 0.62, 0.58, 0.54, 0.49, 0.43, 0.39, 0.33, 0.27, 0.23, 0.19,
  0.15, 0.12, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0, 0,
];
const WIPE_FRAME_COUNT = 76;

// Finale captions (Figma nodes 416:2710/2712/2714/2718) — either one block
// that glides between alternating sides, content swapping mid-glide
// ("travel"), or a fixed-position block wiped by a brush stroke ("ink") —
// see CAPTION_TRANSITION in lib/scrollIncentives.ts.
/* kanji is the watermark glyph shown behind the English in "rise" only
   (the other three transitions ignore it). 忍 is the hero's own
   character from Figma; the rest follow its logic — each is the single
   kanji at the heart of that line. Any change here needs the font
   subset regenerated, since it carries only these four glyphs:
     pyftsubset AoyagiKouzanTOTF.otf --text="忍技握縁" --flavor=woff2 \
       --output-file=public/assets/fonts/AoyagiKouzan-subset.woff2 */
const FINALE_CAPTIONS = [
  { eyebrow: "with", title: "Patience and Precision", kanji: "忍", side: "left" as const },
  { eyebrow: "by", title: "Hands That Know the Fish", kanji: "技", side: "right" as const },
  { eyebrow: "shaped", title: "One Piece at a Time", kanji: "握", side: "left" as const },
  { eyebrow: "to", title: "Your Table", kanji: "縁", side: "right" as const },
];
// All of this sequence's tunable numbers (beat timing, easing, glide
// distance, drift, stroke width/colour/opacity, etc.) live in
// lib/scrollIncentives.ts — this just turns the ease name into a function.
const captionEase = gsap.parseEase(CAPTION_TRAVEL_EASE);
function wipeBrightness(progress: number) {
  const i = progress * (WIPE_FRAME_COUNT - 1) - WIPE_FADE_FIRST_FRAME;
  if (i <= 0) return 1;
  if (i >= WIPE_FADE_CURVE.length - 1) return 0;
  const lo = Math.floor(i);
  return WIPE_FADE_CURVE[lo] + (WIPE_FADE_CURVE[lo + 1] - WIPE_FADE_CURVE[lo]) * (i - lo);
}

/* Frame-rate-independent exponential lerp — smooths the discrete frame
   picks WebCodecs scrubbing produces (same reasoning as the AVIF
   version's smoothProgress). Snaps to target below SETTLE_EPSILON so it
   stops computing once converged rather than chasing forever. */
const SCRUB_SMOOTHING = 0.35;
const SETTLE_EPSILON = 0.0015;
function smoothProgress(current: number, target: number) {
  if (Math.abs(target - current) < SETTLE_EPSILON) return target;
  const rate = 1 - Math.pow(1 - SCRUB_SMOOTHING, gsap.ticker.deltaRatio());
  return current + (target - current) * rate;
}

export default function ThresholdScene() {
  const { openReserve } = useReserveModal();
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLVideoElement>(null);
  const bgShotRef = useRef<HTMLImageElement>(null);
  const wipeCanvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const ctaGroupRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const titleCardRef = useRef<HTMLDivElement>(null);
  const titleCardGradientRef = useRef<HTMLDivElement>(null);
  const titleCardVignetteRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const titleLine1Ref = useRef<HTMLSpanElement>(null);
  const titleLine2Ref = useRef<HTMLSpanElement>(null);
  const finaleCanvasRef = useRef<HTMLCanvasElement>(null);
  const finaleCaptionRef = useRef<HTMLDivElement>(null);
  const finaleCaptionEyebrowRef = useRef<HTMLParagraphElement>(null);
  const finaleCaptionTitleRef = useRef<HTMLParagraphElement>(null);
  const finaleInkRef = useRef<HTMLDivElement>(null);
  const finaleInkOldRef = useRef<HTMLDivElement>(null);
  const finaleInkOldEyebrowRef = useRef<HTMLParagraphElement>(null);
  const finaleInkOldTitleRef = useRef<HTMLParagraphElement>(null);
  const finaleInkNewRef = useRef<HTMLDivElement>(null);
  const finaleInkNewEyebrowRef = useRef<HTMLParagraphElement>(null);
  const finaleInkNewTitleRef = useRef<HTMLParagraphElement>(null);
  const finaleInkStrokeRef = useRef<HTMLDivElement>(null);
  const finaleRevealRef = useRef<HTMLDivElement>(null);
  const finaleRevealEyebrowRef = useRef<HTMLParagraphElement>(null);
  const finaleRevealTitleRef = useRef<HTMLParagraphElement>(null);
  const finaleRiseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureGsapRegistered();
    const section = sectionRef.current!;
    const pin = pinRef.current!;
    const bg = bgRef.current!;
    const bgShot = bgShotRef.current;

    // iOS Low Power Mode silently blocks video.play() unless it's the
    // direct, synchronous result of a user gesture — even for muted video.
    // The real bg.play() call later happens async (inside a GSAP timeline
    // callback), well outside any gesture, so on a Low Power Mode phone it
    // gets rejected with no visible error (swallowed by .catch) and the
    // video just never starts. Priming it — play() + immediate pause(),
    // synchronously inside the first real touch/click/scroll — unlocks
    // playback for the rest of the page's lifetime, so the later call
    // succeeds. See lib/webcodecsPlayer.ts for the related (but distinct)
    // "never actually played" seeking bug this doesn't fully overlap with.
    let primed = false;
    const disablePriming = () => {
      primed = true;
      window.removeEventListener("touchstart", primeVideo);
      window.removeEventListener("pointerdown", primeVideo);
      window.removeEventListener("wheel", primeVideo);
    };
    const primeVideo = () => {
      if (primed) return;
      disablePriming();
      bg.play()
        .then(() => bg.pause())
        .catch(() => {});
    };
    window.addEventListener("touchstart", primeVideo, { passive: true });
    window.addEventListener("pointerdown", primeVideo);
    window.addEventListener("wheel", primeVideo, { passive: true });

    // If the real (non-gesture) bg.play() below gets rejected — same Low
    // Power Mode case as above, just too late for priming to have helped —
    // don't skip the intro. Frame 0 is already painted (bg faded in at
    // doorOpenStart regardless of play() succeeding), so it reads as a
    // still; wait for any real tap and retry there instead.
    let playRetryArmed = false;
    const retryBgPlay = () => {
      window.removeEventListener("pointerdown", retryBgPlay);
      window.removeEventListener("touchstart", retryBgPlay);
      bg.play().catch(() => {});
    };
    const armPlayRetry = () => {
      if (playRetryArmed) return;
      playRetryArmed = true;
      window.addEventListener("pointerdown", retryBgPlay, { once: true });
      window.addEventListener("touchstart", retryBgPlay, { once: true, passive: true });
    };
    const wipeCanvas = wipeCanvasRef.current;
    // The doors are rendered by <ThresholdDoors /> as the page's top-most
    // layer (above the header), not inside this scene — look them up by class.
    const doorLeft = document.querySelector<HTMLImageElement>(".threshold__door--left")!;
    const doorRight = document.querySelector<HTMLImageElement>(".threshold__door--right")!;
    const handleLeft = document.querySelector<HTMLImageElement>(".threshold__handle--left");
    const handleRight = document.querySelector<HTMLImageElement>(".threshold__handle--right");
    const handleBaseLeft = document.querySelector<HTMLImageElement>(".threshold__handle-base--left");
    const handleBaseRight = document.querySelector<HTMLImageElement>(".threshold__handle-base--right");
    const loadingLabel = document.querySelector<HTMLElement>(".threshold__loading");
    const copy = copyRef.current;
    const lines = [line1Ref.current, line2Ref.current].filter(Boolean) as HTMLElement[];
    const ctaGroup = ctaGroupRef.current;
    const scrollIndicator = scrollIndicatorRef.current;
    /* The cue's own moving parts. Deliberately NOT the wrapper — see the
       "Step Inside" notes in lib/scrollIncentives.ts. */
    const cueParts = scrollIndicator
      ? ([
          ...Array.from(scrollIndicator.querySelectorAll<HTMLElement>(".scene__scroll-indicator-letter")),
          scrollIndicator.querySelector<HTMLElement>(".scene__scroll-indicator-line"),
        ].filter(Boolean) as HTMLElement[])
      : [];
    const cueHidden = { opacity: 0, y: CUE_IN_Y_PX, filter: `blur(${CUE_IN_BLUR_PX}px)` };
    const titleCard = titleCardRef.current;
    const titleCardGradient = titleCardGradientRef.current;
    const titleCardVignette = titleCardVignetteRef.current;
    const titleCardReveals = [eyebrowRef.current, titleLine1Ref.current, titleLine2Ref.current].filter(
      Boolean,
    ) as HTMLElement[];
    const finaleCanvas = finaleCanvasRef.current;
    const finaleCaption = finaleCaptionRef.current;
    const finaleCaptionEyebrow = finaleCaptionEyebrowRef.current;
    const finaleCaptionTitle = finaleCaptionTitleRef.current;
    const finaleInk = finaleInkRef.current;
    const finaleInkOld = finaleInkOldRef.current;
    const finaleInkOldEyebrow = finaleInkOldEyebrowRef.current;
    const finaleInkOldTitle = finaleInkOldTitleRef.current;
    const finaleInkNew = finaleInkNewRef.current;
    const finaleInkNewEyebrow = finaleInkNewEyebrowRef.current;
    const finaleInkNewTitle = finaleInkNewTitleRef.current;
    const finaleInkStroke = finaleInkStrokeRef.current;
    const finaleReveal = finaleRevealRef.current;
    const finaleRevealEyebrow = finaleRevealEyebrowRef.current;
    const finaleRevealTitle = finaleRevealTitleRef.current;
    const finaleRise = finaleRiseRef.current;
    const finaleRiseItems = finaleRise ? Array.from(finaleRise.querySelectorAll<HTMLElement>(".finale-rise__item")) : [];
    // The kanji and the English move separately, so each is collected on
    // its own — the item itself now only carries side placement + fade.
    const finaleRiseKanji = finaleRise ? Array.from(finaleRise.querySelectorAll<HTMLElement>(".finale-rise__kanji")) : [];
    const finaleRiseTexts = finaleRise ? Array.from(finaleRise.querySelectorAll<HTMLElement>(".finale-rise__text")) : [];
    const chrome = document.querySelector(".chrome");

    // Ink stroke's look (width/colour/opacity/blur/taper) is static — set
    // once here from lib/scrollIncentives.ts rather than every scroll
    // frame; only its position/opacity-over-time are scrubbed in onUpdate.
    if (finaleInkStroke) {
      finaleInkStroke.style.width = `${INK_STROKE_WIDTH_PCT}%`;
      finaleInkStroke.style.top = `${-INK_STROKE_OVERHANG_PCT}%`;
      finaleInkStroke.style.bottom = `${-INK_STROKE_OVERHANG_PCT}%`;
      finaleInkStroke.style.background = `linear-gradient(to right, rgb(${INK_STROKE_COLOR_RGB} / 0) 0%, rgb(${INK_STROKE_COLOR_RGB} / ${INK_STROKE_OPACITY}) 35%, rgb(${INK_STROKE_COLOR_RGB} / ${INK_STROKE_OPACITY}) 65%, rgb(${INK_STROKE_COLOR_RGB} / 0) 100%)`;
      finaleInkStroke.style.filter = `blur(${INK_STROKE_BLUR_PX}px)`;
      const taperMask = `linear-gradient(to bottom, transparent 0%, black ${INK_STROKE_TAPER_PCT}%, black ${100 - INK_STROKE_TAPER_PCT}%, transparent 100%)`;
      finaleInkStroke.style.setProperty("-webkit-mask-image", taperMask);
      finaleInkStroke.style.setProperty("mask-image", taperMask);
    }

    // Each "rise" item keeps a fixed side/edge-offset for its whole life —
    // only its vertical position and opacity are scrubbed per frame.
    const { desktop: dRef, mobile: mRef } = RISE_FIGMA_REF;
    /* A Figma phone pixel, expressed so it scales with the viewport but
       never exceeds the mock's own value: at the 402px reference width
       the vw term equals the px term exactly, below it the vw term wins
       (everything shrinks proportionally), and above it the px term caps
       things rather than letting raw vw inflate them toward the 767px
       end of the breakpoint. min() for positives, max() for negatives —
       for a negative length the cap is the LARGER of the two. NB: do not
       be tempted back into a single `calc(scale * Npx)` factor — a CSS
       length divided by a number is still a length, so that scale comes
       out in px and the multiplication yields px², which is invalid. */
    const phonePx = (px: number) => {
      const vw = `${(px / mRef.width) * 100}vw`;
      return px < 0 ? `max(${vw}, ${px}px)` : `min(${vw}, ${px}px)`;
    };
    finaleRiseItems.forEach((item, i) => {
      const side = FINALE_CAPTIONS[i]?.side;
      const edge = `${(RISE_SIDE_OFFSET_PX / dRef.width) * 100}vw`;
      if (side === "left") {
        item.style.left = edge;
        item.style.right = "auto";
      } else {
        item.style.right = edge;
        item.style.left = "auto";
      }

      // Placement is static — pushed in once as custom properties so
      // every tunable stays in lib/scrollIncentives.ts instead of being
      // split between there and globals.css. Both breakpoints' values
      // are set on every item; the media query picks which pair applies.
      const L = RISE_LAYOUT[i];
      if (L) {
        // Desktop: straight vw/vh off the 1512x818 reference frame.
        item.style.setProperty("--rise-top", `${(L.desktop.textTop / dRef.height) * 100}vh`);
        item.style.setProperty("--text-width", `${(L.desktop.textWidth / dRef.width) * 100}vw`);
        item.style.setProperty("--kanji-x", `${(L.desktop.kanjiX / dRef.width) * 100}vw`);
        item.style.setProperty("--kanji-y", `${(L.desktop.kanjiY / dRef.width) * 100}vw`);
        item.style.setProperty("--kanji-size", `${(RISE_KANJI_SIZE_PX.desktop / dRef.width) * 100}vw`);
        // Mobile: Figma's raw px, scaled by viewport width but capped at
        // the mock's own value — see phonePx above.
        item.style.setProperty("--rise-top-m", `${(L.mobile.textTop / mRef.height) * 100}vh`);
        item.style.setProperty("--text-width-m", phonePx(L.mobile.textWidth));
        item.style.setProperty("--kanji-x-m", phonePx(L.mobile.kanjiX));
        item.style.setProperty("--kanji-y-m", phonePx(L.mobile.kanjiY));
        item.style.setProperty("--kanji-size-m", phonePx(RISE_KANJI_SIZE_PX.mobile));
        item.style.setProperty("--eyebrow-size-m", phonePx(RISE_TYPE_PX.mobile.eyebrow));
        item.style.setProperty("--title-size-m", phonePx(RISE_TYPE_PX.mobile.title));
      }
      item.style.setProperty("--kanji-blend", RISE_KANJI_BLEND);
      item.style.setProperty("--kanji-color", RISE_KANJI_COLOR);
      item.style.setProperty("--kanji-blur", `${RISE_KANJI_BLUR_PX}px`);
    });

    // wipePlayer/finalePlayer fetch their whole source file up front
    // (2.2MB, and ~4.5MB/~2.4MB for the trimmed finale desktop/mobile) — starting that
    // immediately would compete for bandwidth with bg.mp4 right as it
    // needs to buffer enough to play the intro smoothly. Neither is
    // needed until well past phase 1, so their .load() calls are deferred
    // until bg.mp4 itself is actually ready (see whenMediaReady below),
    // not fired here at mount.
    // finale.mp4 has separate desktop/mobile source files (same breakpoint
    // as globals.css's `min-width: 48em` desktop rules) — checked once at
    // mount, not kept in sync with later resizes/orientation changes,
    // since swapping the source mid-scrub would restart decoding from
    // scratch.
    const isDesktop = window.matchMedia("(min-width: 48em)").matches;
    /* Live MediaQueryList rather than a one-off boolean, and the same
       breakpoint globals.css's mobile block uses — read per frame in
       the rise branch, so rotating a phone picks up the other set of
       travel endpoints without a reload. */
    const phoneMq = window.matchMedia("(max-width: 47.99em)");
    // Belt-and-suspenders on top of WebCodecsPlayer's own internal
    // try/catch: whatever happens here, it must not stop this effect from
    // reaching mm.add below — that's what sets up the indicator/door
    // timelines, so a throw here would freeze the intro on the static
    // handle SVGs with no animation ever starting.
    let wipePlayer: WebCodecsPlayer | null = null;
    try {
      wipePlayer = wipeCanvas ? new WebCodecsPlayer(wipeCanvas, asset("/assets/00-threshold/bg-wipe.mp4")) : null;
    } catch (e) {
      logDebug(`wipePlayer construction failed: ${e}`);
    }
    let finalePlayer: WebCodecsPlayer | null = null;
    try {
      finalePlayer = finaleCanvas
        ? new WebCodecsPlayer(
            finaleCanvas,
            asset(isDesktop ? "/assets/00-threshold/finale-desktop.mp4" : "/assets/00-threshold/finale-mobile.mp4"),
          )
        : null;
    } catch (e) {
      logDebug(`finalePlayer construction failed: ${e}`);
    }

    const mmContext = mm.add(MOTION_OK, () => {
      if (copy) gsap.set(copy, { opacity: 1 });
      // Hidden from the start so it cannot flash during the door reveal
      // and then pop back to zero when its entrance is armed below.
      if (cueParts.length) {
        gsap.set(cueParts, cueHidden);
        scrollIndicator?.classList.add("is-cue-animated");
      }
      // Nudge zoom/glow — static, so pushed in once as custom properties
      // rather than being split between here and globals.css.
      if (scrollIndicator) {
        scrollIndicator.style.setProperty("--nudge-scale", String(CUE_NUDGE_SCALE));
        scrollIndicator.style.setProperty("--nudge-glow", CUE_NUDGE_GLOW);
        scrollIndicator.style.setProperty("--nudge-in-dur", `${CUE_NUDGE_IN_DURATION_S}s`);
        scrollIndicator.style.setProperty("--nudge-in-ease", CUE_NUDGE_IN_EASE);
        scrollIndicator.style.setProperty("--nudge-out-dur", `${CUE_NUDGE_OUT_DURATION_S}s`);
        scrollIndicator.style.setProperty("--nudge-out-ease", CUE_NUDGE_OUT_EASE);
      }


      const handles = [handleLeft, handleRight].filter(Boolean) as HTMLElement[];
      const doors = [doorLeft, doorRight];
      let seq: gsap.core.Timeline | null = null;
      let cancelled = false;
      let phase1Done = false;
      let phase1EndProgress = 0;
      let finaleVisible = false;
      let finaleCaptionShownIndex = 0;
      let smoothedWipeProgress = 0;
      let smoothedFinaleProgress = 0;

      const titleCardTl =
        titleCard && titleCardReveals.length === 3
          ? gsap
              .timeline({ paused: true })
              .to(titleCard, { opacity: 1, duration: 0.6 }, 0)
              .fromTo(titleCardReveals[0], { "--reveal": 0 }, { "--reveal": 100, duration: 0.5 }, 0.3)
              .fromTo(titleCardReveals[1], { "--reveal": 0 }, { "--reveal": 100, duration: 0.5 }, 0.6)
              .fromTo(titleCardReveals[2], { "--reveal": 0 }, { "--reveal": 100, duration: 0.55 }, 0.85)
              .addLabel("zoom", "+=0.8")
              .to(titleCardGradient, { scale: 2.3, duration: 1.7, ease: "expo.in" }, "zoom")
              .to(titleCardReveals[0], { "--reveal": 0, duration: 0.9, ease: "power1.in" }, "zoom")
              .to(titleCardReveals[1], { "--reveal": 0, duration: 0.9, ease: "power1.in" }, "zoom+=0.15")
              .to(titleCardReveals[2], { "--reveal": 0, duration: 0.9, ease: "power1.in" }, "zoom+=0.5")
              .to(titleCardVignette, { opacity: 1, duration: 0.7, ease: "power1.in" }, "zoom+=1.6")
          : null;

      let introPartsRemaining = 2;
      let bgFadeTween: gsap.core.Tween | null = null;
      const maybeStartPhase2 = () => {
        introPartsRemaining -= 1;
        if (introPartsRemaining > 0 || cancelled) return;

        // Scroll has been locked (lenis.stop(), in page.tsx) since before
        // this component even mounted, so nothing can race this fade: it
        // plays out on its own clock with zero scroll input reaching the
        // page, and only once it's visually finished do we hand control
        // back — from this exact, repeatable point every time.
        // bg--main fades out; bgShot sits at full opacity underneath it
        // the whole time (no fade-in of its own), so fading bg out is what
        // reveals it — a fade-out only, not a crossfade.
        if (bgShot) gsap.set(bgShot, { opacity: 1 });
        bgFadeTween = gsap.to(bg, {
          opacity: 0,
          duration: BG_FADE_DURATION,
          ease: "sine.inOut",
          onComplete: () => {
            if (cancelled) return;
            phase1Done = true;
            phase1EndProgress = st.progress;
            if (wipeCanvas) gsap.set(wipeCanvas, { opacity: 1 });
            getLenis()?.start();
            armNudgeIdle();
          },
        });
      };

      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: PIN_LENGTH,
        pin,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // No scroll-cap/reset needed here anymore: lenis.stop() (in
          // page.tsx) blocks scroll input at the source for the whole
          // auto-intro + bg-fade handoff, so self.progress simply can't
          // move past where it was at mount until maybeStartPhase2's
          // onComplete calls lenis.start() and sets phase1Done.
          // Scrubbed, not timed: the cue's opacity IS the scroll
          // position over the first CUE_OUT_SCROLL_PX, so it tracks the
          // finger and returns if the visitor scrolls back up. Sits
          // ahead of the phase-1 guard below because it only depends on
          // scroll, and rides the wrapper so it never collides with the
          // entrance tween on the letters.
          // ...but only for scrolling the VISITOR did. The nudge drives
          // the real scroll position forward and back on its own, which
          // would otherwise fade the cue to 0 and in again on every
          // nudge — precisely while .is-nudging is scaling and glowing
          // it to draw the eye there. The nudge already marks the
          // element for its duration, so the scrub simply defers to that
          // mark and holds; a real gesture clears it (onNudgeGesture)
          // and the scrub picks straight back up.
          if (scrollIndicator && !scrollIndicator.classList.contains("is-nudging")) {
            const out = gsap.utils.clamp(0, 1, self.scroll() / CUE_OUT_SCROLL_PX);
            gsap.set(scrollIndicator, { opacity: 1 - out });
          }

          if (!phase1Done || !wipeCanvas) return;
          const remaining = 1 - phase1EndProgress;
          const rawProgress = remaining > 0 ? (self.progress - phase1EndProgress) / remaining : 1;

          // bgShot fades out over the first BG_SHOT_FADE_FRACTION of scroll
          // past unlock, revealing wipeCanvas underneath. wipeCanvas's own
          // scrub is held at 0 until that's done (see the constant's
          // comment) so it can't flash ahead of its first frame even if
          // that fraction gets scrolled through in one fast swipe.
          const wipeProgress = gsap.utils.clamp(
            0,
            1,
            (rawProgress - BG_SHOT_FADE_FRACTION) / (WIPE_FRACTION - BG_SHOT_FADE_FRACTION),
          );
          smoothedWipeProgress = smoothProgress(smoothedWipeProgress, wipeProgress);
          wipePlayer?.seekToProgress(smoothedWipeProgress);
          if (copy) gsap.set(copy, { autoAlpha: wipeBrightness(smoothedWipeProgress) });

          if (bgShot) {
            const shotFadeProgress = gsap.utils.clamp(0, 1, rawProgress / BG_SHOT_FADE_FRACTION);
            gsap.set(bgShot, { opacity: 1 - shotFadeProgress });
          }

          if (titleCardTl) {
            const titleProgress = gsap.utils.clamp(0, 1, (rawProgress - WIPE_FRACTION) / TITLE_FRACTION);
            titleCardTl.progress(titleProgress);
          }

          if (finaleCanvas) {
            const finaleFraction = 1 - WIPE_FRACTION - TITLE_FRACTION;
            const finaleRaw = (rawProgress - WIPE_FRACTION - TITLE_FRACTION) / finaleFraction;
            const finaleActive = finaleRaw > 0;
            if (finaleActive !== finaleVisible) {
              finaleVisible = finaleActive;
              gsap.set(finaleCanvas, { opacity: finaleActive ? 1 : 0 });
            }
            const finaleProgress = gsap.utils.clamp(0, 1, finaleRaw);
            if (finaleActive && finalePlayer) {
              smoothedFinaleProgress = smoothProgress(smoothedFinaleProgress, finaleProgress);
              finalePlayer.seekToProgress(smoothedFinaleProgress);
            }

            // Shared beat math for both caption transitions — which two
            // captions are adjacent and how far through their shared
            // boundary window scroll currently is. Directly scrubbed (no
            // timeline), so scrolling back reverses either transition. All
            // the numbers below live in lib/scrollIncentives.ts.
            const n = CAPTION_BEAT_STARTS_PCT.length;
            const half = CAPTION_TRANSITION_WINDOW / 2;
            let fromIdx = 0;
            for (let i = 0; i < n; i++) {
              if (finaleProgress * 100 >= CAPTION_BEAT_STARTS_PCT[i]) fromIdx = i;
            }
            let toIdx = fromIdx;
            let rawT = 0;
            for (let k = 1; k < n; k++) {
              const boundary = CAPTION_BEAT_STARTS_PCT[k] / 100;
              if (finaleProgress >= boundary - half && finaleProgress <= boundary + half) {
                fromIdx = k - 1;
                toIdx = k;
                rawT = gsap.utils.clamp(0, 1, (finaleProgress - (boundary - half)) / CAPTION_TRANSITION_WINDOW);
                break;
              }
            }
            // The whole block also fades in/out at the very start/end of
            // the finale phase itself, not just between captions.
            const edgeFade = gsap.utils.clamp(
              0,
              1,
              Math.min(finaleProgress / CAPTION_EDGE_FADE, (1 - finaleProgress) / CAPTION_EDGE_FADE),
            );

            if (CAPTION_TRANSITION === "travel" && finaleCaption && finaleCaptionEyebrow && finaleCaptionTitle) {
              // One block glides between alternating sides — content swaps
              // at the glide's midpoint, old fading out over the first
              // half and new fading in over the second.
              const easedT = captionEase(rawT);
              const xDist = isDesktop ? CAPTION_TRAVEL_DISTANCE_VW.desktop : CAPTION_TRAVEL_DISTANCE_VW.mobile;
              const homeX = (i: number) => (i % 2 === 0 ? -xDist : xDist);
              const x = gsap.utils.interpolate(homeX(fromIdx), homeX(toIdx), easedT);
              const drift = Math.sin(rawT * Math.PI) * CAPTION_TRAVEL_DRIFT_PX;

              const showIdx = rawT < CAPTION_CROSSFADE_SPLIT ? fromIdx : toIdx;
              if (showIdx !== finaleCaptionShownIndex) {
                finaleCaptionShownIndex = showIdx;
                finaleCaptionEyebrow.textContent = FINALE_CAPTIONS[showIdx].eyebrow;
                finaleCaptionTitle.textContent = FINALE_CAPTIONS[showIdx].title;
              }
              const crossfade =
                rawT < CAPTION_CROSSFADE_SPLIT
                  ? 1 - rawT / CAPTION_CROSSFADE_SPLIT
                  : (rawT - CAPTION_CROSSFADE_SPLIT) / (1 - CAPTION_CROSSFADE_SPLIT);
              gsap.set(finaleCaption, {
                xPercent: -50,
                yPercent: -50,
                x: `${x}vw`,
                y: drift,
                opacity: crossfade * edgeFade,
              });
            } else if (
              CAPTION_TRANSITION === "ink" &&
              finaleInk &&
              finaleInkOld &&
              finaleInkOldEyebrow &&
              finaleInkOldTitle &&
              finaleInkNew &&
              finaleInkNewEyebrow &&
              finaleInkNewTitle &&
              finaleInkStroke
            ) {
              // Caption stays put on its beat's side; a brush stroke sweeps
              // across just that block — 1:1 with scroll, no easing — and
              // wipes the old line away to reveal the new one behind it.
              finaleInk.classList.toggle("finale-ink--left", FINALE_CAPTIONS[toIdx].side === "left");
              finaleInk.classList.toggle("finale-ink--right", FINALE_CAPTIONS[toIdx].side === "right");
              gsap.set(finaleInk, { opacity: edgeFade });
              finaleInkOldEyebrow.textContent = FINALE_CAPTIONS[fromIdx].eyebrow;
              finaleInkOldTitle.textContent = FINALE_CAPTIONS[fromIdx].title;
              finaleInkNewEyebrow.textContent = FINALE_CAPTIONS[toIdx].eyebrow;
              finaleInkNewTitle.textContent = FINALE_CAPTIONS[toIdx].title;

              const sweepT = Math.min(1, rawT / INK_SWEEP_FRACTION);
              const dryT = gsap.utils.clamp(0, 1, (rawT - INK_SWEEP_FRACTION) / (1 - INK_SWEEP_FRACTION));
              const sweepPct = sweepT * 100;
              const pts = INK_EDGE_JITTER_PCT.map((j) => gsap.utils.clamp(0, 100, sweepPct + j));
              const curve = pts.map((px, i) => `${px}% ${((i / (pts.length - 1)) * 100).toFixed(1)}%`).join(", ");
              finaleInkOld.style.clipPath = `polygon(${curve}, 100% 100%, 100% 0%)`;
              finaleInkNew.style.clipPath = `polygon(0% 0%, ${curve}, 0% 100%)`;
              gsap.set(finaleInkStroke, {
                left: `${sweepPct - INK_STROKE_WIDTH_PCT / 2}%`,
                opacity: (1 - dryT) * (rawT > 0.001 && rawT < 0.999 ? 1 : 0),
              });
            } else if (
              CAPTION_TRANSITION === "reveal" &&
              finaleReveal &&
              finaleRevealEyebrow &&
              finaleRevealTitle
            ) {
              // Same technique as the title card's "from / The Heart Of
              // Japan": a left-to-right [data-reveal] mask-wipe. The old
              // caption wipes itself away (reveal 100→0) over the first
              // half of the transition, then the new one wipes itself in
              // (0→100) over the second — content swaps at that midpoint.
              const showIdx = rawT < CAPTION_CROSSFADE_SPLIT ? fromIdx : toIdx;
              if (showIdx !== finaleCaptionShownIndex) {
                finaleCaptionShownIndex = showIdx;
                finaleRevealEyebrow.textContent = FINALE_CAPTIONS[showIdx].eyebrow;
                finaleRevealTitle.textContent = FINALE_CAPTIONS[showIdx].title;
              }
              finaleReveal.classList.toggle("finale-reveal--left", FINALE_CAPTIONS[showIdx].side === "left");
              finaleReveal.classList.toggle("finale-reveal--right", FINALE_CAPTIONS[showIdx].side === "right");
              const reveal =
                rawT < CAPTION_CROSSFADE_SPLIT
                  ? 100 * (1 - rawT / CAPTION_CROSSFADE_SPLIT)
                  : 100 * ((rawT - CAPTION_CROSSFADE_SPLIT) / (1 - CAPTION_CROSSFADE_SPLIT));
              gsap.set(finaleReveal, { opacity: edgeFade });
              gsap.set([finaleRevealEyebrow, finaleRevealTitle], { "--reveal": reveal });
            } else if (CAPTION_TRANSITION === "rise" && finaleRise && finaleRiseItems.length) {
              // All four captions live in the DOM the whole time, each
              // rising on its own beat — no shared from/to pair like the
              // other modes, since neighbours overlap instead of handing
              // off at a single boundary.
              finaleRiseItems.forEach((item, i) => {
                const nominalStart = CAPTION_BEAT_STARTS_PCT[i] / 100;
                const nominalEnd = i + 1 < n ? CAPTION_BEAT_STARTS_PCT[i + 1] / 100 : 1;
                const beatDuration = nominalEnd - nominalStart;
                const overlapAmount = RISE_OVERLAP * beatDuration;
                const activeStart = Math.max(0, nominalStart - overlapAmount);
                const activeEnd = Math.min(1, nominalEnd + overlapAmount);
                const span = activeEnd - activeStart;
                const localT = span > 0 ? gsap.utils.clamp(0, 1, (finaleProgress - activeStart) / span) : 0;

                // Glued-to-scroll position would be (0.5 - localT) * 100%
                // of its full travel; the speed factors scale that down
                // so it visibly lags the scroll instead of tracking it
                // 1:1. English and kanji take the SAME journey over the
                // same window but at different factors, so they separate
                // on the way up and close again at the ends — parallax
                // depth rather than two independent animations.
                const lane = phoneMq.matches ? "mobile" : "desktop";
                const from = RISE_TRAVEL_FROM_VH[lane];
                const travel = from + (RISE_TRAVEL_TO_VH[lane] - from) * localT;
                const fade =
                  localT < RISE_FADE_EDGE
                    ? localT / RISE_FADE_EDGE
                    : localT > 1 - RISE_FADE_EDGE
                      ? (1 - localT) / RISE_FADE_EDGE
                      : 1;
                // Both layers get the SAME opacity curve so the pair
                // never splits apart visually. It is applied to each of
                // them rather than to their shared parent on purpose:
                // an element with opacity < 1 forms an isolated group,
                // and an isolated item would cut the kanji's dodge off
                // from the finale video it is supposed to brighten.
                const layerOpacity = fade * edgeFade;
                if (finaleRiseTexts[i]) gsap.set(finaleRiseTexts[i], { y: `${travel * RISE_SPEED_FACTOR}vh`, opacity: layerOpacity });
                if (finaleRiseKanji[i]) gsap.set(finaleRiseKanji[i], { y: `${travel * RISE_KANJI_SPEED_FACTOR}vh`, opacity: layerOpacity });
              });
            }
          }
        },
      });

      // ── NUDGE (flagged, see lib/scrollIncentives.ts) ─────────────────
      // If the visitor sits on the hero without touching anything, nudge
      // the real scroll position forward a little — a hint that the page
      // scrolls, not a hijack: it defers instantly to any real wheel/touch
      // input, and the real scroll just continues from wherever the nudge
      // happened to be (Lenis blends live input into an in-flight
      // animated scrollTo on its own). Fires after each delay in
      // NUDGE_IDLE_DELAYS_MS in turn — never while the visitor has
      // actually engaged with scrolling.
      let nudgeCount = 0;
      let nudgeActive = false;
      let nudgeEngaged = false;
      let nudgeIdleTimer = 0;
      let nudgeHoldTimer = 0;
      const nudgeEase = gsap.parseEase("power2.inOut");

      const armNudgeIdle = () => {
        if (!NUDGE_ENABLED || cancelled || nudgeEngaged || nudgeCount >= NUDGE_IDLE_DELAYS_MS.length) return;
        window.clearTimeout(nudgeIdleTimer);
        nudgeIdleTimer = window.setTimeout(runNudge, NUDGE_IDLE_DELAYS_MS[nudgeCount]);
      };

      function runNudge() {
        if (
          !NUDGE_ENABLED ||
          cancelled ||
          nudgeEngaged ||
          nudgeActive ||
          nudgeCount >= NUDGE_IDLE_DELAYS_MS.length ||
          !phase1Done
        )
          return;
        const remaining = 1 - phase1EndProgress;
        const rawProgress = remaining > 0 ? (st.progress - phase1EndProgress) / remaining : 1;
        if (rawProgress > 0.01) return; // already past the hero — not our job anymore

        const lenis = getLenis();
        if (!lenis) return;

        nudgeActive = true;
        nudgeCount += 1;
        // The scroll cue is otherwise easy to miss — make it unmistakable
        // for the duration of the nudge itself (see .is-nudging in
        // globals.css), not just the scroll position moving.
        // Two marks, deliberately: is-nudging spans the WHOLE nudge and
        // is what the opacity scrub defers to, while is-nudge-peak drives
        // the zoom and comes off as soon as the page turns for home. One
        // class could not do both — dropping it early would let the
        // scrub fade the cue out across the return.
        scrollIndicatorRef.current?.classList.add("is-nudging", "is-nudge-peak");
        const target = st.start + (phase1EndProgress + 0.06 * remaining) * (st.end - st.start);
        lenis.scrollTo(target, {
          duration: NUDGE_OUT_DURATION_S,
          easing: nudgeEase,
          onComplete: () => {
            if (!nudgeActive) return;
            nudgeHoldTimer = window.setTimeout(() => {
              if (!nudgeActive) return;
              // Zoom out starts HERE, with the return itself.
              scrollIndicatorRef.current?.classList.remove("is-nudge-peak");
              lenis.scrollTo(st.start, {
                duration: NUDGE_RETURN_DURATION_S,
                easing: nudgeEase,
                onComplete: () => {
                  nudgeActive = false;
                  scrollIndicatorRef.current?.classList.remove("is-nudging");
                  armNudgeIdle();
                },
              });
            }, NUDGE_HOLD_MS);
          },
        });
      }

      const onNudgeGesture = () => {
        if (nudgeActive) {
          nudgeActive = false;
          // Both marks go: the visitor has taken over, so the cue should
          // relax AND hand its opacity straight back to the scrub.
          scrollIndicatorRef.current?.classList.remove("is-nudging", "is-nudge-peak");
          window.clearTimeout(nudgeHoldTimer);
        }
        if (!nudgeEngaged) {
          nudgeEngaged = true;
          window.clearTimeout(nudgeIdleTimer);
        }
      };
      if (NUDGE_ENABLED) {
        window.addEventListener("wheel", onNudgeGesture, { passive: true });
        window.addEventListener("touchstart", onNudgeGesture, { passive: true });
        window.addEventListener("pointerdown", onNudgeGesture);
      }

      // The intro clip ending is one of the two things that unlock scroll.
      // If a phone never plays it (iOS Low Power Mode, a stalled load),
      // "ended" never fires and the page would stay locked forever — so a
      // failed play() or a timeout past the clip's length counts too.
      let bgPartDone = false;
      let bgSafetyTimer = 0;
      const finishBgPart = () => {
        if (bgPartDone) return;
        bgPartDone = true;
        window.clearTimeout(bgSafetyTimer);
        maybeStartPhase2();
      };
      bg.addEventListener("ended", finishBgPart, { once: true });

      // "Skip the intro" lands on the experience section, which starts exactly
      // where this pin's scroll-jacked timeline ends — a plain anchor jump
      // would resolve against static layout instead, so scroll the real
      // scroller (Lenis) to the pin's end directly.
      const skipLink = document.querySelector(".skip-link");
      const onSkip = (e: Event) => {
        e.preventDefault();
        // Scroll may still be locked (lenis.stop(), see maybeStartPhase2)
        // if this is clicked before the auto-intro/handoff finished on its
        // own — unlock first or the jump below is silently swallowed.
        getLenis()?.start();
        getLenis()?.scrollTo(st.end, { immediate: true });
      };
      skipLink?.addEventListener("click", onSkip);

      function whenMediaReady(media: Array<HTMLImageElement | HTMLVideoElement | null>, timeoutMs = 8000) {
        return Promise.all(
          media.filter((el): el is HTMLImageElement | HTMLVideoElement => !!el).map(
            (el) =>
              new Promise<void>((resolve) => {
                const isVideo = el.tagName === "VIDEO";
                if (isVideo) {
                  // Desktop: readyState 4 / canplaythrough — the browser's own
                  // estimate that it can play through without stalling.
                  // Mobile: iOS doesn't buffer a not-yet-playing video that
                  // far, so canplaythrough never fires and the intro would
                  // sit on the timeout — start on the first frame instead.
                  const isMobile = window.matchMedia("(max-width: 47.99em)").matches;
                  const [minState, event] = isMobile ? [2, "loadeddata"] : [4, "canplaythrough"];
                  if ((el as HTMLVideoElement).readyState >= minState) return resolve();
                  el.addEventListener(event, () => resolve(), { once: true });
                } else {
                  if ((el as HTMLImageElement).complete) return resolve();
                  el.addEventListener("load", () => resolve(), { once: true });
                }
                el.addEventListener("error", () => resolve(), { once: true });
                setTimeout(resolve, timeoutMs);
              }),
          ),
        );
      }

      // The handles-filling-then-doors-fading-in animation now doubles as
      // the loading indicator: it starts immediately at mount (unlike the
      // reveal below, it isn't gated on whenMediaReady) so there's visible
      // feedback the instant the page loads instead of a blank black
      // screen for however long assets take. Its own pacing is untouched.
      const indicatorTl = gsap.timeline({ defaults: { ease: "none" } });
      if (handles.length) {
        indicatorTl.to(handles, { "--fill": 100, duration: 2.0 * PACE, ease: "power2.inOut" });
      }
      indicatorTl.to(doors, { opacity: 1, duration: 1 * PACE, ease: "power1.out" }, `+=${0.15 * PACE}`);
      // The label belongs to the handle-fill stage only: it reads as the
      // handles' own caption while they fill, and the doors fading up is
      // what ends that stage. "<" starts it with that fade rather than
      // after it, so the two cross over instead of queueing.
      if (loadingLabel) {
        indicatorTl.to(loadingLabel, { autoAlpha: 0, duration: 1 * PACE, ease: "power1.out" }, "<");
      }
      const indicatorDone = new Promise<void>((resolve) => {
        indicatorTl.eventCallback("onComplete", () => resolve());
      });

      // The door-opening reveal waits for BOTH signals — whichever finishes
      // later wins. On a fast connection, media is ready well before the
      // indicator finishes playing, so nothing changes: the indicator just
      // runs its full course exactly as before, then doors open. On a slow
      // one, the indicator finishes and holds at "doors lit, closed" — a
      // sensible paused state, not a freeze — until media actually catches
      // up.
      Promise.all([indicatorDone, whenMediaReady([bg, bgShot, doorLeft, doorRight, handleLeft, handleRight])]).then(() => {
        if (cancelled) return;

        // Deferred from mount (see the comment by wipePlayer/finalePlayer's
        // construction) — bg.mp4 now has priority on the network, and
        // neither of these is needed until well past phase 1's own ~8s
        // runtime, so starting them here costs nothing in practice.
        wipePlayer?.load();
        finalePlayer?.load();

        seq = gsap.timeline({ defaults: { ease: "none" }, onComplete: maybeStartPhase2 });

        const doorOpenStart = 0.4 * PACE;
        const doorOpenDuration = 1.8 * PACE;

        seq
          .fromTo(bg, { opacity: 0 }, { opacity: 1, duration: doorOpenDuration, ease: "power2.inOut" }, doorOpenStart)
          .call(
            () => {
              // Real intro playback is starting now — any gesture-triggered
              // priming after this point would only ever hit an already-
              // playing or already-ended video, so disarm it here rather
              // than leaving it armed to misfire later (see primeVideo
              // above: calling .play() on an ended video resets it to
              // frame 0, which used to flash during the phase-1→2 fade if
              // the user's first touch/scroll landed after the video end).
              disablePriming();
              bg.currentTime = 0;
              bg.play().catch(() => armPlayRetry());
              const clipMs = (isFinite(bg.duration) && bg.duration > 0 ? bg.duration : 4) * 1000;
              bgSafetyTimer = window.setTimeout(finishBgPart, clipMs + 2500);
            },
            undefined,
            doorOpenStart,
          )
          .to(
            [doorLeft, handleLeft, handleBaseLeft].filter(Boolean) as HTMLElement[],
            { xPercent: -101, duration: doorOpenDuration, ease: "power2.inOut" },
            doorOpenStart,
          )
          .to(
            [doorRight, handleRight, handleBaseRight].filter(Boolean) as HTMLElement[],
            { xPercent: 101, duration: doorOpenDuration, ease: "power2.inOut" },
            doorOpenStart,
          )
          .to(bg, { scale: 1, duration: doorOpenDuration, ease: "power2.inOut" }, doorOpenStart)
          // The hero UI is already "inside" the room: it sits under the doors
          // (see z-index in globals.css) and is simply revealed as they open,
          // no separate fade-in.
          .set([...lines, ctaGroup].filter(Boolean) as HTMLElement[], { opacity: 1, y: 0 }, doorOpenStart);


        // The cue is part of what the doors reveal, not a follow-up to
        // it: its entrance rides the same timeline from the instant they
        // start opening, so it is simply there as the room appears.
        // Living on `seq` also means it inherits the intro's own clock —
        // if media is slow and the reveal starts late, the cue is still
        // in step with the doors rather than off on a timer of its own.
        if (cueParts.length) {
          seq.to(
            cueParts,
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: CUE_IN_DURATION_S,
              ease: CUE_IN_EASE,
              stagger: CUE_IN_STAGGER_S,
              onComplete: () => scrollIndicator?.classList.add("is-cue-ready"),
            },
            doorOpenStart + CUE_IN_DELAY_S,
          );
        }

        if (chrome) {
          // The header sits under the doors (see ThresholdDoors), so it's
          // simply switched on as they start to open and revealed by them.
          seq.set(chrome, { autoAlpha: 1 }, doorOpenStart);
        }
      });

      return () => {
        cancelled = true;
        st.kill();
        indicatorTl.kill();
        seq?.kill();
        bgFadeTween?.kill();
        titleCardTl?.kill();
        bg.removeEventListener("ended", finishBgPart);
        window.clearTimeout(bgSafetyTimer);
        skipLink?.removeEventListener("click", onSkip);
        window.clearTimeout(nudgeIdleTimer);
        window.clearTimeout(nudgeHoldTimer);
        window.removeEventListener("wheel", onNudgeGesture);
        window.removeEventListener("touchstart", onNudgeGesture);
        window.removeEventListener("pointerdown", onNudgeGesture);
        bg.pause();
        // Guards against unmounting mid-intro/mid-fade leaving scroll
        // permanently locked — a no-op if it was already started.
        if (!phase1Done) getLenis()?.start();
        wipePlayer?.destroy();
        finalePlayer?.destroy();
        if (wipeCanvas) gsap.set(wipeCanvas, { clearProps: "all" });
        if (finaleCanvas) gsap.set(finaleCanvas, { clearProps: "all" });
        if (finaleCaption) gsap.set(finaleCaption, { clearProps: "all" });
        if (finaleInk) gsap.set(finaleInk, { clearProps: "all" });
        if (finaleInkStroke) gsap.set(finaleInkStroke, { clearProps: "all" });
        if (finaleInkOld) finaleInkOld.style.clipPath = "";
        if (finaleInkNew) finaleInkNew.style.clipPath = "";
        if (finaleReveal) gsap.set(finaleReveal, { clearProps: "all" });
        if (finaleRevealEyebrow) gsap.set(finaleRevealEyebrow, { clearProps: "all" });
        if (finaleRevealTitle) gsap.set(finaleRevealTitle, { clearProps: "all" });
        if (cueParts.length) gsap.set(cueParts, { clearProps: "all" });
        if (scrollIndicator) {
          gsap.set(scrollIndicator, { clearProps: "all" });
          scrollIndicator.classList.remove("is-cue-animated", "is-cue-ready");
        }
        if (finaleRiseItems.length) gsap.set(finaleRiseItems, { clearProps: "all" });
        if (finaleRiseTexts.length) gsap.set([...finaleRiseTexts, ...finaleRiseKanji], { clearProps: "all" });
        gsap.set([copy, lines, ctaGroup, bg, doorLeft, doorRight].filter(Boolean) as HTMLElement[], { clearProps: "all" });
        if (bgShot) gsap.set(bgShot, { clearProps: "all" });
        if (chrome) gsap.set(chrome, { clearProps: "all" });
        if (handleLeft) gsap.set(handleLeft, { clearProps: "all" });
        if (handleRight) gsap.set(handleRight, { clearProps: "all" });
        if (handleBaseLeft) gsap.set(handleBaseLeft, { clearProps: "all" });
        if (handleBaseRight) gsap.set(handleBaseRight, { clearProps: "all" });
        if (loadingLabel) gsap.set(loadingLabel, { clearProps: "all" });
        if (titleCard) gsap.set(titleCard, { clearProps: "all" });
        if (titleCardGradient) gsap.set(titleCardGradient, { clearProps: "all" });
        if (titleCardVignette) gsap.set(titleCardVignette, { clearProps: "all" });
        if (titleCardReveals.length) gsap.set(titleCardReveals, { clearProps: "all" });
      };
    });

    mm.add(MOTION_REDUCED, () => {
      // "rise" is the one transition that still shows something here — a
      // plain timed crossfade through the four captions in place, since
      // there's no scroll-jacked sequence to scrub under reduced motion.
      let riseInterval = 0;
      let riseActiveIndex = 0;

      const stReduced = ScrollTrigger.create({
        trigger: section,
        start: "top 80%",
        once: true,
        onEnter: () => {
          section.classList.add("is-visible");
          chrome?.classList.add("is-visible");

          if (CAPTION_TRANSITION === "rise" && finaleRiseItems.length) {
            // Same split as the scrolled path: fade the two layers, not
            // the item, so the kanji keeps blending with the video.
            const riseLayers = (i: number) =>
              [finaleRiseTexts[i], finaleRiseKanji[i]].filter(Boolean) as HTMLElement[];
            gsap.set([...finaleRiseTexts, ...finaleRiseKanji], { y: 0, opacity: 0 });
            gsap.set(riseLayers(0), { opacity: 1 });
            riseInterval = window.setInterval(() => {
              const next = (riseActiveIndex + 1) % finaleRiseItems.length;
              gsap.to(riseLayers(riseActiveIndex), { opacity: 0, duration: 0.6 });
              gsap.to(riseLayers(next), { opacity: 1, duration: 0.6 });
              riseActiveIndex = next;
            }, 3200);
          }
        },
      });

      return () => {
        stReduced.kill();
        window.clearInterval(riseInterval);
        section.classList.remove("is-visible");
        chrome?.classList.remove("is-visible");
      };
    });

    return () => {
      mmContext.revert();
      window.removeEventListener("touchstart", primeVideo);
      window.removeEventListener("pointerdown", primeVideo);
      window.removeEventListener("wheel", primeVideo);
      window.removeEventListener("touchstart", retryBgPlay);
      window.removeEventListener("pointerdown", retryBgPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={sectionRef}
      className="scene scene--threshold"
      id="scene-00"
      data-scene="00"
      aria-label="Chapter 00, Threshold"
    >
      <div className="scene__pin" ref={pinRef}>
        <div className="threshold" aria-hidden="true">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={bgRef}
            className="threshold__bg threshold__bg--main"
            src={asset("/assets/00-threshold/bg.mp4")}
            width={1280}
            height={720}
            muted
            playsInline
            preload="auto"
          />
          <canvas ref={wipeCanvasRef} className="threshold__bg threshold__bg--wipe-canvas" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={bgShotRef}
            className="threshold__bg-shot"
            src={asset("/assets/00-threshold/bg-first-shot.webp")}
            alt=""
            width={1920}
            height={1080}
            aria-hidden="true"
            decoding="async"
          />
          <div className="threshold__vignette" aria-hidden="true" />
        </div>

        <div className="scene__copy" ref={copyRef}>
          <div className="scene__copy-content">
            <p className="display">
              <span className="display__line" ref={line1Ref}>
                A Taste Of Japan
              </span>
              <span className="display__line" ref={line2Ref}>
                An Experience Beyond
              </span>
            </p>
            <div className="scene__cta-group" ref={ctaGroupRef}>
              <Button type="button" onClick={openReserve} variant="primary" aria-label="Reserve a table">
                Reserve
              </Button>
              <Button href={asset("/menu")} variant="secondary" aria-label="View menu">
                View Menu
              </Button>
            </div>
            <div className="scene__scroll-indicator" ref={scrollIndicatorRef} aria-hidden="true">
              <p className="scene__scroll-indicator-label">
                {Array.from("Step Inside", (ch, i) => (
                  <span key={i} className="scene__scroll-indicator-letter">
                    {ch === " " ? "\u00A0" : ch}
                  </span>
                ))}
              </p>
              <svg
                className="scene__scroll-indicator-line"
                width="6"
                height="40"
                viewBox="0 0 6 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M3 0V37.5" stroke="white" strokeWidth="1.5" />
                <circle cx="3" cy="37.5" r="2.5" fill="white" />
              </svg>
            </div>
          </div>
        </div>

        <div className="title-card" ref={titleCardRef} aria-hidden="true">
          <div className="title-card__world">
            <div className="title-card__gradient" ref={titleCardGradientRef} />
          </div>
          <div className="title-card__copy">
            <p className="title-card__eyebrow" data-reveal ref={eyebrowRef}>
              from
            </p>
            <p className="title-card__title">
              <span className="title-card__title-line" data-reveal ref={titleLine1Ref}>
                The Heart
              </span>
              <span className="title-card__title-line" data-reveal ref={titleLine2Ref}>
                Of Japan
              </span>
            </p>
          </div>
          <div className="title-card__vignette" ref={titleCardVignetteRef} aria-hidden="true" />
        </div>

        <canvas ref={finaleCanvasRef} className="finale__canvas" aria-hidden="true" />

        {CAPTION_TRANSITION === "travel" && (
          <div className="finale-caption" ref={finaleCaptionRef} aria-hidden="true">
            <p className="finale-caption__eyebrow" ref={finaleCaptionEyebrowRef}>
              {FINALE_CAPTIONS[0].eyebrow}
            </p>
            <p className="finale-caption__title" ref={finaleCaptionTitleRef}>
              {FINALE_CAPTIONS[0].title}
            </p>
          </div>
        )}

        {CAPTION_TRANSITION === "ink" && (
          <div
            className={`finale-ink finale-ink--${FINALE_CAPTIONS[0].side}`}
            ref={finaleInkRef}
            aria-hidden="true"
          >
            <div className="finale-ink__old" ref={finaleInkOldRef}>
              <p className="finale-caption__eyebrow" ref={finaleInkOldEyebrowRef}>
                {FINALE_CAPTIONS[0].eyebrow}
              </p>
              <p className="finale-caption__title" ref={finaleInkOldTitleRef}>
                {FINALE_CAPTIONS[0].title}
              </p>
            </div>
            <div className="finale-ink__new" ref={finaleInkNewRef}>
              <p className="finale-caption__eyebrow" ref={finaleInkNewEyebrowRef}>
                {FINALE_CAPTIONS[0].eyebrow}
              </p>
              <p className="finale-caption__title" ref={finaleInkNewTitleRef}>
                {FINALE_CAPTIONS[0].title}
              </p>
            </div>
            <div className="finale-ink__stroke" ref={finaleInkStrokeRef} />
          </div>
        )}

        {CAPTION_TRANSITION === "reveal" && (
          <div
            className={`finale-reveal finale-reveal--${FINALE_CAPTIONS[0].side}`}
            ref={finaleRevealRef}
            aria-hidden="true"
          >
            <p className="finale-caption__eyebrow" data-reveal ref={finaleRevealEyebrowRef}>
              {FINALE_CAPTIONS[0].eyebrow}
            </p>
            <p className="finale-caption__title" data-reveal ref={finaleRevealTitleRef}>
              {FINALE_CAPTIONS[0].title}
            </p>
          </div>
        )}

        {CAPTION_TRANSITION === "rise" && (
          <div className="finale-rise" ref={finaleRiseRef} aria-hidden="true">
            {FINALE_CAPTIONS.map((c) => (
              <div key={c.title} className={`finale-rise__item finale-rise__item--${c.side}`}>
                <span className="finale-rise__kanji">{c.kanji}</span>
                <div className="finale-rise__text">
                  <p className="finale-caption__eyebrow">{c.eyebrow}</p>
                  <p className="finale-caption__title">{c.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
