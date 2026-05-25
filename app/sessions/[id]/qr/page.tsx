"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import Link from "next/link";
import { api } from "@/lib/api";

const POSTER_TEXT: Record<string, { headline: string; subtitle: string }> = {
  en: {
    headline: "Join Live Translation",
    subtitle: "Scan with your phone camera to follow along",
  },
  es: {
    headline: "Únete a la Traducción en Vivo",
    subtitle: "Escanea con tu cámara para seguir la sesión",
  },
  pt: {
    headline: "Acesse a Tradução ao Vivo",
    subtitle: "Escaneie com a câmera do seu celular para acompanhar",
  },
};

export default function QRDisplayPage() {
  const { id } = useParams<{ id: string }>();
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [targetLang, setTargetLang] = useState("en");
  const downloadCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getSession(id).then((s: { target_language?: string }) => {
      if (s.target_language) setTargetLang(s.target_language);
    }).catch(() => {});
  }, [id]);

  const text = POSTER_TEXT[targetLang] ?? POSTER_TEXT.en;
  const watchUrl = `${origin}/watch/${id}`;

  function downloadPNG() {
    const qrCanvas = downloadCanvasRef.current?.querySelector(
      "canvas"
    ) as HTMLCanvasElement | null;
    if (!qrCanvas) return;

    const W = 1920;
    const H = 1080;
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d")!;

    // Background
    ctx.fillStyle = "#07070f";
    ctx.fillRect(0, 0, W, H);

    // Radial glow
    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 600);
    glow.addColorStop(0, "rgba(99,60,180,0.28)");
    glow.addColorStop(0.5, "rgba(79,40,160,0.10)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // QR white card
    const qrSize = 340;
    const pad = 28;
    const cardSize = qrSize + pad * 2;
    const cardX = (W - cardSize) / 2;
    const cardY = H / 2 - cardSize / 2 - 64;
    const r = 20;

    ctx.shadowColor = "rgba(120,80,255,0.45)";
    ctx.shadowBlur = 60;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.lineTo(cardX + cardSize - r, cardY);
    ctx.arcTo(cardX + cardSize, cardY, cardX + cardSize, cardY + r, r);
    ctx.lineTo(cardX + cardSize, cardY + cardSize - r);
    ctx.arcTo(cardX + cardSize, cardY + cardSize, cardX + cardSize - r, cardY + cardSize, r);
    ctx.lineTo(cardX + r, cardY + cardSize);
    ctx.arcTo(cardX, cardY + cardSize, cardX, cardY + cardSize - r, r);
    ctx.lineTo(cardX, cardY + r);
    ctx.arcTo(cardX, cardY, cardX + r, cardY, r);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.drawImage(qrCanvas, cardX + pad, cardY + pad, qrSize, qrSize);

    // Headline
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 68px system-ui, -apple-system, sans-serif";
    ctx.fillText(text.headline, W / 2, cardY + cardSize + 80);

    // Subtitle
    ctx.fillStyle = "#6b7280";
    ctx.font = "30px system-ui, -apple-system, sans-serif";
    ctx.fillText(text.subtitle, W / 2, cardY + cardSize + 130);

    // Branding top
    ctx.fillStyle = "#7c5cfc";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.letterSpacing = "0.2em";
    ctx.fillText("VERSESPAN", W / 2, 56);

    // URL bottom
    ctx.fillStyle = "#374151";
    ctx.font = "18px monospace";
    ctx.fillText(watchUrl, W / 2, H - 36);

    const link = document.createElement("a");
    link.download = `versespan-qr-${id}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }

  return (
    <>
      <div className="fixed inset-0 bg-[#07070f] flex items-center justify-center print:bg-[#07070f]">
        {/* Back */}
        <div className="absolute top-5 left-5 print:hidden z-10">
          <Link
            href={`/sessions/${id}`}
            className="text-sm text-gray-600 hover:text-gray-300 transition"
          >
            ← Back
          </Link>
        </div>

        {/* Buttons */}
        <div className="absolute top-5 right-5 flex gap-2 print:hidden z-10">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:bg-white/5 transition"
          >
            Save as PDF
          </button>
          <button
            onClick={downloadPNG}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition"
          >
            Download PNG
          </button>
        </div>

        {/* Hidden canvas for export */}
        <div ref={downloadCanvasRef} className="hidden" aria-hidden>
          {origin && <QRCodeCanvas value={watchUrl} size={340} level="M" />}
        </div>

        {/* 16:9 Poster */}
        <div
          className="relative w-full"
          style={{
            maxWidth: "min(95vw, calc(95vh * 16 / 9))",
            aspectRatio: "16 / 9",
          }}
        >
          {/* Glow layer */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background:
                "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(99,60,180,0.25) 0%, rgba(60,20,120,0.08) 55%, transparent 100%)",
            }}
          />

          {/* Content */}
          <div className="relative flex flex-col items-center justify-center h-full gap-7">
            {/* Brand */}
            <p className="absolute top-[6%] text-[#7c5cfc] text-xs font-bold tracking-[0.3em] uppercase">
              VERSESPAN
            </p>

            {/* QR */}
            {origin && (
              <div
                className="bg-white rounded-2xl p-5"
                style={{
                  boxShadow: "0 0 80px 8px rgba(120,80,255,0.3)",
                }}
              >
                <QRCodeSVG value={watchUrl} size={200} level="M" />
              </div>
            )}

            {/* Text */}
            <div className="text-center">
              <p className="text-white font-bold tracking-tight"
                style={{ fontSize: "clamp(1.6rem, 3.8vw, 3.5rem)" }}>
                {text.headline}
              </p>
              <p className="text-gray-500 mt-2"
                style={{ fontSize: "clamp(0.85rem, 1.6vw, 1.4rem)" }}>
                {text.subtitle}
              </p>
            </div>

            {/* URL */}
            <p
              className="absolute bottom-[6%] text-gray-700 font-mono"
              style={{ fontSize: "clamp(0.6rem, 0.9vw, 0.85rem)" }}
            >
              {watchUrl}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; background: #07070f; }
          @page { size: 1920px 1080px landscape; margin: 0; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
