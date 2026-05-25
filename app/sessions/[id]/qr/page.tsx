"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import Link from "next/link";

export default function QRDisplayPage() {
  const { id } = useParams<{ id: string }>();
  const [origin, setOrigin] = useState("");
  const downloadCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const watchUrl = `${origin}/watch/${id}`;

  function downloadPNG() {
    const qrCanvas = downloadCanvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!qrCanvas) return;

    const qrSize = 400;
    const padding = 40;
    const textHeight = 120;
    const out = document.createElement("canvas");
    out.width = qrSize + padding * 2;
    out.height = qrSize + padding * 2 + textHeight;
    const ctx = out.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize);

    ctx.textAlign = "center";
    const cx = out.width / 2;

    ctx.fillStyle = "#111827";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText("Join Live Translation", cx, qrSize + padding * 2 + 28);

    ctx.fillStyle = "#6b7280";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText("Scan to hear in your language", cx, qrSize + padding * 2 + 58);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px monospace";
    ctx.fillText(watchUrl, cx, qrSize + padding * 2 + 90);

    const link = document.createElement("a");
    link.download = `versespan-qr-${id}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 py-12">
      {/* Back link */}
      <div className="absolute top-4 left-4 print:hidden">
        <Link href={`/sessions/${id}`} className="text-sm text-gray-400 hover:text-gray-700 transition">
          ← Back to session
        </Link>
      </div>

      {/* Action buttons */}
      <div className="absolute top-4 right-4 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Save as PDF
        </button>
        <button
          onClick={downloadPNG}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
        >
          Download PNG
        </button>
      </div>

      {/* Hidden high-res canvas for PNG export */}
      <div ref={downloadCanvasRef} className="hidden" aria-hidden>
        {origin && <QRCodeCanvas value={watchUrl} size={400} level="M" />}
      </div>

      {/* Visible QR card */}
      <div className="flex flex-col items-center gap-6 max-w-xs w-full">
        <div className="bg-white rounded-3xl shadow-xl p-10 flex flex-col items-center gap-6 w-full border border-gray-100 print:shadow-none print:border-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">Join Live Translation</p>
            <p className="text-gray-500 text-sm mt-1">Scan to hear in your language</p>
          </div>

          {origin && (
            <div className="p-3 rounded-2xl border-4 border-gray-900 bg-white">
              <QRCodeSVG value={watchUrl} size={220} level="M" />
            </div>
          )}

          <p className="text-xs text-gray-400 text-center break-all font-mono">{watchUrl}</p>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          @page { size: A4; margin: 2cm; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
        }
      `}</style>
    </div>
  );
}
