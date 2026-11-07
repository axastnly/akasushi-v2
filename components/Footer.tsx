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
            href="https://maps.app.goo.gl/xYkv6dodUTRsCwKW6"
            target="_blank"
            rel="noopener"
          >
            <p>AKA Sushi Restaurant</p>
            <p>Mileo The Palm, West Beach, Palm Jumeirah</p>
            <p>Dubai, UAE</p>
          </a>
        </div>

        <div className="site-footer__separator" aria-hidden="true" />

        <div className="site-footer__col">
          <h3 className="site-footer__heading">Contact Us</h3>
          <p className="site-footer__text">
            <span>
              Phone: <a href="tel:+971565004187">+971 56 500 4187</a>
            </span>
            <span>
              Email: <a href="mailto:aka@akasushi.ae">aka@akasushi.ae</a>
            </span>
          </p>
          <div className="site-footer__social" aria-label="Social links">
            <a href="https://maps.app.goo.gl/xYkv6dodUTRsCwKW6" target="_blank" rel="noopener noreferrer" aria-label="Location">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/map-pin.svg")} alt="" width={24} height={24} />
            </a>
            <a href="mailto:aka@akasushi.ae" aria-label="Email">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/mail.svg")} alt="" width={24} height={24} />
            </a>
            <a href="https://instagram.com/akasushi.ae" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/instagram.svg")} alt="" width={24} height={24} />
            </a>
            <a href="tel:+971565004187" aria-label="Phone">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/phone.svg")} alt="" width={24} height={24} />
            </a>
            <a href="https://wa.me/971565004187" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/assets/icons/whatsapp.svg")} alt="" width={24} height={24} />
            </a>
          </div>
        </div>

        <div className="site-footer__separator" aria-hidden="true" />

        <div className="site-footer__col">
          <h3 className="site-footer__heading">Hours</h3>
          <p className="site-footer__text">
            Monday – Friday: 12:00 PM – 1:00 AM
            <br />
            Saturday &amp; Sunday: 12:00 PM – 2:00 AM
          </p>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>© 2025 AKA Restaurant</p>
      </div>
    </footer>
  );
}
