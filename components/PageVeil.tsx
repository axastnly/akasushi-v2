"use client";

import { useEffect, useRef } from "react";

/* Page transition veil. Rendered by app/template.tsx, so a fresh one mounts
   on every route change: it starts opaque black and fades away (the "enter"
   half). The "leave" half is Chrome's nav links adding html.is-leaving,
   which fades the current page's veil back in before navigating. Works for
   browser back/forward too (those only get the fade-in). */
export const PAGE_LEAVE_MS = 450;

export default function PageVeil() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.remove("is-leaving");
    // Two frames so the opaque starting state is painted before fading.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => ref.current?.classList.add("is-clear")),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return <div className="page-veil" ref={ref} aria-hidden="true" />;
}
