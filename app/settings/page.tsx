"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import JoinScreen, { JoinQRSource, renderJoinPNG, pickVideoType, recordJoinLoop } from "@/components/JoinScreen";
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
    const churchId = getChurchId();
    Promise.allSettled([
      api.proPresenterStatus(),
      api.getChurch(churchId),
    ]).then(([ppResult, churchResult]) => {
      if (ppResult.status === "fulfilled") {
        setPpStatus(ppResult.value as PPStatus);
      }
      if (churchResult.status === "fulfilled") {
        const c = churchResult.value as Record<string, unknown>;
        setForm({
          bible_version_source: (c.bible_version_source as string) || "RV1960",
          bible_version_target: (c.bible_version_target as string) || "KJV",
        });
        const settings = (c.settings as Record<string, unknown>) || {};
        setChurchLanguages((settings.languages as string[]) || ["es", "en"]);
        if (c.slug) setSlug(c.slug as string);
        if (c.name) setChurchName(c.name as string);
      }
    });
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
  const [churchName, setChurchName] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugSaved, setSlugSaved] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

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
  const [recording, setRecording] = useState(false);
  const [recordPct, setRecordPct] = useState(0);
  const [videoNote, setVideoNote] = useState<string | null>(null);

  /**
   * Download one loop of the animation as a video.
   *
   * Recorded in real time from a canvas rather than encoded frame-by-frame or
   * rendered server-side. Frame-by-frame would mean shipping ffmpeg.wasm (~25MB)
   * for a file made a few times a year; server-side would put the design in a
   * THIRD place after the CSS and the canvas, and two copies is already what let
   * the old branded poster stay live after it was supposedly replaced.
   *
   * The trade is that the recording takes as long as the loop it captures, which
   * is why this reports progress rather than just disabling the button.
   */
  async function downloadVideo() {
    const qrCanvas = qrDownloadRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!qrCanvas || !joinUrl || recording) return;

    const picked = pickVideoType();
    if (!picked) {
      // No recorder at all — fall back to a still so the button is never a dead end.
      const link = document.createElement("a");
      link.download = `join-${slug || "church"}-${churchLanguages[0] ?? "en"}.png`;
      link.href = renderJoinPNG({ qrCanvas, url: joinUrl, churchName, lang: churchLanguages[0] ?? "en" });
      link.click();
      setVideoNote("This browser cannot record video — downloaded a still image instead.");
      return;
    }

    setRecording(true);
    setRecordPct(0);
    setVideoNote(null);
    try {
      const { blob, ext } = await recordJoinLoop({
        qrCanvas,
        url: joinUrl,
        churchName,
        langs: churchLanguages,
        onProgress: (f) => setRecordPct(Math.round(f * 100)),
      });
      const link = document.createElement("a");
      link.download = `join-${slug || "church"}.${ext}`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      if (ext !== "mp4") {
        setVideoNote(
          "Your browser recorded WebM rather than MP4. ProPresenter may not import it — " +
            "try Chrome or Safari for an MP4, or use the full-screen view directly.",
        );
      }
    } catch (err) {
      setVideoNote(err instanceof Error ? err.message : "Recording failed.");
    } finally {
      setRecording(false);
    }
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
          <div className="mt-6 space-y-4">
            <JoinQRSource url={joinUrl} refEl={qrDownloadRef} />

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Static join URL</p>
              <p className="text-sm text-gray-800 break-all font-mono bg-gray-50 border rounded px-3 py-2">
                {joinUrl}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Program NFC cards with this URL using the <strong>NFC Tools</strong> app.
                It never changes — tap or scan always redirects to the currently active session.
              </p>
            </div>

            {/* Live preview. Sized by its container, so this IS the 1920x1080
                design rather than a separate small rendering of it. */}
            {/* No `fill` here: that sets height:100% and the component uses
                container-type:size, so against an auto-height parent every cqh
                unit collapsed to nothing and the preview rendered as a bare
                purple rectangle. Letting its own 16:9 aspect drive the height
                is what makes this a true scale model of 1920x1080. */}
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <JoinScreen url={joinUrl} churchName={churchName} langs={churchLanguages} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadVideo}
                disabled={recording}
                className="px-4 py-2 rounded bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50"
              >
                {recording ? `Recording ${recordPct}%…` : "Download video"}
              </button>
            </div>
            {recording && (
              <div className="h-1.5 bg-gray-100 rounded overflow-hidden" role="status" aria-live="polite">
                <div className="h-full bg-violet-500 transition-all duration-200" style={{ width: `${recordPct}%` }} />
              </div>
            )}
            {videoNote && <p className="text-xs text-amber-700">{videoNote}</p>}
            <p className="text-xs text-gray-500">
              The preview above animates between {churchLanguages.length} language
              {churchLanguages.length === 1 ? "" : "s"}. The video is one full loop
              ({((churchLanguages.length * 3.8)).toFixed(1)}s) at 1920×1080, for ProPresenter or anywhere a
              file is needed; recording it takes about that long.
            </p>
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
