"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
      })
      .catch(() => {}); // silently fail — form has sensible defaults
  }, []);

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
