"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { api, getChurchId } from "@/lib/api";
import { SUPPORTED_LANGUAGES, getLangName } from "@/lib/languages";

interface PPStatus {
  feature_enabled: boolean;
  bridge_connected: boolean;
  active_presentation: string | null;
}

export default function SettingsPage() {
  const [ppStatus, setPpStatus] = useState<PPStatus | null>(null);
  const [ppAdvanced, setPpAdvanced] = useState(false);
  const [ppHost, setPpHost] = useState("localhost");
  const [ppPort, setPpPort] = useState(50001);
  const [ppSaving, setPpSaving] = useState(false);
  const [ppCode, setPpCode] = useState<string | null>(null);
  const [ppCodeCopied, setPpCodeCopied] = useState(false);

  useEffect(() => {
    api.proPresenterStatus()
      .then((s) => setPpStatus(s as PPStatus))
      .catch(() => {});
  }, []);

  async function savePpSettings(e: React.FormEvent) {
    e.preventDefault();
    setPpSaving(true);
    try {
      await api.proPresenterSaveSettings({ host: ppHost, port: ppPort });
    } catch {}
    setPpSaving(false);
  }

  const [form, setForm] = useState({
    bible_version_source: "RV1960",
    bible_version_target: "KJV",
  });
  const [churchLanguages, setChurchLanguages] = useState<string[]>(["es", "en"]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugSaved, setSlugSaved] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

  useEffect(() => {
    const churchId = getChurchId();
    api.getChurch(churchId)
      .then((church) => {
        const c = church as Record<string, unknown>;
        setForm({
          bible_version_source: (c.bible_version_source as string) || "RV1960",
          bible_version_target: (c.bible_version_target as string) || "KJV",
        });
        const settings = (c.settings as Record<string, unknown>) || {};
        setChurchLanguages((settings.languages as string[]) || ["es", "en"]);
        if (c.slug) setSlug(c.slug as string);
      })
      .catch(() => {}); // silently fail — form has sensible defaults
  }, []);

  async function handleSlugSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSlugSaving(true);
    setSlugError(null);
    setSlugSaved(false);
    try {
      await api.setChurchSlug(getChurchId(), slug.trim());
      setSlugSaved(true);
      setTimeout(() => setSlugSaved(false), 3000);
    } catch (err: unknown) {
      setSlugError((err as Error).message || "Failed to save slug");
    } finally {
      setSlugSaving(false);
    }
  }

  const joinUrl = slug ? `${origin}/join/${slug}` : "";
  const qrDownloadRef = useRef<HTMLDivElement>(null);

  const POSTER_TEXT: Record<string, { headline: string; subtitle: string }> = {
    en: { headline: "Join Live Translation", subtitle: "Scan with your phone camera to follow along" },
    es: { headline: "Únete a la Traducción en Vivo", subtitle: "Escanea con tu cámara para seguir la sesión" },
  };

  function downloadPNG(lang: "en" | "es") {
    const qrCanvas = qrDownloadRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!qrCanvas || !joinUrl) return;

    const { headline, subtitle } = POSTER_TEXT[lang];
    const W = 1920, H = 1080;
    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const ctx = out.getContext("2d")!;

    ctx.fillStyle = "#07070f";
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 600);
    glow.addColorStop(0, "rgba(99,60,180,0.28)");
    glow.addColorStop(0.5, "rgba(79,40,160,0.10)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const qrSize = 340, pad = 28, cardSize = qrSize + pad * 2;
    const cardX = (W - cardSize) / 2, cardY = H / 2 - cardSize / 2 - 64, r = 20;
    ctx.shadowColor = "rgba(120,80,255,0.45)"; ctx.shadowBlur = 60;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY); ctx.lineTo(cardX + cardSize - r, cardY);
    ctx.arcTo(cardX + cardSize, cardY, cardX + cardSize, cardY + r, r);
    ctx.lineTo(cardX + cardSize, cardY + cardSize - r);
    ctx.arcTo(cardX + cardSize, cardY + cardSize, cardX + cardSize - r, cardY + cardSize, r);
    ctx.lineTo(cardX + r, cardY + cardSize);
    ctx.arcTo(cardX, cardY + cardSize, cardX, cardY + cardSize - r, r);
    ctx.lineTo(cardX, cardY + r);
    ctx.arcTo(cardX, cardY, cardX + r, cardY, r);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.drawImage(qrCanvas, cardX + pad, cardY + pad, qrSize, qrSize);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 68px system-ui, -apple-system, sans-serif";
    ctx.fillText(headline, W / 2, cardY + cardSize + 80);
    ctx.fillStyle = "#6b7280";
    ctx.font = "30px system-ui, -apple-system, sans-serif";
    ctx.fillText(subtitle, W / 2, cardY + cardSize + 130);
    ctx.fillStyle = "#7c5cfc";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText("VERSESPAN", W / 2, 56);
    ctx.fillStyle = "#374151";
    ctx.font = "18px monospace";
    ctx.fillText(joinUrl, W / 2, H - 36);

    const link = document.createElement("a");
    link.download = `versespan-join-qr-${lang}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function toggleLanguage(code: string) {
    setChurchLanguages(prev => {
      if (prev.includes(code)) {
        // Must keep at least 2 languages
        if (prev.length <= 2) return prev;
        return prev.filter(l => l !== code);
      }
      return [...prev, code];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (churchLanguages.length < 2) {
      setError("At least 2 languages are required");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.saveChurchSettings(getChurchId(), { ...form, languages: churchLanguages });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Settings</h1>
      <form onSubmit={handleSubmit} className="space-y-8 bg-white rounded shadow p-8">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-bold mb-1 text-gray-900">Bible Version (Source)</label>
            <select
              name="bible_version_source"
              className="w-full border rounded px-3 py-2 text-gray-900"
              value={form.bible_version_source}
              onChange={handleChange}
            >
              <option value="RV1960">RV1960</option>
              <option value="RV1909">RV1909</option>
              <option value="NVI">NVI</option>
            </select>
          </div>
          <div>
            <label className="block text-base font-bold mb-1 text-gray-900">Bible Version (Target)</label>
            <select
              name="bible_version_target"
              className="w-full border rounded px-3 py-2 text-gray-900"
              value={form.bible_version_target}
              onChange={handleChange}
            >
              <option value="KJV">KJV</option>
              <option value="NIV">NIV</option>
              <option value="ESV">ESV</option>
              <option value="NLT">NLT</option>
            </select>
          </div>
        </div>

        {/* Languages */}
        <div>
          <label className="block text-base font-bold mb-2 text-gray-900">Active Languages</label>
          <p className="text-sm text-gray-500 mb-3">
            Select all languages your church uses. Songs must have text in each active language.
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <label key={code} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={churchLanguages.includes(code)}
                  onChange={() => toggleLanguage(code)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-800">{getLangName(code)} ({code})</span>
              </label>
            ))}
          </div>
          {churchLanguages.length < 2 && (
            <p className="text-xs text-red-500 mt-1">At least 2 languages required.</p>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-4 justify-end items-center">
          {saved && <span className="text-green-600 text-sm font-medium">Settings saved</span>}
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* NFC / QR Join URL */}
      <div className="bg-white rounded shadow p-8 mt-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">NFC &amp; QR Join URL</h2>
        <p className="text-sm text-gray-500 mb-4">
          Set a short slug to create a static URL for NFC cards and printed QR codes.
          Tapping or scanning will redirect to the active session automatically.
        </p>
        <form onSubmit={handleSlugSubmit} className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Church slug</label>
              <div className="flex items-center border rounded overflow-hidden focus-within:ring focus-within:border-blue-400">
                <span className="px-3 py-2 bg-gray-50 text-gray-400 text-sm border-r select-none">
                  {origin}/join/
                </span>
                <input
                  className="flex-1 px-3 py-2 text-gray-900 text-sm focus:outline-none"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="sccpasadena"
                  pattern="^[a-z0-9][a-z0-9\-]{1,98}[a-z0-9]$"
                  title="Lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen."
                  disabled={slugSaving}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={slugSaving || !slug.trim()}
              className="px-5 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              {slugSaving ? "Saving..." : "Save"}
            </button>
          </div>
          {slugError && <p className="text-red-600 text-sm">{slugError}</p>}
          {slugSaved && <p className="text-green-600 text-sm font-medium">Slug saved</p>}
        </form>

        {joinUrl && (
          <div className="mt-6">
            {/* Hidden canvas used for PNG export */}
            <div ref={qrDownloadRef} className="hidden" aria-hidden>
              <QRCodeCanvas value={joinUrl} size={340} level="M" />
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="bg-white border rounded-xl p-3 shadow-sm shrink-0">
                <QRCodeSVG value={joinUrl} size={140} level="M" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Static join URL</p>
                <p className="text-sm text-gray-800 break-all font-mono bg-gray-50 border rounded px-3 py-2 mb-3">
                  {joinUrl}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Program NFC cards with this URL using the <strong>NFC Tools</strong> app.
                  It never changes — tap or scan always redirects to the currently active session.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadPNG("en")}
                    className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
                  >
                    Download PNG — English
                  </button>
                  <button
                    onClick={() => downloadPNG("es")}
                    className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
                  >
                    Download PNG — Español
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
                  >
                    Save as PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Print styles — renders the poster fullscreen when printing */}
            <style>{`
              @media print {
                body > * { display: none !important; }
                body::after {
                  content: '';
                  display: block;
                  position: fixed;
                  inset: 0;
                  background: #07070f;
                }
              }
            `}</style>
          </div>
        )}
      </div>

      {/* ProPresenter Integration — only shown when feature is enabled */}
      {ppStatus?.feature_enabled && (
        <div className="bg-white rounded shadow p-8 mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                ppStatus.bridge_connected ? "bg-green-500" : "bg-red-400"
              }`}
            />
            <h2 className="text-lg font-bold text-gray-900">ProPresenter Integration</h2>
          </div>

          <p className="text-sm text-gray-600 mb-1">
            {ppStatus.bridge_connected
              ? ppStatus.active_presentation
                ? `Now presenting: ${ppStatus.active_presentation}`
                : "Bridge connected — waiting for presentation"
              : "Bridge not connected. Run the bridge app on your ProPresenter computer."}
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            <a
              href={api.proPresenterDownloadBridgeUrl(getChurchId(), "windows")}
              className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition font-semibold text-sm"
            >
              Download for Windows (.exe)
            </a>
            <a
              href={api.proPresenterDownloadBridgeUrl(getChurchId(), "mac")}
              className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition font-semibold text-sm"
            >
              Download for macOS (.zip)
            </a>
            <button
              onClick={async () => {
                if (!ppCode) {
                  const code = await api.proPresenterConnectionCode(getChurchId());
                  setPpCode(code);
                }
              }}
              className="bg-gray-700 text-white px-4 py-2 rounded shadow hover:bg-gray-800 transition font-semibold text-sm"
            >
              {ppCode ? "Connection Code" : "Show Connection Code"}
            </button>
            <button
              onClick={() => setPpAdvanced(v => !v)}
              className="text-gray-500 hover:text-gray-700 text-sm underline self-center"
            >
              {ppAdvanced ? "Hide" : "Advanced"} settings
            </button>
          </div>
          {ppCode && (
            <div className="mt-3 bg-gray-50 border rounded p-3 flex items-center gap-3">
              <code className="text-xs text-gray-700 break-all flex-1">{ppCode}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(ppCode); setPpCodeCopied(true); setTimeout(() => setPpCodeCopied(false), 2000); }}
                className="text-xs px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 font-semibold shrink-0"
              >
                {ppCodeCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          {ppAdvanced && (
            <form onSubmit={savePpSettings} className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">PP Host</label>
                <input
                  className="border rounded px-3 py-1.5 text-sm text-gray-900 w-40"
                  value={ppHost}
                  onChange={e => setPpHost(e.target.value)}
                  placeholder="localhost"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">PP Port</label>
                <input
                  type="number"
                  className="border rounded px-3 py-1.5 text-sm text-gray-900 w-24"
                  value={ppPort}
                  onChange={e => setPpPort(Number(e.target.value))}
                  placeholder="50001"
                />
              </div>
              <button
                type="submit"
                disabled={ppSaving}
                className="px-4 py-1.5 rounded bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                {ppSaving ? "Saving..." : "Save"}
              </button>
            </form>
          )}

          <details className="mt-5">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              How to set up
            </summary>
            <ol className="mt-2 text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Click <strong>Download for Windows</strong> or <strong>Download for macOS</strong> and copy it to the ProPresenter computer.</li>
              <li>Run <strong>Versespan-Bridge.exe</strong> — it will appear in the system tray.</li>
              <li>On first launch, a dialog asks for your connection code.</li>
              <li>Click <strong>Show Connection Code</strong> above, copy it, and paste it into the dialog.</li>
              <li>The tray icon turns green when connected.</li>
            </ol>
          </details>
        </div>
      )}

      {/* Audio Calibration Section */}
      <div className="bg-white rounded shadow p-8 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Audio Calibration</h2>
            <p className="text-sm text-gray-600 mt-1">
              Calibrate your microphone to set the voice activity detection threshold
              for accurate real-time translation.
            </p>
          </div>
          <Link href="/settings/calibration">
            <button className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition font-semibold">
              Calibrate
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
