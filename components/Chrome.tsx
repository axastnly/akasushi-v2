"use client";

import Button from "./Button";
import { asset } from "@/lib/paths";
import { useReserveModal } from "./ReserveModalProvider";

type ChromeProps = {
  // ThresholdScene's own intro animation is what reveals .chrome
  // (autoAlpha: 1, via GSAP) on the homepage — pages without that intro
  // need it visible from the start instead. See the unscoped
  // .chrome.is-visible rule in globals.css.
  alwaysVisible?: boolean;
};

export default function Chrome({ alwaysVisible = false }: ChromeProps) {
  const { openReserve } = useReserveModal();

  return (
    <header className={alwaysVisible ? "chrome is-visible" : "chrome"}>
      <div className="chrome__container">
        <a className="brand" href="#scene-00" aria-label="AKA Restaurant & Lounge, home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand__logo"
            src={asset("/assets/brand/aka-logo.svg")}
            alt="AKA Restaurant & Lounge"
            width={107}
            height={60}
          />
        </a>

        <Button type="button" onClick={openReserve} variant="primary" aria-label="Reserve your night at AKA">
          Reserve
        </Button>
      </div>
    </header>
  );
}
