"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

/**
 * The join screen a congregation sees — one component so the design exists in
 * exactly one place. There were previously two divergent copies of this poster
 * (settings and an unlinked session route), which is how the branded, 340px
 * version stayed live while a reworked one sat on a page nothing linked to.
 *
 * Built for a 1920x1080 TV. Two things follow from that:
 *
 *  - Every size is a `cqh` percentage of the frame, so the design is identical
 *    in a small preview and on a 4K panel. Fixed pixels tuned against one
 *    viewport collapse on the other. The flip side of container-type:size is
 *    that the frame MUST get a real height — its own 16:9 aspect does that.
 *    A `height:100%` against an auto-height parent collapses every cqh to zero
 *    and renders nothing but the background gradient.
 *  - The instruction is 8cqh (86px at 1080). Comfortable reading distance is
 *    roughly cap-height x 150, so on a 65" screen that carries ~7m — matching
 *    the ~6-7m the code itself scans from. A code nobody can read the
 *    instruction for is no use.
 *
 * The instruction cycles through the church's languages rather than stacking
 * them: one at a time is roughly double the type size, which is the whole
 * legibility gain. Rings pulse out of the code on each change. The code never
 * moves, dims, or gets drawn over, and stays dark-on-light because inverting a
 * QR breaks older scanners.
 */

export const JOIN_COPY: Record<string, { say: string; tag: string }> = {
  en: { say: "Scan to join", tag: "English" },
  es: { say: "Escanea para unirte", tag: "Español" },
  pt: { say: "Escaneie para entrar", tag: "Português" },
};

const TURN_MS = 3800;

export const GROUND = "#0D0918";
export const PANEL = "#FFFFFF";
export const VIOLET = "#8B5CF6";
export const LILAC = "#C4B5FD";
export const TEXT = "#EFEBFF";
export const DIM = "#8C83A8";

export interface JoinScreenProps {
  /** The URL the code encodes — the static /join/{slug} URL. */
  url: string;
  churchName?: string;
  /** Languages to cycle. One language renders static, with no rings. */
  langs: string[];
}

export default function JoinScreen({ url, churchName, langs }: JoinScreenProps) {
  const [active, setActive] = useState(0);
  const [rings, setRings] = useState<number[]>([]);
  const seq = useRef(0);

  const cycling = langs.length > 1;

  useEffect(() => {
    if (!cycling) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setActive((i) => (i + 1) % langs.length);
      const k = ++seq.current;
      setRings((r) => [...r, k]);
      setTimeout(() => setRings((r) => r.filter((x) => x !== k)), 2700);
    }, TURN_MS);
    return () => clearInterval(t);
  }, [cycling, langs.length]);

  const shown = url.replace(/^https?:\/\//, "");

  return (
    <div className="js-screen">
      <div className="js-qrwrap">
        <div className="js-rings">
          <span className="js-ring steady" />
          <span className="js-ring steady two" />
          {rings.map((k) => (
            <span key={k} className="js-ring" />
          ))}
        </div>
        <div className="js-qr">
          <QRCodeSVG value={url} size={1000} level="M" bgColor={PANEL} fgColor={GROUND} />
        </div>
      </div>

      <div className="js-side">
        {churchName ? <div className="js-church">{churchName}</div> : null}
        <div className={`js-copy${cycling ? "" : " static"}`}>
          {langs.map((code, i) => {
            const c = JOIN_COPY[code] ?? JOIN_COPY.en;
            return (
              <div key={code} className={`js-line${!cycling || i === active ? " on" : ""}`}>
                <div className="js-say">{c.say}</div>
                <div className="js-tag">{c.tag}</div>
              </div>
            );
          })}
        </div>
        <div className="js-foot">{shown}</div>
      </div>

      <style>{JOIN_SCREEN_CSS}</style>
    </div>
  );
}

/** Off-screen high-res canvas the PNG export draws from. */
export function JoinQRSource({ url, refEl }: { url: string; refEl: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={refEl} className="hidden" aria-hidden>
      <QRCodeCanvas value={url} size={1000} level="M" />
    </div>
  );
}

export const LOOP_TURN_MS = TURN_MS;
const RING_MS = 2600;

/**
 * Draw one frame of the join screen onto a 2D context, as a pure function of
 * time. Both outputs come through here — the PNG is this at t=0, the video is
 * this sampled per frame — so there is ONE drawing path rather than a separate
 * still renderer and a separate video renderer that can drift apart.
 *
 * Deliberately not rendered server-side: the design would then exist a third
 * time (CSS, canvas, and something in Python), and two copies is already what
 * let the old branded poster stay live after it had supposedly been replaced.
 */
export function drawJoinFrame(
  ctx: CanvasRenderingContext2D,
  opts: { t: number; url: string; churchName?: string; langs: string[]; W: number; H: number },
) {
  const { t, url, churchName, langs, W, H } = opts;
  const u = (v: number) => (v * H) / 100; // cqh -> px, identical units to the CSS

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);

  // Directional wash from two opposite corners — depth without the centred blob
  // that every dark poster defaults to.
  const washes: [number, number, number, string][] = [
    [W * 0.18, 0, W * 0.75, "rgba(139,92,246,0.20)"],
    [W, H, W * 0.6, "rgba(99,60,190,0.16)"],
  ];
  for (const [x, y, r, color] of washes) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.strokeStyle = "rgba(196,181,253,0.16)";
  ctx.lineWidth = 1;
  ctx.strokeRect(u(3.2), u(3.2), W - u(6.4), H - u(6.4));

  const qr = u(66);
  const pad = u(1.5);
  const gap = u(7);
  const textW = 760;
  const blockW = qr + pad * 2 + gap + textW;
  const qrX = (W - blockW) / 2;
  const qrY = (H - (qr + pad * 2)) / 2;
  const cx = qrX + (qr + pad * 2) / 2;
  const cy = qrY + (qr + pad * 2) / 2;

  // Rings pulse from behind the code on each language turn. Drawn BEFORE the
  // panel so they can never cross the code itself.
  const cycling = langs.length > 1;
  if (cycling) {
    const phase = t % LOOP_TURN_MS;
    const base = qr / 2;
    for (const seed of [0.09, 0.05]) {
      ctx.strokeStyle = `rgba(139,92,246,${seed})`;
      ctx.lineWidth = u(0.28);
      ctx.beginPath();
      ctx.arc(cx, cy, base * (seed === 0.09 ? 1.22 : 1.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (phase < RING_MS) {
      const p = phase / RING_MS;
      // Matches the CSS cubic-bezier(.22,.7,.3,1) closely enough to read the same.
      const eased = 1 - Math.pow(1 - p, 3);
      ctx.strokeStyle = `rgba(139,92,246,${0.38 * (1 - p)})`;
      ctx.lineWidth = u(0.28);
      ctx.beginPath();
      ctx.arc(cx, cy, base * (0.98 + eased * 0.87), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qr + pad * 2, qr + pad * 2, u(1.1));
  ctx.fill();

  const tx = qrX + qr + pad * 2 + gap;
  const idx = cycling ? Math.floor(t / LOOP_TURN_MS) % langs.length : 0;
  const c = JOIN_COPY[langs[idx]] ?? JOIN_COPY.en;

  // Cross-fade the instruction the way the CSS transition does.
  const into = cycling ? Math.min((t % LOOP_TURN_MS) / 550, 1) : 1;
  let ty = H / 2 - u(4);

  if (churchName) {
    ctx.fillStyle = VIOLET;
    ctx.fillRect(tx, ty - u(0.9), u(3.4), 1);
    ctx.fillStyle = LILAC;
    ctx.font = `${u(2.6)}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.letterSpacing = `${u(0.55)}px`;
    ctx.fillText(churchName.toUpperCase(), tx + u(5), ty);
    ctx.letterSpacing = "0px";
    ty += u(8);
  }

  ctx.save();
  ctx.globalAlpha = into;
  ctx.translate(0, (1 - into) * u(1.2));
  ctx.textAlign = "left";
  ctx.fillStyle = TEXT;
  ctx.font = `600 ${u(8)}px Archivo, system-ui, sans-serif`;
  ctx.fillText(c.say, tx, ty);
  ctx.fillStyle = DIM;
  ctx.font = `${u(2.1)}px Archivo, system-ui, sans-serif`;
  ctx.letterSpacing = `${u(0.4)}px`;
  ctx.fillText(c.tag.toUpperCase(), tx, ty + u(3.4));
  ctx.letterSpacing = "0px";
  ctx.restore();

  ctx.fillStyle = LILAC;
  ctx.globalAlpha = 0.82;
  ctx.font = `${u(3.1)}px Archivo, system-ui, sans-serif`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), tx, ty + u(9.4));
  ctx.globalAlpha = 1;
}

/**
 * Static 1920x1080 PNG — the frame at t=0, so it cannot drift from the video.
 * Kept as the fallback for browsers that cannot record.
 */
export function renderJoinPNG(opts: {
  qrCanvas: HTMLCanvasElement;
  url: string;
  churchName?: string;
  lang: string;
}): string {
  const W = 1920;
  const H = 1080;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;
  drawJoinFrame(ctx, { t: 0, url: opts.url, churchName: opts.churchName, langs: [opts.lang], W, H });
  const qrSize = H * 0.66;
  const qrPad = H * 0.015;
  const qrX = (W - (qrSize + qrPad * 2 + H * 0.07 + 760)) / 2;
  const qrY = (H - (qrSize + qrPad * 2)) / 2;
  ctx.drawImage(opts.qrCanvas, qrX + qrPad, qrY + qrPad, qrSize, qrSize);
  return out.toDataURL("image/png");
}

/** Which container the browser will actually give us, MP4 first. */
export function pickVideoType(): { mimeType: string; ext: string } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  const candidates = [
    // ProPresenter plays H.264 MP4/MOV. WebM is the fallback only because some
    // browsers still cannot record MP4 — it may not import cleanly.
    { mimeType: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { mimeType: "video/mp4", ext: "mp4" },
    { mimeType: "video/webm;codecs=vp9", ext: "webm" },
    { mimeType: "video/webm", ext: "webm" },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mimeType)) ?? null;
}

/**
 * Record one full loop of the animation at 1920x1080 and resolve a Blob.
 *
 * Recorded in real time from a canvas rather than encoded frame-by-frame: the
 * alternative is shipping ffmpeg.wasm (~25MB) for a file generated a handful of
 * times a year. The trade is that a 2-language loop takes its own 7.6s to
 * produce, which is why the caller shows progress.
 */
export function recordJoinLoop(opts: {
  qrCanvas: HTMLCanvasElement;
  url: string;
  churchName?: string;
  langs: string[];
  onProgress?: (fraction: number) => void;
}): Promise<{ blob: Blob; ext: string }> {
  const { qrCanvas, url, churchName, langs, onProgress } = opts;
  const W = 1920;
  const H = 1080;
  const loopMs = Math.max(langs.length, 1) * LOOP_TURN_MS;

  const picked = pickVideoType();
  if (!picked) return Promise.reject(new Error("This browser cannot record video."));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const qrX = (W - (1080 * 0.66 + (1080 * 0.015) * 2 + 1080 * 0.07 + 760)) / 2;
  const qrSize = 1080 * 0.66;
  const qrPad = 1080 * 0.015;
  const qrY = (H - (qrSize + qrPad * 2)) / 2;

  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: picked.mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  return new Promise((resolve, reject) => {
    rec.onerror = () => reject(new Error("Recording failed."));
    rec.onstop = () => resolve({ blob: new Blob(chunks, { type: picked.mimeType }), ext: picked.ext });

    const started = performance.now();
    let raf = 0;
    const tick = () => {
      const t = performance.now() - started;
      if (t >= loopMs) {
        cancelAnimationFrame(raf);
        rec.stop();
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      drawJoinFrame(ctx, { t, url, churchName, langs, W, H });
      // The code is drawn on top of the frame every tick so it is never
      // occluded by a ring or a fade.
      ctx.drawImage(qrCanvas, qrX + qrPad, qrY + qrPad, qrSize, qrSize);
      onProgress?.(t / loopMs);
      raf = requestAnimationFrame(tick);
    };

    rec.start();
    raf = requestAnimationFrame(tick);
  });
}

export const JOIN_SCREEN_CSS = `
.js-screen{
  container-type:size;position:relative;overflow:hidden;
  width:100%;aspect-ratio:16/9;
  background:
    radial-gradient(120% 90% at 18% 0%, rgba(139,92,246,.20) 0%, rgba(139,92,246,0) 58%),
    radial-gradient(90% 80% at 100% 100%, rgba(99,60,190,.16) 0%, rgba(99,60,190,0) 55%),
    ${GROUND};
  color:${TEXT};display:flex;align-items:center;justify-content:center;
  gap:7cqh;padding:7cqh 6.5cqh;
}
.js-screen::after{content:"";position:absolute;inset:3.2cqh;border:1px solid rgba(196,181,253,.16);pointer-events:none}

.js-rings{position:absolute;inset:0;pointer-events:none;z-index:0}
.js-ring{position:absolute;left:50%;top:50%;width:100%;height:100%;
  border:.28cqh solid ${VIOLET};border-radius:50%;
  transform:translate(-50%,-50%) scale(.98);opacity:.38;
  animation:js-emit 2.6s cubic-bezier(.22,.7,.3,1) forwards}
@keyframes js-emit{to{transform:translate(-50%,-50%) scale(1.85);opacity:0}}
.js-ring.steady{animation:none;opacity:.09;transform:translate(-50%,-50%) scale(1.22)}
.js-ring.steady.two{opacity:.05;transform:translate(-50%,-50%) scale(1.5)}

/* Height-driven: in 16:9 the height limits a square, so the code takes 66% of
   it and the width follows. Large enough to scan from ~6-7m, small enough that
   the type keeps the room it needs to be read from the same distance. */
.js-qrwrap{position:relative;flex:none;height:66cqh;aspect-ratio:1;z-index:1}
.js-qr{position:relative;height:100%;aspect-ratio:1;background:${PANEL};
  padding:1.5cqh;border-radius:1.1cqh;line-height:0;
  box-shadow:0 0 0 1px rgba(196,181,253,.18), 0 1cqh 3cqh rgba(20,8,50,.42)}
.js-qr svg{display:block;width:100%;height:100%;border-radius:.3cqh}

.js-side{position:relative;z-index:1;display:flex;flex-direction:column;
  justify-content:center;flex:0 1 auto;min-width:0;max-width:50cqw}

.js-church{font-family:Literata,Georgia,serif;font-size:2.6cqh;letter-spacing:.22em;
  text-transform:uppercase;color:${LILAC};display:flex;align-items:center;gap:1.6cqh}
.js-church::before{content:"";width:3.4cqh;height:1px;background:${VIOLET};flex:none}

.js-copy{position:relative;width:100%;margin:3.4cqh 0 0;height:25cqh}
.js-copy.static{height:auto}
.js-line{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;
  gap:1.1cqh;opacity:0;transform:translateY(1.2cqh);
  transition:opacity .55s ease, transform .55s cubic-bezier(.2,.8,.3,1)}
.js-copy.static .js-line{position:relative;inset:auto;opacity:1;transform:none}
.js-line.on{opacity:1;transform:none}
.js-say{font-family:Archivo,system-ui,sans-serif;font-weight:600;font-size:8cqh;
  letter-spacing:-.025em;line-height:1.04;text-wrap:balance}
.js-tag{font-size:2.1cqh;letter-spacing:.2em;text-transform:uppercase;color:${DIM}}

.js-foot{margin-top:4cqh;font-size:3.1cqh;letter-spacing:.04em;color:${LILAC};
  opacity:.82;font-variant-numeric:tabular-nums;word-break:break-all}

@media (prefers-reduced-motion:reduce){
  .js-ring{animation:none;opacity:.09;transform:translate(-50%,-50%) scale(1.3)}
  .js-line{transition:none}
}
`;
