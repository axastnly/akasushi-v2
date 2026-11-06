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
import { asset } from "@/lib/paths";
import Button from "./Button";
import { useReserveModal } from "./ReserveModalProvider";

/* Ported from the Vite site's scene-00-threshold.js — same four-phase
   choreography (auto intro → wipe scrub → title card → finale scrub),
   same pin/ScrollTrigger mechanics. The only real change: phases 2 and 4
   scrub WebCodecsPlayer instances instead of seeking <video> elements or
   drawing pre-extracted AVIF frames — see lib/webcodecsPlayer.ts. */

// Phase lengths in viewport-heights of scroll. Wipe and title card are
// unchanged from the original site (0.28 / 0.22 of +=650%). The finale was
// 325vh for the original 25.08s clip; finale-*.mp4 is now trimmed to end on
// its pitch-black frame (~14.3s), so its share shrinks proportionally
// (325 × 14.33 / 25.08 ≈ 186vh) to keep the same scroll-per-second scrub feel.
const WIPE_VH = 182;
const TITLE_VH = 143;
const FINALE_VH = 186;
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
const FINALE_DIM_START = 0.92;
const FINALE_DIM_MAX = 35;
const PACE = 1.4;

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
  const doorLeftRef = useRef<HTMLImageElement>(null);
  const doorRightRef = useRef<HTMLImageElement>(null);
  const handleLeftRef = useRef<HTMLImageElement>(null);
  const handleRightRef = useRef<HTMLImageElement>(null);
  const handleBaseLeftRef = useRef<HTMLImageElement>(null);
  const handleBaseRightRef = useRef<HTMLImageElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const ctaGroupRef = useRef<HTMLDivElement>(null);
  const titleCardRef = useRef<HTMLDivElement>(null);
  const titleCardGradientRef = useRef<HTMLDivElement>(null);
  const titleCardTreesRef = useRef<HTMLImageElement>(null);
  const titleCardBirdsRef = useRef<HTMLImageElement>(null);
  const titleCardVignetteRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const titleLine1Ref = useRef<HTMLSpanElement>(null);
  const titleLine2Ref = useRef<HTMLSpanElement>(null);
  const finaleCanvasRef = useRef<HTMLCanvasElement>(null);
  const finaleDimRef = useRef<HTMLDivElement>(null);

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
    const wipeCanvas = wipeCanvasRef.current;
    const doorLeft = doorLeftRef.current!;
    const doorRight = doorRightRef.current!;
    const handleLeft = handleLeftRef.current;
    const handleRight = handleRightRef.current;
    const handleBaseLeft = handleBaseLeftRef.current;
    const handleBaseRight = handleBaseRightRef.current;
    const copy = copyRef.current;
    const lines = [line1Ref.current, line2Ref.current].filter(Boolean) as HTMLElement[];
    const ctaGroup = ctaGroupRef.current;
    const titleCard = titleCardRef.current;
    const titleCardGradient = titleCardGradientRef.current;
    const titleCardTrees = titleCardTreesRef.current;
    const titleCardBirds = titleCardBirdsRef.current;
    const titleCardVignette = titleCardVignetteRef.current;
    const titleCardReveals = [eyebrowRef.current, titleLine1Ref.current, titleLine2Ref.current].filter(
      Boolean,
    ) as HTMLElement[];
    const finaleCanvas = finaleCanvasRef.current;
    const finaleDim = finaleDimRef.current;
    const chrome = document.querySelector(".chrome");

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
    const wipePlayer = wipeCanvas ? new WebCodecsPlayer(wipeCanvas, asset("/assets/00-threshold/bg-wipe.mp4")) : null;
    const finalePlayer = finaleCanvas
      ? new WebCodecsPlayer(
          finaleCanvas,
          asset(isDesktop ? "/assets/00-threshold/finale-desktop.mp4" : "/assets/00-threshold/finale-mobile.mp4"),
        )
      : null;

    const mmContext = mm.add(MOTION_OK, () => {
      if (copy) gsap.set(copy, { opacity: 1 });

      const handles = [handleLeft, handleRight].filter(Boolean) as HTMLElement[];
      const doors = [doorLeft, doorRight];
      let seq: gsap.core.Timeline | null = null;
      let cancelled = false;
      let phase1Done = false;
      let phase1EndProgress = 0;
      let finaleVisible = false;
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
              .to(
                titleCardTrees,
                { scale: 2.3, xPercent: -14, filter: "blur(7px) brightness(0.6)", duration: 1.7, ease: "expo.in" },
                "zoom+=0.15",
              )
              .to(
                titleCardBirds,
                { scale: 2.3, xPercent: 32, filter: "blur(7px) brightness(0.6)", duration: 1.7, ease: "expo.in" },
                "zoom+=0.5",
              )
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
            if (finaleActive && finalePlayer) {
              const finaleProgress = gsap.utils.clamp(0, 1, finaleRaw);
              smoothedFinaleProgress = smoothProgress(smoothedFinaleProgress, finaleProgress);
              finalePlayer.seekToProgress(smoothedFinaleProgress);

              if (finaleDim) {
                const dimProgress = gsap.utils.clamp(0, 1, (finaleProgress - FINALE_DIM_START) / (1 - FINALE_DIM_START));
                gsap.set(finaleDim, { "--dim": dimProgress * FINALE_DIM_MAX });
              }

            }
          }
        },
      });

      bg.addEventListener("ended", maybeStartPhase2, { once: true });

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
                  // readyState 2 (loadeddata) only guarantees the CURRENT
                  // frame decoded — nowhere near enough to promise smooth
                  // playback through the whole clip. readyState 4 /
                  // canplaythrough is the browser's own estimate that it
                  // can play through without stalling to buffer more.
                  if ((el as HTMLVideoElement).readyState >= 4) return resolve();
                  el.addEventListener("canplaythrough", () => resolve(), { once: true });
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
              bg.play().catch(() => {});
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
          .fromTo(
            lines,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.5 * PACE, stagger: 0.12 * PACE, ease: "power2.out" },
            doorOpenStart + 0.7 * PACE,
          );

        if (ctaGroup) {
          seq.fromTo(
            ctaGroup,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.5 * PACE, ease: "power2.out" },
            doorOpenStart + 0.7 * PACE + 0.12 * PACE * lines.length,
          );
        }

        if (chrome) {
          seq.to(chrome, { autoAlpha: 1, duration: 0.5 * PACE }, doorOpenStart + 0.7 * PACE);
        }
      });

      return () => {
        cancelled = true;
        st.kill();
        indicatorTl.kill();
        seq?.kill();
        bgFadeTween?.kill();
        titleCardTl?.kill();
        bg.removeEventListener("ended", maybeStartPhase2);
        skipLink?.removeEventListener("click", onSkip);
        bg.pause();
        // Guards against unmounting mid-intro/mid-fade leaving scroll
        // permanently locked — a no-op if it was already started.
        if (!phase1Done) getLenis()?.start();
        wipePlayer?.destroy();
        finalePlayer?.destroy();
        if (wipeCanvas) gsap.set(wipeCanvas, { clearProps: "all" });
        if (finaleCanvas) gsap.set(finaleCanvas, { clearProps: "all" });
        if (finaleDim) gsap.set(finaleDim, { clearProps: "all" });
        gsap.set([copy, lines, ctaGroup, bg, doorLeft, doorRight].filter(Boolean) as HTMLElement[], { clearProps: "all" });
        if (bgShot) gsap.set(bgShot, { clearProps: "all" });
        if (chrome) gsap.set(chrome, { clearProps: "all" });
        if (handleLeft) gsap.set(handleLeft, { clearProps: "all" });
        if (handleRight) gsap.set(handleRight, { clearProps: "all" });
        if (handleBaseLeft) gsap.set(handleBaseLeft, { clearProps: "all" });
        if (handleBaseRight) gsap.set(handleBaseRight, { clearProps: "all" });
        if (titleCard) gsap.set(titleCard, { clearProps: "all" });
        if (titleCardGradient) gsap.set(titleCardGradient, { clearProps: "all" });
        if (titleCardTrees) gsap.set(titleCardTrees, { clearProps: "all" });
        if (titleCardBirds) gsap.set(titleCardBirds, { clearProps: "all" });
        if (titleCardVignette) gsap.set(titleCardVignette, { clearProps: "all" });
        if (titleCardReveals.length) gsap.set(titleCardReveals, { clearProps: "all" });
      };
    });

    mm.add(MOTION_REDUCED, () => {
      const stReduced = ScrollTrigger.create({
        trigger: section,
        start: "top 80%",
        once: true,
        onEnter: () => {
          section.classList.add("is-visible");
          chrome?.classList.add("is-visible");
        },
      });

      return () => {
        stReduced.kill();
        section.classList.remove("is-visible");
        chrome?.classList.remove("is-visible");
      };
    });

    return () => {
      mmContext.revert();
      window.removeEventListener("touchstart", primeVideo);
      window.removeEventListener("pointerdown", primeVideo);
      window.removeEventListener("wheel", primeVideo);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={doorLeftRef}
            className="threshold__door threshold__door--left"
            src={asset("/assets/00-threshold/door-left.webp")}
            alt=""
            width={1376}
            height={2562}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleBaseLeftRef}
            className="threshold__handle-base threshold__handle-base--left"
            src={asset("/assets/00-threshold/handle-left-base.svg")}
            alt=""
            width={1375}
            height={2560}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleLeftRef}
            className="threshold__handle threshold__handle--left"
            src={asset("/assets/00-threshold/handle-left.svg")}
            alt=""
            width={1375}
            height={2560}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={doorRightRef}
            className="threshold__door threshold__door--right"
            src={asset("/assets/00-threshold/door-right.webp")}
            alt=""
            width={1375}
            height={2562}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleBaseRightRef}
            className="threshold__handle-base threshold__handle-base--right"
            src={asset("/assets/00-threshold/handle-right-base.svg")}
            alt=""
            width={1375}
            height={2560}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={handleRightRef}
            className="threshold__handle threshold__handle--right"
            src={asset("/assets/00-threshold/handle-right.svg")}
            alt=""
            width={1375}
            height={2560}
            decoding="async"
          />
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
          </div>
        </div>

        <div className="title-card" ref={titleCardRef} aria-hidden="true">
          <div className="title-card__world">
            <div className="title-card__gradient" ref={titleCardGradientRef} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={titleCardTreesRef}
              className="title-card__trees"
              src={asset("/assets/01-unknown/trees.webp")}
              alt=""
              width={567}
              height={683}
              decoding="async"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={titleCardBirdsRef}
              className="title-card__birds"
              src={asset("/assets/01-unknown/birds.webp")}
              alt=""
              width={533}
              height={623}
              decoding="async"
            />
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
        <div className="finale__dim" ref={finaleDimRef} aria-hidden="true" />
      </div>
    </section>
  );
}
