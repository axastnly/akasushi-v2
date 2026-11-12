"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Button from "./Button";
import { asset } from "@/lib/paths";
import { getLenis } from "@/lib/motion";
import { useReserveModal } from "./ReserveModalProvider";
import { PAGE_LEAVE_MS } from "./PageVeil";

type ChromeProps = {
  // ThresholdScene's own intro animation is what reveals .chrome
  // (autoAlpha: 1, via GSAP) on the homepage — pages without that intro
  // need it visible from the start instead. See the unscoped
  // .chrome.is-visible rule in globals.css.
  alwaysVisible?: boolean;
};

/* Social row, shared by the overlay's footer and the site footer. Same
   five destinations and icons Footer.tsx uses. */
const SOCIAL = [
  { label: "Location", href: "https://maps.app.goo.gl/xYkv6dodUTRsCwKW6", icon: "map-pin" },
  { label: "Email", href: "mailto:aka@akasushi.ae", icon: "mail" },
  { label: "Instagram", href: "https://instagram.com/akasushi.ae", icon: "instagram" },
  { label: "Phone", href: "tel:+971565004187", icon: "phone" },
  { label: "WhatsApp", href: "https://wa.me/971565004187", icon: "whatsapp" },
];

export default function Chrome({ alwaysVisible = false }: ChromeProps) {
  const { openReserve } = useReserveModal();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  // The overlay is portalled into <body>, so it can only render once the
  // client has mounted — SSR has no body to portal into.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Separate pages darken their bar once scrolled, matching .is-scrolled
  // on the reference build. The homepage keeps its gradient instead.
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/" || pathname === "";

  useEffect(() => {
    if (isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  /* While the overlay is open the page behind it is blurred and frozen —
     html.is-menu-open in globals.css does both. Lenis has to be stopped
     too: it drives its own scroll loop on the homepage and would keep
     running straight through the native overflow lock. */
  // Only ever restart Lenis if THIS component was the one that stopped
  // it. Restarting unconditionally would fire on mount too, and the
  // homepage keeps Lenis deliberately stopped for the whole door-open
  // intro (lenis.stop() in page.tsx) — resuming it there unlocks scroll
  // early and lets the hero be scrolled away mid-reveal.
  const stoppedLenis = useRef(false);
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("is-menu-open", menuOpen);
    if (!menuOpen) {
      if (stoppedLenis.current) {
        getLenis()?.start();
        stoppedLenis.current = false;
      }
      return () => html.classList.remove("is-menu-open");
    }
    stoppedLenis.current = true;
    getLenis()?.stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      html.classList.remove("is-menu-open");
    };
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
    // Only the homepage (the one with the pinned scene) runs Lenis. On every
    // other page scroll natively — a Lenis instance left over from the
    // homepage after client-side navigation is dead and would swallow it.
    const lenis = document.querySelector(".scene__pin") ? getLenis() : null;
    if (lenis) {
      lenis.start();
      lenis.scrollTo(footer, { immediate: true });
    } else {
      window.scrollTo({ top: footer.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
    }
  };

  const isActive = (path: string) => pathname === path || pathname === `${path}/`;

  // Fade to black, then navigate; the new page's PageVeil fades it back in.
  // Modifier-clicks (new tab etc.) keep the browser's default behaviour.
  const navigate = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    setMenuOpen(false);
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (isActive(href)) return;
    document.documentElement.classList.add("is-leaving");
    window.setTimeout(() => router.push(href), PAGE_LEAVE_MS);
  };

  const logo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="brand__logo" src={asset("/assets/brand/aka-logo.svg")} alt="AKA Restaurant & Lounge" width={107} height={60} />
  );

  /* Logo + Reserve + hamburger, repeated identically inside the overlay so
     the bar appears not to move when the menu opens over it. */
  const headerActions = (
    <div className="chrome__actions">
      <Button type="button" onClick={openReserve} variant="primary" aria-label="Reserve your night at AKA">
        Reserve
      </Button>
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="site-menu"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span className="menu-toggle-icon" data-open={menuOpen ? "true" : "false"} aria-hidden="true">
          <span />
          <span />
        </span>
      </button>
    </div>
  );

  const overlay =
    mounted && menuOpen
      ? createPortal(
          <div id="site-menu" className="site-menu" role="dialog" aria-modal="true" aria-label="Site menu">
            <div className="site-menu-backdrop" aria-hidden="true" />
            <div className="site-menu-chrome">
              <Link className="site-menu-chrome-logo" href="/" aria-label="AKA home" onClick={navigate("/")}>
                {logo}
              </Link>
              {headerActions}
            </div>
            <div className="site-menu-panel">
              <nav className="site-menu-nav" aria-label="Primary">
                <ul className="site-menu-links">
                  <li>
                    <Link className="site-menu-link" href="/menu" aria-current={isActive("/menu") ? "page" : undefined} onClick={navigate("/menu")}>
                      Food Menu
                    </Link>
                  </li>
                  <li>
                    <Link className="site-menu-link" href="/gallery" aria-current={isActive("/gallery") ? "page" : undefined} onClick={navigate("/gallery")}>
                      Gallery
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="site-menu-link"
                      onClick={() => {
                        setMenuOpen(false);
                        openReserve();
                      }}
                    >
                      Private Dining
                    </button>
                  </li>
                  <li>
                    <a className="site-menu-link" href="#site-footer" onClick={goToContact}>
                      Contact Us
                    </a>
                  </li>
                </ul>
              </nav>
              <div className="site-menu-footer">
                <div className="site-menu-social" aria-label="Contact links">
                  {SOCIAL.map(({ label, href, icon }) => (
                    <a
                      key={label}
                      className="site-menu-social-link"
                      href={href}
                      aria-label={label}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset(`/assets/icons/${icon}.svg`)} alt="" width={24} height={24} />
                    </a>
                  ))}
                </div>
                <p className="site-menu-location-label">Location</p>
                <address className="site-menu-address">
                  AKA Restaurant &amp; Lounge
                  <br />
                  Mileo The Palm, West Beach, Palm Jumeirah
                  <br />
                  Dubai, UAE
                </address>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {/* data-open (not a class) so React re-renders never clobber the
          is-visible class ThresholdScene toggles on this element directly. */}
      <header
        className={`chrome${alwaysVisible ? " is-visible" : ""}${!isHome && scrolled ? " is-scrolled" : ""}`}
        data-open={menuOpen || undefined}
        data-home={isHome || undefined}
      >
        <div className="chrome__container">
          {isHome ? (
            <a className="brand" href="#scene-00" aria-label="AKA Restaurant & Lounge, home">
              {logo}
            </a>
          ) : (
            <Link className="brand" href="/" aria-label="AKA Restaurant & Lounge, home" onClick={navigate("/")}>
              {logo}
            </Link>
          )}

          {headerActions}
        </div>
      </header>
      {overlay}
    </>
  );
}
