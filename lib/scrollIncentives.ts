/* Flags for experimental scroll-incentive prototypes on the threshold
   scene (wipe + finale sequence). One flag per idea, toggle to compare. */
export const NUDGE_ENABLED = true;

// How long to wait, idle on the hero, before each nudge — one entry per
// nudge, so the array's length is also the max number of nudges per visit.
export const NUDGE_IDLE_DELAYS_MS = [2000, 5000, 9000];

/* The shape of a single nudge: out, pause, back. These used to be
   hardcoded in ThresholdScene, which is how the cue's zoom drifted out
   of step with them — the zoom is a CSS transition on its own clock, so
   the only way the two stay together is for both to be read from here.
   Change one of these and change its CUE_NUDGE_* partner to match. */
export const NUDGE_OUT_DURATION_S = 1.2;
export const NUDGE_HOLD_MS = 400;
export const NUDGE_RETURN_DURATION_S = 1;

/* ── Video scrub speed ─────────────────────────────────────────────────── */
// How much scroll (in viewport-heights) it takes to play through each
// scrubbed video — this IS the scroll speed: raise a number to need more
// scrolling (slower per-pixel playback), lower it for less scrolling
// (faster). TITLE_VH is the title-card pause between them, not a video,
// but shares the same scroll-budget pool so it's here too.
export const WIPE_VH = 255;
export const TITLE_VH = 200;
export const FINALE_VH = 320;

/* Finale caption transition: "travel" glides one block between alternating
   sides, crossfading content mid-glide. "ink" keeps the caption fixed on
   its beat's side and wipes old → new with a sweeping brush stroke.
   "reveal" is centred and uses the same left-to-right mask-wipe as the
   title card's "from / The Heart Of Japan". "rise" has all four captions
   permanently in the DOM, each rising past the middle and off the top on
   its own beat, alternating sides, with neighbours overlapping briefly. */
export const CAPTION_TRANSITION: "travel" | "ink" | "reveal" | "rise" = "rise";

/* ── Caption beat timing (shared by both transitions) ─────────────────── */
// Where each caption's "home" beat begins, as % of the finale's own scroll
// progress (0–100). Four equal beats by default — make them uneven by
// editing this array (must stay the same length as FINALE_CAPTIONS in
// ThresholdScene.tsx).
export const CAPTION_BEAT_STARTS_PCT = [0, 25, 50, 75];

// How much of the finale's scroll progress a transition between two
// adjacent beats takes, as a fraction (0–1) of the finale's own progress,
// centred on the beat boundary.
export const CAPTION_TRANSITION_WINDOW = 0.15;

// How much of the very start/end of the whole finale phase is spent
// fading the caption system in/out, as a fraction of finale progress.
export const CAPTION_EDGE_FADE = 0.04;

/* ── "Travel" transition ───────────────────────────────────────────────── */
// GSAP ease name for the glide's position.
export const CAPTION_TRAVEL_EASE = "power2.inOut";

// How far the caption slides from centre to either side, in vw.
export const CAPTION_TRAVEL_DISTANCE_VW = { desktop: 31, mobile: 20 };

// Peak vertical drift during the glide, in px (0 at rest, 0 at both ends).
export const CAPTION_TRAVEL_DRIFT_PX = 8;

// Point within a transition (0–1) where the text swaps from the old line
// to the new one — 0.5 means exactly halfway (old fades out the first
// half, new fades in the second).
export const CAPTION_CROSSFADE_SPLIT = 0.5;

/* ── "Ink" transition ──────────────────────────────────────────────────── */
// Fraction of a transition window spent actually sweeping the stroke
// across; the remainder is the "drying" fade-out below.
export const INK_SWEEP_FRACTION = 0.8;

// Jagged edge sample offsets (% of the caption's own width) at 7 evenly
// spaced points down its height — the brush's hand-painted boundary,
// instead of a clean straight line.
export const INK_EDGE_JITTER_PCT = [0, -5, 4, -3, 5, -3, 0];

// Stroke colour (AKA red) as "R G B" and its peak opacity at the solid
// middle of the gradient — edges still fade to fully transparent.
export const INK_STROKE_COLOR_RGB = "140 21 27";
export const INK_STROKE_OPACITY = 0.05;

// Stroke width, as % of the caption block's own width.
export const INK_STROKE_WIDTH_PCT = 16;

// How far the stroke overhangs the caption block's top/bottom edge, as %
// of the block's height (makes the stroke read as taller than the text).
export const INK_STROKE_OVERHANG_PCT = 8;

// Soft blur applied to the stroke for a wet, translucent edge, in px.
export const INK_STROKE_BLUR_PX = 15;

// Vertical taper at the stroke's own top/bottom — % of its height that
// fades in/out at each end, tapering it like a single brush stroke.
export const INK_STROKE_TAPER_PCT = 18;

/* ── "Rise" transition ─────────────────────────────────────────────────── */
/* Where each caption's travel STARTS and ENDS, in vh relative to its own
   anchor (the anchor itself is RISE_LAYOUT's textTop). Positive is below
   that point, negative is above, so the defaults below run bottom-to-top
   through it. These are the raw endpoints: what you actually see is each
   one multiplied by that layer's speed factor, so with the 0.6 default
   the English really runs +42vh -> -42vh. Halve the factor and you halve
   the on-screen travel without touching these.
     - start lower / higher ............ raise / lower FROM
     - finish higher / lower ........... lower / raise TO
     - fall instead of rise ............ swap the two signs
     - drift only slightly ............. bring them closer together
   They are independent, so an asymmetric travel is fine: FROM 90 with TO
   -10 rises a long way into place and then barely leaves.
   Split per breakpoint (the same 47.99em line globals.css uses), since
   a phone's viewport is far taller than it is wide and the same vh
   rarely reads the same on both. Your tuned 35 / -55 is kept on each
   side, so the two start out identical — change one freely. */
export const RISE_TRAVEL_FROM_VH = { desktop: 70, mobile: 35 };
export const RISE_TRAVEL_TO_VH = { desktop: -50, mobile: -55 };

// How fast a caption actually moves relative to the scroll it takes to
// cross its own active window — 1 would be glued to scroll; less reads
// as parallax (it visibly lags the scroll rather than tracking it 1:1).
export const RISE_SPEED_FACTOR = 0.6;

// How much a caption's active window bleeds into its neighbouring beats,
// as a fraction (0–1) of its own beat's length. This is what lets the
// next caption start rising on the far side while the current one is
// still on its way out, instead of a hard cut with an empty gap.
export const RISE_OVERLAP = 0.05;

// Portion (0–1) of a caption's own travel spent fading in at the start
// and fading out at the end (symmetric), so it never pops at the edges.
export const RISE_FADE_EDGE = 0.15;


/* ── "Rise" kanji watermark ────────────────────────────────────────────
   Each rise caption carries a big translucent kanji behind it, taken
   from the four hero compositions in Figma. The kanji and the English
   are transformed separately, so the two speed factors are what make
   them drift apart as they rise. The characters themselves live in
   FINALE_CAPTIONS in ThresholdScene.tsx. */

// Kanji travel speed, same meaning as RISE_SPEED_FACTOR but applied to
// the kanji alone. THE GAP BETWEEN THE TWO IS THE EFFECT: equal values
// move them as one block, and the further below RISE_SPEED_FACTOR this
// sits, the more the kanji lags and the deeper behind the English it
// reads. Above it, the kanji overtakes the text instead.
export const RISE_KANJI_SPEED_FACTOR = 0.5;

// The Figma frames every number below was measured in. Horizontal
// values scale by width, the caption's screen anchor by height.
export const RISE_FIGMA_REF = {
  desktop: { width: 1512, height: 818 },
  mobile: { width: 402, height: 874 },
};

/* Per-caption placement transcribed from Figma, in that frame's own px;
   index matches FINALE_CAPTIONS. The designer placed each kanji by eye
   rather than to a rule — 忍 sits low and well inside its text, 握 rides
   high above it, 縁 drops below — so there is no shared offset to derive
   and each is listed on its own.
     textTop   English block's top edge, px from the frame's vertical centre
     textWidth the block's width
     kanjiX    kanji's inset from the caption's OWN anchored edge (its left
               for left-side captions, its right for right-side ones);
               negative hangs the glyph outward past that edge
     kanjiY    kanji's top edge, px from the English block's top edge
   Desktop captions anchor to the side they're drawn on; mobile ones are
   centred, and only the kanji keeps alternating. */
export const RISE_LAYOUT = [
  // 忍 — well inside the text, low and to the right of it
  { desktop: { textTop: -143, textWidth: 544, kanjiX: 260, kanjiY: 34 },
    mobile: { textTop: -102, textWidth: 342, kanjiX: -20, kanjiY: -85 } },
  // 技 — pulled inboard and lifted back above the text
  { desktop: { textTop: -123, textWidth: 567, kanjiX: 250, kanjiY: -98 },
    mobile: { textTop: -102, textWidth: 372, kanjiX: -52, kanjiY: -102 } },
  // 握 — rides high above the text
  { desktop: { textTop: -143, textWidth: 544, kanjiX: 107, kanjiY: -111 },
    mobile: { textTop: -102, textWidth: 372, kanjiX: -8, kanjiY: -71 } },
  // 縁 — sits below the (single-line) text
  { desktop: { textTop: -73, textWidth: 476, kanjiX: 8, kanjiY: 33 },
    mobile: { textTop: -35, textWidth: 372, kanjiX: -24, kanjiY: -88 } },
];

// Distance from the viewport's left/right edge to the caption block, px
// at the desktop reference width. Figma has all four at 60. Mobile
// ignores this — captions centre there.
export const RISE_SIDE_OFFSET_PX = 60;

// Glyph size, px at each breakpoint's reference width.
export const RISE_KANJI_SIZE_PX = { desktop: 240.976, mobile: 240 };

// Caption type, px at each reference width. Desktop keeps rise's own
// taller title (84 against Figma's 64, as it had before); mobile matches
// Figma exactly at 24/64.
export const RISE_TYPE_PX = {
  mobile: { eyebrow: 24, title: 64 },
};

/* Blend mode and colour copied from the kanji node itself (Figma
   455:2725 desktop / 455:3142 mobile — both carry the same values).
   The alpha lives INSIDE the colour, exactly as Figma has it, rather
   than as a separate opacity property: an element with opacity < 1
   forms an isolated group, which would stop the dodge reaching the
   video underneath (see the stacking notes in globals.css).
   color-dodge brightens its backdrop, so this reads as the glyph
   glowing out of the footage rather than sitting flatly on top. */
export const RISE_KANJI_BLEND = "color-dodge";
export const RISE_KANJI_COLOR = "rgb(202 75 75 / 0.85)";

// A fixed softening on the glyph, in px. Deliberately NOT scaled by
// viewport and never animated — it is a static property of the
// watermark, so it stays off the scroll path and out of will-change.
export const RISE_KANJI_BLUR_PX = 1;

/* ── "Step Inside" cue ─────────────────────────────────────────────────
   The scroll cue beneath the hero buttons. It has no entrance of its
   own otherwise — it simply sits "inside the room" and is revealed as
   the doors open — so these ease it in once the hero has settled (the
   moment the bg fade finishes and scroll unlocks), and then hand its
   exit to the scroll position rather than to a timer.
   The entrance animates the cue's LETTERS and its line, never the
   .scene__scroll-indicator wrapper: that wrapper carries the nudge's
   drop-shadow filter, which a blur tween on the same element would
   overwrite. The scroll fade-out does ride the wrapper, so the two
   never fight over the same property. */

// Wait this long after the DOORS BEGIN TO OPEN before the cue starts
// arriving — not after the hero settles, which is much later. 0 puts it
// in step with them, which is the point: the cue is part of the room
// being revealed, not a follow-up to it. Raise it to hold the cue back.
export const CUE_IN_DELAY_S = 0;

// How long the cue takes to arrive.
export const CUE_IN_DURATION_S = 0;

// GSAP ease for the entrance.
export const CUE_IN_EASE = "power2.out";

// How far the cue rises into place, in px (it starts this far below).
export const CUE_IN_Y_PX = 10;

// How soft the cue starts, in px of blur, resolving to 0.
export const CUE_IN_BLUR_PX = 4;

// Per-letter offset, in s. 0 brings the whole cue in as one piece.
export const CUE_IN_STAGGER_S = 0.04;

// The cue fades out across this much of the page's very first scroll,
// in px. Scrubbed to the scroll position rather than timed, so it
// tracks the finger and comes back if the visitor scrolls up again.
export const CUE_OUT_SCROLL_PX = 100;

/* ── Nudge "zoom" on the cue ───────────────────────────────────────────
   While a nudge runs, the cue scales up and glows so it cannot be
   missed (ThresholdScene adds .is-nudging for exactly that long). In
   and out are separate so the call-out can snap in and relax out, or
   the reverse.
   NOTE: unlike every other ease in this file these are CSS easings, not
   GSAP ones — the zoom is a CSS transition, so "power2.out" will NOT
   work here. Use a keyword (ease, ease-out, linear) or a
   cubic-bezier(...) literal. */

// How big the cue gets at the peak of a nudge. 1 disables the zoom.
export const CUE_NUDGE_SCALE = 1.3;

/* Zooming IN — matched to the nudge's outward leg, so the cue reaches
   full size exactly as the page reaches the far point instead of
   snapping there in a third of the time. The curve is the CSS twin of
   the GSAP "power2.inOut" the nudge scrolls with. */
export const CUE_NUDGE_IN_DURATION_S = NUDGE_OUT_DURATION_S;
export const CUE_NUDGE_IN_EASE = "cubic-bezier(0.455, 0.03, 0.515, 0.955)";

/* Zooming OUT — matched to the return leg. It now begins when the page
   STARTS coming back rather than when it has arrived (which left the
   cue fully zoomed for a second after everything had stopped), so the
   two land together. */
export const CUE_NUDGE_OUT_DURATION_S = NUDGE_RETURN_DURATION_S;
export const CUE_NUDGE_OUT_EASE = "cubic-bezier(0.455, 0.03, 0.515, 0.955)";

// The glow at full zoom, as a CSS drop-shadow value.
export const CUE_NUDGE_GLOW = "0 0 14px rgb(255 255 255 / 0.85)";
