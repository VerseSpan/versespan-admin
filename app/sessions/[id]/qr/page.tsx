"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { api, getChurchId } from "@/lib/api";

/**
 * The join screen a congregation sees.
 *
 * Built for a 1920x1080 TV, not for paper. Two consequences shape everything:
 *
 *  - Every size is a `cqh` percentage of the frame, so the design is identical
 *    whether it renders in a 900px preview or on a 4K panel. Fixed pixels tuned
 *    against one viewport collapse on the other.
 *  - The instruction is 8cqh (86px at 1080). Comfortable reading distance is
 *    roughly cap-height x 150, so on a 65" screen that carries ~7m — matching
 *    the ~6-7m the code itself scans from. A code nobody can read the
 *    instruction for is no use.
 *
 * The instruction cycles through the church's configured languages rather than
 * stacking them: one at a time is roughly double the type size, which is what
 * makes it readable from the back. Rings pulse out of the code on each change —
 * a signal reaching the room. The code itself never moves, dims, or is drawn
 * over, and stays dark-on-light because inverting a QR breaks older scanners.
 */

const COPY: Record<string, { say: string; tag: string }> = {
  en: { say: "Scan to join", tag: "English" },
  es: { say: "Escanea para unirte", tag: "Español" },
  pt: { say: "Escaneie para entrar", tag: "Português" },
};

const TURN_MS = 3800;

// Palette. Violet identity kept from the original, centred radial glow dropped —
// that look is every dark poster's default. Directional wash instead.
const GROUND = "#0D0918";
const PANEL = "#FFFFFF";
const VIOLET = "#8B5CF6";
const LILAC = "#C4B5FD";
const TEXT = "#EFEBFF";
const DIM = "#8C83A8";

export default function QRDisplayPage() {
  const { id } = useParams<{ id: string }>();
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [churchName, setChurchName] = useState("");
  const [langs, setLangs] = useState<string[]>(["es", "en"]);
  const [active, setActive] = useState(0);
  const [rings, setRings] = useState<number[]>([]);

  const stageRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const ringSeq = useRef(0);

  const watchUrl = `${origin}/watch/${id}`;

  useEffect(() => {
    api
      .getChurch(getChurchId())
      .then((c: { name?: string; settings?: { languages?: string[] } }) => {
        if (c?.name) setChurchName(c.name);
        const configured = c?.settings?.languages;
        if (Array.isArray(configured) && configured.length) setLangs(configured);
      })
      .catch(() => {
        // Fall back to the session's own direction so the screen still works.
        api
          .getSession(id)
          .then((s: { source_language?: string; target_language?: string }) => {
            const pair = [s.source_language, s.target_language].filter(Boolean) as string[];
            if (pair.length) setLangs(Array.from(new Set(pair)));
          })
          .catch(() => {});
      });
  }, [id]);

  // Cycle the instruction, pulsing a ring on each turn.
  useEffect(() => {
    if (langs.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setActive((i) => (i + 1) % langs.length);
      const seq = ++ringSeq.current;
      setRings((r) => [...r, seq]);
      setTimeout(() => setRings((r) => r.filter((x) => x !== seq)), 2700);
    }, TURN_MS);
    return () => clearInterval(t);
  }, [langs.length]);

  const goFullscreen = useCallback(() => {
    stageRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  /** Static 1920x1080 PNG. Both languages stack, since a still can't cycle. */
  const downloadPNG = useCallback(() => {
    const src = exportRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!src) return;

    const W = 1920;
    const H = 1080;
    const u = (v: number) => (v * H) / 100; // cqh -> px, same units as the CSS
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d")!;

    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);

    // Directional wash from two opposite corners — depth without a centred blob.
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
    const textW = Math.min(u(50) * (W / H), 900);
    const blockW = qr + pad * 2 + gap + textW;
    const qrX = (W - blockW) / 2;
    const qrY = (H - (qr + pad * 2)) / 2;

    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qr + pad * 2, qr + pad * 2, u(1.1));
    ctx.fill();
    ctx.drawImage(src, qrX + pad, qrY + pad, qr, qr);

    const tx = qrX + qr + pad * 2 + gap;
    let ty = H / 2 - u(langs.length > 1 ? 13 : 9);

    if (churchName) {
      ctx.fillStyle = VIOLET;
      ctx.fillRect(tx, ty - u(0.9), u(3.4), 1);
      ctx.fillStyle = LILAC;
      ctx.font = `${u(2.6)}px Georgia, serif`;
      ctx.textAlign = "left";
      ctx.letterSpacing = `${u(0.55)}px`;
      ctx.fillText(churchName.toUpperCase(), tx + u(5), ty);
      ctx.letterSpacing = "0px";
      ty += u(7);
    }

    for (const code of langs) {
      const c = COPY[code] ?? COPY.en;
      ctx.fillStyle = TEXT;
      ctx.font = `600 ${u(langs.length > 2 ? 4 : 5.2)}px Archivo, system-ui, sans-serif`;
      ctx.fillText(c.say, tx, ty);
      ty += u(3.1);
      ctx.fillStyle = DIM;
      ctx.font = `${u(2.1)}px Archivo, system-ui, sans-serif`;
      ctx.letterSpacing = `${u(0.4)}px`;
      ctx.fillText(c.tag.toUpperCase(), tx, ty);
      ctx.letterSpacing = "0px";
      ty += u(5);
    }

    ctx.fillStyle = LILAC;
    ctx.globalAlpha = 0.82;
    ctx.font = `${u(3.1)}px Archivo, system-ui, sans-serif`;
    ctx.fillText(watchUrl.replace(/^https?:\/\//, ""), tx, ty + u(1.5));
    ctx.globalAlpha = 1;

    const link = document.createElement("a");
    link.download = `join-${id}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }, [churchName, langs, watchUrl, id]);

  const cycling = langs.length > 1;

  return (
    <>
      <div className="fixed inset-0 bg-[#08060e] flex items-center justify-center">
        <div className="absolute top-5 left-5 print:hidden z-20">
          <Link href={`/sessions/${id}`} className="text-sm text-gray-600 hover:text-gray-300 transition">
            ← Back
          </Link>
        </div>

        <div className="absolute top-5 right-5 flex gap-2 print:hidden z-20">
          <button
            onClick={goFullscreen}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:bg-white/5 transition"
          >
            Full screen
          </button>
          <button
            onClick={downloadPNG}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition"
          >
            Download PNG
          </button>
        </div>

        {/* Hidden high-res source for the PNG export */}
        <div ref={exportRef} className="hidden" aria-hidden>
          {origin && <QRCodeCanvas value={watchUrl} size={1000} level="M" />}
        </div>

        <div ref={stageRef} className="vs-stage">
          <div className="vs-screen">
            <div className="vs-qrwrap">
              <div className="vs-rings">
                <span className="vs-ring steady" />
                <span className="vs-ring steady two" />
                {rings.map((k) => (
                  <span key={k} className="vs-ring" />
                ))}
              </div>
              <div className="vs-qr">{origin && <QRCodeSVG value={watchUrl} size={1000} level="M" bgColor={PANEL} fgColor={GROUND} />}</div>
            </div>

            <div className="vs-side">
              {churchName && <div className="vs-church">{churchName}</div>}
              <div className={`vs-copy${cycling ? "" : " static"}`}>
                {langs.map((code, i) => {
                  const c = COPY[code] ?? COPY.en;
                  return (
                    <div key={code} className={`vs-line${!cycling || i === active ? " on" : ""}`}>
                      <div className="vs-say">{c.say}</div>
                      <div className="vs-tag">{c.tag}</div>
                    </div>
                  );
                })}
              </div>
              <div className="vs-foot">{watchUrl.replace(/^https?:\/\//, "")}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .vs-stage{width:min(96vw, calc(96vh * 16 / 9));aspect-ratio:16/9;display:flex}
        .vs-stage:fullscreen{width:100vw;height:100vh;aspect-ratio:auto;background:${GROUND}}
        .vs-stage:fullscreen .vs-screen{width:100%;height:100%}

        /* container-type makes every cqh below a percentage of THIS frame, so
           the layout is identical at 900px and at 1920px. */
        .vs-screen{
          container-type:size;position:relative;overflow:hidden;width:100%;aspect-ratio:16/9;
          background:
            radial-gradient(120% 90% at 18% 0%, rgba(139,92,246,.20) 0%, rgba(139,92,246,0) 58%),
            radial-gradient(90% 80% at 100% 100%, rgba(99,60,190,.16) 0%, rgba(99,60,190,0) 55%),
            ${GROUND};
          color:${TEXT};display:flex;align-items:center;justify-content:center;
          gap:7cqh;padding:7cqh 6.5cqh;
        }
        .vs-screen::after{content:"";position:absolute;inset:3.2cqh;border:1px solid rgba(196,181,253,.16);pointer-events:none}

        .vs-rings{position:absolute;inset:0;pointer-events:none;z-index:0}
        .vs-ring{position:absolute;left:50%;top:50%;width:100%;height:100%;
          border:.28cqh solid ${VIOLET};border-radius:50%;
          transform:translate(-50%,-50%) scale(.98);opacity:.38;
          animation:vs-emit 2.6s cubic-bezier(.22,.7,.3,1) forwards}
        @keyframes vs-emit{to{transform:translate(-50%,-50%) scale(1.85);opacity:0}}
        .vs-ring.steady{animation:none;opacity:.09;transform:translate(-50%,-50%) scale(1.22)}
        .vs-ring.steady.two{opacity:.05;transform:translate(-50%,-50%) scale(1.5)}

        /* Height-driven: in 16:9 the height limits a square, so the code takes
           66% of it and the width follows. Large enough to scan from ~6-7m,
           small enough that the type keeps the room it needs. */
        .vs-qrwrap{position:relative;flex:none;height:66cqh;aspect-ratio:1;z-index:1}
        .vs-qr{position:relative;height:100%;aspect-ratio:1;background:${PANEL};
          padding:1.5cqh;border-radius:1.1cqh;line-height:0;
          box-shadow:0 0 0 1px rgba(196,181,253,.18), 0 1cqh 3cqh rgba(20,8,50,.42)}
        .vs-qr svg{display:block;width:100%;height:100%;border-radius:.3cqh}

        .vs-side{position:relative;z-index:1;display:flex;flex-direction:column;
          justify-content:center;flex:0 1 auto;min-width:0;max-width:50cqw}

        .vs-church{font-family:Literata,Georgia,serif;font-size:2.6cqh;letter-spacing:.22em;
          text-transform:uppercase;color:${LILAC};display:flex;align-items:center;gap:1.6cqh}
        .vs-church::before{content:"";width:3.4cqh;height:1px;background:${VIOLET};flex:none}

        .vs-copy{position:relative;width:100%;margin:3.4cqh 0 0;height:25cqh}
        .vs-copy.static{height:auto}
        .vs-line{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;
          gap:1.1cqh;opacity:0;transform:translateY(1.2cqh);
          transition:opacity .55s ease, transform .55s cubic-bezier(.2,.8,.3,1)}
        .vs-copy.static .vs-line{position:relative;inset:auto;opacity:1;transform:none;margin-bottom:2.2cqh}
        .vs-line.on{opacity:1;transform:none}
        .vs-say{font-family:Archivo,system-ui,sans-serif;font-weight:600;font-size:8cqh;
          letter-spacing:-.025em;line-height:1.04;text-wrap:balance}
        .vs-copy.static .vs-say{font-size:5.2cqh}
        .vs-tag{font-size:2.1cqh;letter-spacing:.2em;text-transform:uppercase;color:${DIM}}

        .vs-foot{margin-top:4cqh;font-size:3.1cqh;letter-spacing:.04em;color:${LILAC};
          opacity:.82;font-variant-numeric:tabular-nums;word-break:break-all}

        @media (prefers-reduced-motion:reduce){
          .vs-ring{animation:none;opacity:.09;transform:translate(-50%,-50%) scale(1.3)}
          .vs-line{transition:none}
        }
      `}</style>
    </>
  );
}
