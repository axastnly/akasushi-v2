import { asset } from "@/lib/paths";

/* The threshold doors (+ handles) as the page's top-most layer: a fixed,
   full-viewport overlay above the header, so the hero copy, buttons AND the
   header are all genuinely "inside" — revealed as the doors slide open.
   Animated by ThresholdScene (looked up by class). Once open they sit
   off-screen and the layer is pointer-events: none. */
export default function ThresholdDoors() {
  return (
    <div className="threshold-doors" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="threshold__door threshold__door--left"
        src={asset("/assets/00-threshold/door-left.webp")}
        alt=""
        width={1376}
        height={2562}
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="threshold__handle-base threshold__handle-base--left"
        src={asset("/assets/00-threshold/handle-left-base.svg")}
        alt=""
        width={1375}
        height={2560}
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="threshold__handle threshold__handle--left"
        src={asset("/assets/00-threshold/handle-left.svg")}
        alt=""
        width={1375}
        height={2560}
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="threshold__door threshold__door--right"
        src={asset("/assets/00-threshold/door-right.webp")}
        alt=""
        width={1375}
        height={2562}
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="threshold__handle-base threshold__handle-base--right"
        src={asset("/assets/00-threshold/handle-right-base.svg")}
        alt=""
        width={1375}
        height={2560}
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="threshold__handle threshold__handle--right"
        src={asset("/assets/00-threshold/handle-right.svg")}
        alt=""
        width={1375}
        height={2560}
        decoding="async"
      />
    </div>
  );
}
