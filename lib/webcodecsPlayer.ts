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
   within the source's keyframe interval). Scrubbing backward, or forward
   past that, resets the decoder and replays from the nearest preceding
   keyframe instead. Every decoded frame is closed immediately except the
   one actually being scrubbed to — at most one VideoFrame is ever held
   open per player. */

import { createFile, DataStream, Endianness, type Sample } from "mp4box";

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
  mode: "continue" | "reseek" | "-";
};

const FORWARD_CONTINUE_LIMIT = 36;

export class WebCodecsPlayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private url: string;
  private samples: SampleEntry[] = [];
  private keyframeIndices: number[] = [];
  private decoder: VideoDecoder | null = null;
  private decoderConfig: VideoDecoderConfig | null = null;
  private lastFedIndex = -1;
  private targetTimestampUs = -1;
  private latestFrame: VideoFrame | null = null;
  private resizeObserver: ResizeObserver;
  private destroyed = false;
  public onStats: ((s: PlayerStats) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, url: string) {
    this.canvas = canvas;
    this.url = url;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";

    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(canvas);
    this.resizeCanvas();
  }

  private resizeCanvas() {
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
    }
  }

  private drawFrame(frame: VideoFrame) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = Math.max(cw / frame.displayWidth, ch / frame.displayHeight);
    const dw = frame.displayWidth * scale;
    const dh = frame.displayHeight * scale;
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(frame, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  private handleFrame = (frame: VideoFrame) => {
    if (frame.timestamp === this.targetTimestampUs) {
      this.latestFrame?.close();
      this.latestFrame = frame;
      this.drawFrame(frame);
    } else {
      frame.close();
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
    const res = await fetch(this.url);
    const arrayBuffer = (await res.arrayBuffer()) as MP4ArrayBuffer;
    arrayBuffer.fileStart = 0;

    const mp4file = createFile();

    mp4file.onError = (e: string) => {
      console.error(`mp4box error (${this.url}):`, e);
    };

    mp4file.onReady = (info) => {
      if (this.destroyed) return;
      const track = (info as unknown as MP4Info).videoTracks[0];
      if (!track) {
        console.error(`no video track in ${this.url}`);
        return;
      }

      const trak = mp4file.getTrackById(track.id) as unknown as {
        mdia: { minf: { stbl: { stsd: { entries: Array<{ avcC?: { write: (s: unknown) => void } }> } } } };
      };
      const avcC = trak.mdia.minf.stbl.stsd.entries[0].avcC;
      if (!avcC) {
        console.error(`no avcC box in ${this.url} — only H.264 is handled`);
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

      this.decoder = new VideoDecoder({
        output: this.handleFrame,
        error: (e) => console.error(`decoder error (${this.url}):`, e),
      });
      this.decoder.configure(this.decoderConfig);

      mp4file.setExtractionOptions(track.id, null, { nbSamples: Infinity });
      mp4file.start();
    };

    mp4file.onSamples = (_id: number, _user: unknown, newSamples: Sample[]) => {
      if (this.destroyed) return;
      for (const s of newSamples) {
        if (!s.data) continue;
        this.samples.push({
          data: new Uint8Array(s.data),
          cts: s.cts / s.timescale,
          duration: s.duration / s.timescale,
          isKeyframe: s.is_sync,
        });
        if (s.is_sync) this.keyframeIndices.push(this.samples.length - 1);
      }
      if (this.lastFedIndex === -1) this.seekToProgress(0);
      this.emitStats();
    };

    mp4file.appendBuffer(arrayBuffer);
    mp4file.flush();
  }

  /** p is 0..1. Call as often as you like — each call only does the work
      needed to reach the new target (continue vs. reset+reseek), never
      more. */
  seekToProgress(p: number) {
    if (!this.decoder || !this.decoderConfig || this.samples.length === 0) return;
    const clamped = Math.max(0, Math.min(1, p));
    const target = Math.round(clamped * (this.samples.length - 1));
    if (target === this.lastFedIndex) return;

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
    this.lastFedIndex = target;
    this.emitStats(mode);
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.latestFrame?.close();
    try {
      this.decoder?.close();
    } catch {
      // already closed
    }
  }
}
