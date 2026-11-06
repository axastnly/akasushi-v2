import { asset } from "@/lib/paths";

/* "Step Into AKA" — static section below the finale.
   Ported from Figma AKA-Design, node 656:538 (1512 × 2792 frame).
   Every dimension is expressed in design pixels × --u (see globals.css),
   so the layout is exact at 1512px wide and scales proportionally. */

type Card = {
  src: string;
  lines: [string, string];
  /** Figma overlay gradient on top of the photo, if any. */
  overlay?: string;
  /** Dining's Figma fill is squeezed to the frame (object-fit: fill), not cropped. */
  fit?: "fill";
};

const LEFT: Card[] = [
  {
    src: "/assets/02-experience/dining.webp",
    lines: ["Japanese", "Dining"],
    overlay: "linear-gradient(to left, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 49.874%)",
    fit: "fill",
  },
  {
    src: "/assets/02-experience/cocktails.webp",
    lines: ["Crafted", "Cocktails"],
    overlay: "linear-gradient(-90deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 50%)",
  },
  {
    src: "/assets/02-experience/beats.webp",
    lines: ["Live", "Beats"],
  },
];

const RIGHT: Card[] = [
  {
    src: "/assets/02-experience/sushi.webp",
    lines: ["Sushi", "Artistry"],
    overlay: "linear-gradient(to bottom, rgba(0, 0, 0, 0) 74.66%, rgba(0, 0, 0, 0.4) 100%)",
  },
  {
    src: "/assets/02-experience/nights.webp",
    lines: ["nights", "Out"],
  },
];

function ExperienceCard({ card }: { card: Card }) {
  return (
    <div className="experience__card">
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
  return (
    <section className="experience" aria-labelledby="experience-title">
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
