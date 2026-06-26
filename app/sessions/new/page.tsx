"use client";

import { useState, useEffect } from "react";
import { useStore, mapBackendSession, type BackendSession } from "@/lib/store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AudioDeviceSelector } from "@/components/AudioDeviceSelector";
import { api, getChurchId, ApiConflictError } from "@/lib/api";
import { getLangName } from "@/lib/languages";

export default function NewSessionPage() {
  const [name, setName] = useState("");
  const addSession = useStore((state) => state.addSession);
  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [churchLanguages, setChurchLanguages] = useState<string[]>(["es", "en"]);
  const [sourceLanguage, setSourceLanguage] = useState("es");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ session_id: string; session_name: string } | null>(null);

  useEffect(() => {
    api.getChurchLanguages(getChurchId()).then((langs) => {
      setChurchLanguages(langs);
      setSourceLanguage(langs[0] || "es");
      setTargetLanguage(langs[1] || "en");
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !deviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Call backend API to create session
      const backendSession = await api.createSession({
        name: name.trim(),
        church_id: getChurchId(),
        source_language: sourceLanguage,
        target_language: targetLanguage,
      }) as BackendSession;

      // Map backend response to frontend format and include deviceId
      const newSession = mapBackendSession(backendSession, deviceId);

      // Save device ID to localStorage for this session
      localStorage.setItem(`session_${newSession.id}_deviceId`, deviceId);

      // Add to local store
      addSession(newSession);

      // Navigate directly to the new session detail page
      router.push(`/sessions/${newSession.id}`);
    } catch (err) {
      if (err instanceof ApiConflictError) {
        setConflict({
          session_id: err.detail.active_session_id as string,
          session_name: (err.detail.active_session_name as string) || "Unnamed session",
        });
        setIsLoading(false);
        return;
      }
      console.error("Failed to create session:", err);
      setError(err instanceof Error ? err.message : "Failed to create session. Please try again.");
      setIsLoading(false);
    }
  }

  async function handleEndAndCreate() {
    if (!conflict) return;
    setConflict(null);
    setIsLoading(true);
    setError(null);
    try {
      await api.stopSession(conflict.session_id);
      const backendSession = await api.createSession({
        name: name.trim(),
        church_id: getChurchId(),
        source_language: sourceLanguage,
        target_language: targetLanguage,
      }) as BackendSession;
      const newSession = mapBackendSession(backendSession, deviceId);
      localStorage.setItem(`session_${newSession.id}_deviceId`, deviceId);
      addSession(newSession);
      router.push(`/sessions/${newSession.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session.");
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {conflict && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Session already active</h2>
            <p className="text-gray-700 text-sm mb-5">
              <strong>{conflict.session_name}</strong> is currently active. You must end it before starting a new one.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConflict(null)}
                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => router.push(`/sessions/${conflict.session_id}`)}
                className="px-4 py-2 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-semibold"
              >
                Go to active session
              </button>
              <button
                onClick={handleEndAndCreate}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
              >
                End it &amp; start new
              </button>
            </div>
          </div>
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6">Create New Session</h1>
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
        <strong>Audio Setup Instructions:</strong>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>Connect your church audio mixer&apos;s output (e.g., XLR, 1/4&quot; TRS, or RCA) to a USB audio interface.</li>
          <li>Plug the USB audio interface into this computer.</li>
          <li>Allow browser microphone access if prompted.</li>
          <li>Select the USB audio interface from the &quot;Audio Input Device&quot; dropdown below.</li>
        </ol>
        <div className="mt-2 text-xs text-blue-700">Need help? Ask your tech team or see the user guide.</div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded shadow p-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        <div>
          <label className="block text-base font-bold mb-2 text-gray-900">Session Name</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring focus:border-blue-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunday Service - December 28, 2025"
            required
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-base font-bold mb-2 text-gray-900">Translation Direction</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source (Pastor speaks)</label>
              <select
                className="w-full border rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring focus:border-blue-400"
                value={sourceLanguage}
                onChange={(e) => {
                  const newSrc = e.target.value;
                  setSourceLanguage(newSrc);
                  if (targetLanguage === newSrc) {
                    const fallback = churchLanguages.find((l) => l !== newSrc) || "";
                    setTargetLanguage(fallback);
                  }
                }}
                disabled={isLoading}
              >
                {churchLanguages.map((code) => (
                  <option key={code} value={code}>{getLangName(code)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target (Audience hears)</label>
              <select
                className="w-full border rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring focus:border-blue-400"
                value={targetLanguage}
                onChange={(e) => {
                  const newTgt = e.target.value;
                  setTargetLanguage(newTgt);
                  if (sourceLanguage === newTgt) {
                    const fallback = churchLanguages.find((l) => l !== newTgt) || "";
                    setSourceLanguage(fallback);
                  }
                }}
                disabled={isLoading}
              >
                {churchLanguages.filter((code) => code !== sourceLanguage).map((code) => (
                  <option key={code} value={code}>{getLangName(code)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <AudioDeviceSelector onDeviceSelect={setDeviceId} />
        <div className="flex gap-4 justify-end">
          <Link href="/sessions">
            <button type="button" className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700" disabled={isLoading}>Cancel</button>
          </Link>
          <button
            type="submit"
            className="px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            disabled={!deviceId || isLoading}
          >
            {isLoading ? "Creating..." : "Start Session"}
          </button>
        </div>
      </form>
    </div>
  );
}
