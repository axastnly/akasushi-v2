"use client";

import { useEffect, useRef } from "react";
import { asset } from "@/lib/paths";
import { ensureGsapRegistered, gsap, MOTION_OK } from "@/lib/motion";

/* "Step Into AKA" — section below the finale.
   Ported from Figma AKA-Design, node 656:538 (1512 × 2792 frame).
   Every dimension is expressed in design pixels × --u (see globals.css),
   so the layout is exact at 1512px wide and scales proportionally.

   Scroll parallax: each photo and each label drifts at its own speed while
   the header stays put. Offsets are symmetric around the moment a card's
   centre crosses the viewport's centre, so at that point everything sits
   exactly on the Figma layout. Disabled under prefers-reduced-motion. */

type Card = {
  src: string;
  lines: [string, string];
  /** Figma overlay gradient on top of the photo, if any. */
  overlay?: string;
  /** Dining's Figma fill is squeezed to the frame (object-fit: fill), not cropped. */
  fit?: "fill";
  /** Parallax travel of the photo, in design px either side of rest.
      Bigger = moves faster than the page. */
  speed: number;
};

/* Labels travel this much further than their own photo, so they slide up
   across the photo's bottom edge rather than sitting fixed on it. */
const LABEL_EXTRA = 70;

const LEFT: Card[] = [
  {
    src: "/assets/02-experience/dining.webp",
    lines: ["Japanese", "Dining"],
    overlay: "linear-gradient(to left, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 49.874%)",
    fit: "fill",
    speed: 40,
  },
  {
    src: "/assets/02-experience/cocktails.webp",
    lines: ["Crafted", "Cocktails"],
    overlay: "linear-gradient(-90deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 50%)",
    speed: 60,
  },
  {
    src: "/assets/02-experience/beats.webp",
    lines: ["Live", "Beats"],
    speed: 45,
  },
];

const RIGHT: Card[] = [
  {
    src: "/assets/02-experience/sushi.webp",
    lines: ["Sushi", "Artistry"],
    overlay: "linear-gradient(to bottom, rgba(0, 0, 0, 0) 74.66%, rgba(0, 0, 0, 0.4) 100%)",
    speed: 120,
  },
  {
    src: "/assets/02-experience/nights.webp",
    lines: ["nights", "Out"],
    speed: 140,
  },
];

function ExperienceCard({ card }: { card: Card }) {
  return (
    <div className="experience__card" data-speed={card.speed}>
      <div className="experience__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(card.src)}
          alt=""
          loading="lazy"
          decoding="async"
          style={card.fit ? { objectFit: card.fit } : undefined}
        />
        {card.overlay && <div className="experience__overlay" style={{ backgroundImage: card.overlay }} />}
      </div>
      <p className="experience__label">
        {card.lines[0]}
        <br />
        {card.lines[1]}
      </p>
    </div>
  );
}

export default function ExperienceSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    ensureGsapRegistered();
    const section = sectionRef.current;
    if (!section) return;

    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      // One design px at the current viewport width (same as CSS --u).
      const u = () => window.innerWidth / 1512;

      section.querySelectorAll<HTMLElement>(".experience__card").forEach((card) => {
        const speed = Number(card.dataset.speed) || 0;
        const media = card.querySelector<HTMLElement>(".experience__media");
        const label = card.querySelector<HTMLElement>(".experience__label");
        // The card box itself never moves — it's the stable trigger; only
        // its photo and label are transformed.
        const scrollTrigger = {
          trigger: card,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
          // Measure after the threshold scene's pin has added its spacing.
          refreshPriority: -1,
        };
        if (media) {
          gsap.fromTo(
            media,
            { y: () => speed * u() },
            { y: () => -speed * u(), ease: "none", scrollTrigger },
          );
        }
        if (label) {
          const travel = speed + LABEL_EXTRA;
          gsap.fromTo(
            label,
            { y: () => travel * u() },
            { y: () => -travel * u(), ease: "none", scrollTrigger: { ...scrollTrigger } },
          );
        }
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <section className="experience" id="experience" aria-labelledby="experience-title" ref={sectionRef}>
      <p className="experience__eyebrow">Step Into AKA</p>
      <h2 className="experience__title" id="experience-title">
        An Experience Beyond the Ordinary
      </h2>
      <div className="experience__grid">
        <div className="experience__col experience__col--left">
          {LEFT.map((c) => (
            <ExperienceCard key={c.src} card={c} />
          ))}
        </div>
        <div className="experience__col experience__col--right">
          {RIGHT.map((c) => (
            <ExperienceCard key={c.src} card={c} />
          ))}
        </div>
      </div>
    </section>
  );
}
