"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 *    viewport collapse on the other.
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
  /** Fills its container rather than sitting at a fixed preview width. */
  fill?: boolean;
}

export default function JoinScreen({ url, churchName, langs, fill }: JoinScreenProps) {
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
    <div className={`js-screen${fill ? " js-fill" : ""}`}>
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

/**
 * Static 1920x1080 PNG for one language. A still cannot cycle, so each language
 * gets its own file — which is the behaviour the settings page already had.
 */
export function renderJoinPNG(opts: {
  qrCanvas: HTMLCanvasElement;
  url: string;
  churchName?: string;
  lang: string;
}): string {
  const { qrCanvas, url, churchName, lang } = opts;
  const W = 1920;
  const H = 1080;
  const u = (v: number) => (v * H) / 100; // cqh -> px, identical units to the CSS
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;

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

  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qr + pad * 2, qr + pad * 2, u(1.1));
  ctx.fill();
  ctx.drawImage(qrCanvas, qrX + pad, qrY + pad, qr, qr);

  const tx = qrX + qr + pad * 2 + gap;
  const c = JOIN_COPY[lang] ?? JOIN_COPY.en;
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

  ctx.textAlign = "left";
  ctx.fillStyle = TEXT;
  ctx.font = `600 ${u(8)}px Archivo, system-ui, sans-serif`;
  ctx.fillText(c.say, tx, ty);
  ty += u(3.4);

  ctx.fillStyle = DIM;
  ctx.font = `${u(2.1)}px Archivo, system-ui, sans-serif`;
  ctx.letterSpacing = `${u(0.4)}px`;
  ctx.fillText(c.tag.toUpperCase(), tx, ty);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = LILAC;
  ctx.globalAlpha = 0.82;
  ctx.font = `${u(3.1)}px Archivo, system-ui, sans-serif`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), tx, ty + u(6));
  ctx.globalAlpha = 1;

  return out.toDataURL("image/png");
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
.js-screen.js-fill{height:100%;aspect-ratio:auto}
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
