/* Ported from Figma (AKA Design, node 627:1206 "Footer - Laptop") — three
   columns with vertical separators, social icon row, bottom copyright
   bar. Structure/content/icons are the design's; typography reuses this
   project's existing --font-display/--font-ui tokens (same families the
   design itself specifies — IvyPresto Headline / TT Drugs). */
import { asset } from "@/lib/paths";

export default function Footer() {
  return (
    <footer className="site-footer" id="site-footer">
      <div className="site-footer__columns">
        <div className="site-footer__col">
          <h3 className="site-footer__heading">Address</h3>
          {/* eslint-disable-next-line react/jsx-no-target-blank */}
          <a
            className="site-footer__text"
            href="https://www.google.com/maps/search/?api=1&query=AKA+Restaurant+%26+Lounge+Mileo+The+Palm+West+Beach+Palm+Jumeirah+Dubai"
            target="_blank"
            rel="noopener"
          >
            <p>AKA Restaurant &amp; Lounge</p>
            <p>Mileo The Palm, West Beach, Palm Jumeirah</p>
            <p>Dubai, UAE</p>
          </a>
        </div>

        <div className="site-footer__separator" aria-hidden="true" />

        <div className="site-footer__col">
          <h3 className="site-footer__heading">Contact Us</h3>
          <p className="site-footer__text">
            Phone: +971 50 1234 567
            <br />
            Email: reservations@aka-dubai.ae
          </p>
          <div className="site-footer__social" aria-label="Social links">
            <a href="#" aria-label="Location">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/map-pin.svg")} alt="" width={24} height={24} />
            </a>
            <a href="#" aria-label="Email">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/mail.svg")} alt="" width={24} height={24} />
            </a>
            <a href="#" aria-label="Instagram">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/instagram.svg")} alt="" width={24} height={24} />
            </a>
            <a href="#" aria-label="Phone">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/phone.svg")} alt="" width={24} height={24} />
            </a>
            <a href="#" aria-label="WhatsApp">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/whatsapp.svg")} alt="" width={24} height={24} />
            </a>
          </div>
        </div>

        <div className="site-footer__separator" aria-hidden="true" />

        <div className="site-footer__col">
          <h3 className="site-footer__heading">Hours</h3>
          <p className="site-footer__text">
            Sunday – Thursday: 7:00 PM – 1:00 AM
            <br />
            Friday &amp; Saturday: 7:00 PM – 2:00 AM
          </p>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>© 2025 AKA Restaurant</p>
      </div>
    </footer>
  );
}
