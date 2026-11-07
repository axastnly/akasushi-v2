"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "./Button";
import { asset } from "@/lib/paths";
import { getLenis } from "@/lib/motion";
import { useReserveModal } from "./ReserveModalProvider";

type ChromeProps = {
  // ThresholdScene's own intro animation is what reveals .chrome
  // (autoAlpha: 1, via GSAP) on the homepage — pages without that intro
  // need it visible from the start instead. See the unscoped
  // .chrome.is-visible rule in globals.css.
  alwaysVisible?: boolean;
  /** Frosted backdrop: blur that fades out toward the bar's bottom edge. */
  blur?: boolean;
};

export default function Chrome({ alwaysVisible = false, blur = false }: ChromeProps) {
  const { openReserve } = useReserveModal();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHome = pathname === "/" || pathname === "";

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Every page renders the footer, so "Contact Us" scrolls to it in place.
  // On the homepage that has to go through Lenis (the scroll-jacked intro
  // means a plain anchor jump resolves against static layout); Lenis marks
  // <html class="lenis"> only while it's actually running.
  const goToContact = (e: MouseEvent<HTMLAnchorElement>) => {
    setMenuOpen(false);
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    e.preventDefault();
    const lenis = document.documentElement.classList.contains("lenis") ? getLenis() : null;
    if (lenis) {
      lenis.start();
      lenis.scrollTo(footer, { immediate: true });
    } else {
      footer.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const isActive = (path: string) => pathname === path || pathname === `${path}/`;
  const close = () => setMenuOpen(false);

  const links = (
    <>
      <Link className="chrome__link" href="/gallery" aria-current={isActive("/gallery") ? "page" : undefined} onClick={close}>
        Gallery
      </Link>
      <Link className="chrome__link" href="/menu" aria-current={isActive("/menu") ? "page" : undefined} onClick={close}>
        Menu
      </Link>
      <a className="chrome__link" href="#site-footer" onClick={goToContact}>
        Contact Us
      </a>
    </>
  );

  const logo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="brand__logo" src={asset("/assets/brand/aka-logo.svg")} alt="AKA Restaurant & Lounge" width={107} height={60} />
  );

  return (
    // data-open (not a class) so React re-renders never clobber the
    // is-visible class ThresholdScene toggles on this element directly.
    <header
      className={["chrome", alwaysVisible && "is-visible", blur && "chrome--blur"].filter(Boolean).join(" ")}
      data-open={menuOpen || undefined}
    >
      <div className="chrome__container">
        {isHome ? (
          <a className="brand" href="#scene-00" aria-label="AKA Restaurant & Lounge, home">
            {logo}
          </a>
        ) : (
          <Link className="brand" href="/" aria-label="AKA Restaurant & Lounge, home">
            {logo}
          </Link>
        )}

        <nav className="chrome__nav" aria-label="Main">
          {links}
        </nav>

        <div className="chrome__actions">
          <Button type="button" onClick={openReserve} variant="primary" aria-label="Reserve your night at AKA">
            Reserve
          </Button>
          <button
            type="button"
            className="chrome__toggle"
            aria-expanded={menuOpen}
            aria-controls="chrome-mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav className="chrome__mobile-nav" id="chrome-mobile-nav" aria-label="Main" hidden={!menuOpen}>
        {links}
      </nav>
    </header>
  );
}
