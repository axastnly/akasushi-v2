/* ── WebCodecs scroll-scrub player ────────────────────────────────────────
   Decodes frames directly from a compressed H.264 video on demand, driven
   by scroll progress, instead of seeking a <video>'s currentTime (which
   iOS Safari won't paint on a video that's never actually played) or
   pre-extracting hundreds of separate AVIF images (which costs real
   decoded-memory budget to hold a sliding window of, on any platform).

   mp4box.js demuxes the MP4 container into samples — WebCodecs has no
   demuxer of its own. VideoDecoder then decodes those into VideoFrame
   objects drawn straight onto a <canvas>.

   Seeking: scrubbing forward a little just continues feeding the decoder
   from where it left off (cheap — H.264 can only decode a non-keyframe by
   replaying from its most recent keyframe, so "a little" means staying
   within the source's keyframe interval). The last FRAME_CACHE_SIZE decoded
   frames stay open in an LRU cache, so scrubbing back onto one of those
   (normal touch-scroll jitter) just redraws it — no decoder involved.
   Only a jump outside both the forward-continue range and the cache resets
   the decoder and replays from the nearest preceding keyframe.

   Fallback: if WebCodecs is unavailable (older iOS Safari, in-app
   browsers) or the decoder fails, the same canvas is drawn from a hidden
   muted, playsInline <video> of the same file, scrubbed via currentTime. */

import { createFile, DataStream, Endianness, type Sample } from "mp4box";
import { logDebug } from "./debugLog";

type MP4VideoTrack = { id: number; codec: string; video: { width: number; height: number } };
type MP4Info = { videoTracks: MP4VideoTrack[] };
type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

type SampleEntry = {
  data: Uint8Array;
  cts: number; // seconds
  duration: number; // seconds
  isKeyframe: boolean;
};

export type PlayerStats = {
  status: "loading" | "ready" | "error";
  frameCount: number;
  currentFrame: number;
  mode: "continue" | "reseek" | "cached" | "-";
};

const FORWARD_CONTINUE_LIMIT = 36;
/** How many recently-decoded frames stay open for instant backward redraw. */
const FRAME_CACHE_SIZE = 8;

export class WebCodecsPlayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private url: string;
  private samples: SampleEntry[] = [];
  private keyframeIndices: number[] = [];
  private decoder: VideoDecoder | null = null;
  private decoderConfig: VideoDecoderConfig | null = null;
  private lastFedIndex = -1;
  /** Sample index currently drawn on the canvas — distinct from lastFedIndex,
      which only tracks the decoder's own position (a cache-hit redraw moves
      this without touching the decoder at all). */
  private lastDrawnIndex = -1;
  private targetTimestampUs = -1;
  private latestFrame: VideoFrame | null = null;
  /** LRU cache of decoded frames by sample index, oldest-first iteration
      order (Map preserves insertion order; re-inserting on touch keeps it
      an LRU rather than a plain FIFO). */
  private frameCache = new Map<number, VideoFrame>();
  private timestampToIndex = new Map<number, number>();
  private rafScheduled = false;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;
  private fallback: HTMLVideoElement | null = null;
  private fallbackSeeking = false;
  private lastProgress = 0;
  public onStats: ((s: PlayerStats) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, url: string) {
    this.canvas = canvas;
    this.url = url;

    // Neither of these is allowed to throw out of the constructor — a
    // caller (ThresholdScene) builds these at mount, before the GSAP
    // timelines/indicator are set up, and a synchronous throw here would
    // abort that whole effect, silently freezing the intro. If the canvas
    // itself is unusable there's nothing to draw regardless, but the rest
    // of the page (bg.mp4 intro, doors, indicator) must still work.
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D context unavailable");
      this.ctx = ctx;
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
    } catch (e) {
      logDebug(`WebCodecsPlayer(${url}): canvas context failed — ${e}`);
      return;
    }

    try {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(canvas);
    } catch (e) {
      logDebug(`WebCodecsPlayer(${url}): ResizeObserver failed — ${e}`);
      this.resizeObserver = null;
    }
    this.resizeCanvas();
  }

  private resizeCanvas() {
    if (!this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
      if (this.latestFrame) this.drawFrame(this.latestFrame);
      else if (this.fallback) this.drawFallback();
    }
  }

  private drawFrame(frame: VideoFrame) {
    this.drawCover(frame, frame.displayWidth, frame.displayHeight);
  }

  private drawCover(src: CanvasImageSource, sw: number, sh: number) {
    if (!this.ctx || !sw || !sh) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = Math.max(cw / sw, ch / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  /* ── <video> fallback ─────────────────────────────────────────────── */
  private useFallback(reason: unknown) {
    if (this.fallback || this.destroyed || !this.ctx) return;
    logDebug(`WebCodecs unavailable for ${this.url}, using <video> fallback: ${reason}`);
    try {
      this.decoder?.close();
    } catch {
      // already closed
    }
    this.decoder = null;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    // In the DOM (invisibly) — iOS is unreliable about loading/painting
    // detached video elements.
    v.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    v.addEventListener("loadeddata", () => {
      // iOS only paints a seeked frame once the element has played; muted
      // inline play() is allowed, so prime it and pause immediately.
      v.play().then(() => v.pause()).catch(() => {});
      this.seekFallback(this.lastProgress);
      this.drawFallback();
    });
    v.addEventListener("seeked", () => {
      this.fallbackSeeking = false;
      this.drawFallback();
      // Catch up if progress moved while that seek was in flight.
      const t = this.fallbackTime(this.lastProgress);
      if (t !== null && Math.abs(v.currentTime - t) > 0.02) this.seekFallback(this.lastProgress);
    });
    v.src = this.url;
    document.body.appendChild(v);
    this.fallback = v;
    this.onStats?.({ status: "ready", frameCount: 0, currentFrame: 0, mode: "-" });
  }

  private fallbackTime(p: number) {
    const v = this.fallback;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return null;
    return Math.min(Math.max(0, Math.min(1, p)) * v.duration, Math.max(0, v.duration - 0.001));
  }

  private seekFallback(p: number) {
    const v = this.fallback;
    const t = this.fallbackTime(p);
    if (!v || t === null || this.fallbackSeeking) return;
    if (Math.abs(v.currentTime - t) < 0.001) return;
    this.fallbackSeeking = true;
    v.currentTime = t;
  }

  private drawFallback() {
    const v = this.fallback;
    if (!v || v.readyState < 2) return;
    this.drawCover(v, v.videoWidth, v.videoHeight);
  }

  private cacheFrame(index: number, frame: VideoFrame) {
    const prev = this.frameCache.get(index);
    if (prev && prev !== frame) prev.close();
    this.frameCache.delete(index); // re-inserted below, now most-recently-used
    this.frameCache.set(index, frame);
    if (this.frameCache.size > FRAME_CACHE_SIZE) {
      const oldestKey = this.frameCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.frameCache.get(oldestKey)?.close();
        this.frameCache.delete(oldestKey);
      }
    }
  }

  private handleFrame = (frame: VideoFrame) => {
    const index = this.timestampToIndex.get(frame.timestamp);
    if (index === undefined) {
      frame.close();
      return;
    }
    this.cacheFrame(index, frame);
    if (frame.timestamp === this.targetTimestampUs) {
      this.latestFrame = frame;
      this.drawFrame(frame);
    }
  };

  private emitStats(mode: PlayerStats["mode"] = "-") {
    this.onStats?.({
      status: this.samples.length ? "ready" : "loading",
      frameCount: this.samples.length,
      currentFrame: this.lastFedIndex,
      mode,
    });
  }

  async load(): Promise<void> {
    if (!this.ctx) return; // constructor already logged why
    if (typeof window === "undefined" || typeof window.VideoDecoder === "undefined") {
      this.useFallback("VideoDecoder not supported");
      return;
    }
    let arrayBuffer: MP4ArrayBuffer;
    try {
      const res = await fetch(this.url);
      arrayBuffer = (await res.arrayBuffer()) as MP4ArrayBuffer;
    } catch (e) {
      this.useFallback(e);
      return;
    }
    arrayBuffer.fileStart = 0;

    const mp4file = createFile();

    mp4file.onError = (e: string) => {
      logDebug(`mp4box error (${this.url}): ${e}`);
      this.useFallback(e);
    };

    mp4file.onReady = (info) => {
      if (this.destroyed) return;
      const track = (info as unknown as MP4Info).videoTracks[0];
      if (!track) {
        logDebug(`no video track in ${this.url}`);
        return;
      }

      const trak = mp4file.getTrackById(track.id) as unknown as {
        mdia: { minf: { stbl: { stsd: { entries: Array<{ avcC?: { write: (s: unknown) => void } }> } } } };
      };
      const avcC = trak.mdia.minf.stbl.stsd.entries[0].avcC;
      if (!avcC) {
        logDebug(`no avcC box in ${this.url} — only H.264 is handled`);
        this.useFallback("no avcC box");
        return;
      }
      const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
      avcC.write(stream);
      if (!stream.buffer) return;
      const description = new Uint8Array(stream.buffer, 8);

      this.decoderConfig = {
        codec: track.codec,
        codedWidth: track.video.width,
        codedHeight: track.video.height,
        description,
      };

      try {
        this.decoder = new VideoDecoder({
          output: this.handleFrame,
          error: (e) => {
            logDebug(`decoder error (${this.url}): ${e}`);
            this.useFallback(e);
          },
        });
        this.decoder.configure(this.decoderConfig);
      } catch (e) {
        this.useFallback(e);
        return;
      }
      // Some browsers expose VideoDecoder but can't decode this profile.
      const config = this.decoderConfig;
      VideoDecoder.isConfigSupported(config)
        .then((r) => {
          if (!r.supported) this.useFallback(`unsupported config ${config.codec}`);
        })
        .catch(() => {});

      mp4file.setExtractionOptions(track.id, null, { nbSamples: Infinity });
      mp4file.start();
    };

    mp4file.onSamples = (_id: number, _user: unknown, newSamples: Sample[]) => {
      if (this.destroyed || this.fallback) return;
      for (const s of newSamples) {
        if (!s.data) continue;
        const cts = s.cts / s.timescale;
        const index = this.samples.length;
        this.samples.push({
          data: new Uint8Array(s.data),
          cts,
          duration: s.duration / s.timescale,
          isKeyframe: s.is_sync,
        });
        this.timestampToIndex.set(Math.round(cts * 1e6), index);
        if (s.is_sync) this.keyframeIndices.push(index);
      }
      if (this.lastFedIndex === -1) this.seekToProgress(0);
      this.emitStats();
    };

    mp4file.appendBuffer(arrayBuffer);
    mp4file.flush();
  }

  /** p is 0..1. Call as often as you like — scroll-driven callers can fire
      this many times per frame; actual decode work is coalesced to at most
      once per animation frame (latest value wins). The <video> fallback
      path is cheap enough (one currentTime write, guarded by
      fallbackSeeking) that it stays synchronous instead. */
  seekToProgress(p: number) {
    this.lastProgress = p;
    if (this.fallback) {
      this.seekFallback(p);
      return;
    }
    if (this.rafScheduled) return;
    this.rafScheduled = true;
    requestAnimationFrame(() => {
      this.rafScheduled = false;
      if (!this.destroyed) this.performSeek(this.lastProgress);
    });
  }

  private performSeek(p: number) {
    if (!this.decoder || !this.decoderConfig || this.samples.length === 0) return;
    const clamped = Math.max(0, Math.min(1, p));
    const target = Math.round(clamped * (this.samples.length - 1));
    if (target === this.lastDrawnIndex) return;

    // Already decoded and still cached (typical backward touch-scroll
    // jitter) — redraw it directly, no decoder work at all.
    const cached = this.frameCache.get(target);
    if (cached) {
      this.latestFrame = cached;
      this.targetTimestampUs = Math.round(this.samples[target].cts * 1e6);
      this.drawFrame(cached);
      this.lastDrawnIndex = target;
      this.emitStats("cached");
      return;
    }

    const canContinue =
      target > this.lastFedIndex &&
      target - this.lastFedIndex <= FORWARD_CONTINUE_LIMIT &&
      this.decoder.state === "configured";

    let startIndex: number;
    let mode: PlayerStats["mode"];
    if (canContinue) {
      startIndex = this.lastFedIndex + 1;
      mode = "continue";
    } else {
      let kf = 0;
      for (const k of this.keyframeIndices) {
        if (k <= target) kf = k;
        else break;
      }
      startIndex = kf;
      mode = "reseek";
      this.decoder.reset();
      this.decoder.configure(this.decoderConfig);
    }

    this.targetTimestampUs = Math.round(this.samples[target].cts * 1e6);
    try {
      for (let i = startIndex; i <= target; i++) {
        const s = this.samples[i];
        this.decoder.decode(
          new EncodedVideoChunk({
            type: s.isKeyframe ? "key" : "delta",
            timestamp: Math.round(s.cts * 1e6),
            duration: Math.round(s.duration * 1e6),
            data: s.data,
          }),
        );
      }
    } catch (e) {
      this.useFallback(e);
      this.seekFallback(p);
      return;
    }
    this.lastFedIndex = target;
    this.lastDrawnIndex = target;
    this.emitStats(mode);
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.latestFrame?.close();
    for (const [index, frame] of this.frameCache) {
      if (frame !== this.latestFrame) frame.close();
      this.frameCache.delete(index);
    }
    try {
      this.decoder?.close();
    } catch {
      // already closed
    }
    if (this.fallback) {
      this.fallback.removeAttribute("src");
      this.fallback.load();
      this.fallback.remove();
      this.fallback = null;
    }
  }
}
