"use client";

import Chrome from "@/components/Chrome";
import Footer from "@/components/Footer";
import ReserveModalProvider from "@/components/ReserveModalProvider";
import { asset } from "@/lib/paths";

/* Gallery — the 9 photos from akasushi.ae's own gallery. Ordered so the
   3-column masonry balances exactly: each column gets one portrait
   (1000×1463) and two landscapes (1000×715). */
const PHOTOS: { file: string; w: number; h: number; alt: string }[] = [
  { file: "1.webp", w: 1000, h: 1463, alt: "Chef plating at the AKA sushi counter" },
  { file: "2.webp", w: 1000, h: 715, alt: "A platter of nigiri being served" },
  { file: "3.webp", w: 1000, h: 715, alt: "AKA's lounge seating with the red dragon sculpture" },
  { file: "4.webp", w: 1000, h: 715, alt: "Sushi rolls being dipped with chopsticks" },
  { file: "6.webp", w: 1000, h: 1463, alt: "The dining room's illuminated wall panels" },
  { file: "5.webp", w: 1000, h: 715, alt: "Assorted nigiri on a dark plate" },
  { file: "9.webp", w: 1000, h: 715, alt: "A small plate served beside an AKA napkin" },
  { file: "r30.webp", w: 1000, h: 1463, alt: "Golden statue in the AKA dining room" },
  { file: "r31.webp", w: 1000, h: 715, alt: "The illuminated AKA sign" },
];

export default function GalleryPage() {
  return (
    <ReserveModalProvider>
      <Chrome alwaysVisible />
      <main className="gallery-page">
        <h1 className="gallery-page__title">Gallery</h1>
        <div className="gallery-grid">
          {PHOTOS.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.file}
              className="gallery-grid__item"
              src={asset(`/assets/gallery/${p.file}`)}
              alt={p.alt}
              width={p.w}
              height={p.h}
              loading={i < 3 ? "eager" : "lazy"}
              decoding="async"
            />
          ))}
        </div>
      </main>
      <Footer />
    </ReserveModalProvider>
  );
}
