"use client";

import { useEffect, useRef } from "react";
import { asset } from "@/lib/paths";

/* Ported from Figma (AKA Design, node 627:3580 inside "Home Page -
   Preview"). Real reservation links pulled from the live akasushi.ae
   site's own Reserve modal (its "ReserveButton"/"ReserveProvider"
   bundle) — WhatsApp number and SevenRooms venue slug are both theirs,
   not placeholders. */

const WHATSAPP_URL = "https://wa.me/971565004187";
const SEVENROOMS_URL = "https://www.sevenrooms.com/explore/akasushibar/reservations/create/search/";

type ReserveModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ReserveModal({ isOpen, onClose }: ReserveModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    // Independent of ThresholdScene's own lenis.stop()/start() (it locks
    // scroll for the unrelated auto-intro handoff) — toggling this
    // directly avoids fighting over which caller gets to call
    // lenis.start() last.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="reserve-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="reserve-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reserve-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="reserve-modal__close"
          onClick={onClose}
          aria-label="Close reservation dialog"
          type="button"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/assets/reserve/reserve-close.svg")} alt="" width={30} height={30} />
        </button>

        <div className="reserve-modal__header">
          <p className="reserve-modal__eyebrow">Reservation</p>
          <h2 id="reserve-modal-title" className="reserve-modal__title">
            Where the night comes alive
          </h2>
        </div>

        <div className="reserve-modal__options">
          <a
            className="reserve-modal__option"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="reserve-modal__option-icon"
              src={asset("/assets/reserve/reserve-whatsapp.svg")}
              alt=""
              width={90}
              height={90}
            />
            <span className="reserve-modal__option-text">
              <span className="reserve-modal__option-title">Reserve via WhatsApp</span>
              <span className="reserve-modal__option-subtitle">Chat with our team to arrange your reservation.</span>
            </span>
          </a>

          <a
            className="reserve-modal__option"
            href={SEVENROOMS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="reserve-modal__option-icon"
              src={asset("/assets/reserve/reserve-sevenrooms.svg")}
              alt=""
              width={90}
              height={90}
            />
            <span className="reserve-modal__option-text">
              <span className="reserve-modal__option-title">Reserve via SevenRooms</span>
              <span className="reserve-modal__option-subtitle">Book your table online in just a few clicks.</span>
            </span>
          </a>
        </div>

        <p className="reserve-modal__footer">We look forward to welcoming you.</p>
      </div>
    </div>
  );
}
