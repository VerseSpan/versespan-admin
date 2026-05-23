"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Translation {
  id: number;
  source_text: string;
  target_text: string;
  content_type: "speech" | "scripture" | "song";
  timestamp: string;
}

interface SongSection {
  section_number: number;
  section_name: string;
  texts: Record<string, string>;
}

interface ActiveSong {
  song_id: number;
  song_titles: Record<string, string>;
  source_lang: string;
  target_lang: string;
  sections: SongSection[];
}

type PresentingState =
  | { content_type: "song"; song_id: number | null; song_titles: Record<string, string>; source_lang: string; target_lang: string; sections: SongSection[] }
  | { content_type: "scripture"; target_text: string; verse_ref: string | null; source_text: string };

const CONTENT_COLORS: Record<string, string> = {
  scripture: "text-amber-300",
  song: "text-blue-300",
  speech: "text-gray-400",
};

const CONTENT_LABELS: Record<string, string> = {
  scripture: "Scripture",
  song: "Song",
  speech: "Speech",
};

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "ended";


export default function WatchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [fontSize, setFontSize] = useState<"md" | "lg" | "xl">("lg");
  const [lastText, setLastText] = useState("");
  const [activeSong, setActiveSong] = useState<ActiveSong | null>(null);
  const [presenting, setPresenting] = useState<PresentingState | null>(null);
  const sessionTargetLangRef = useRef("en");
  const wsRef = useRef<WebSocket | null>(null);
  const ttsEnabledRef = useRef(true);
  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const idCounter = useRef(0);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { audioUnlockedRef.current = audioUnlocked; }, [audioUnlocked]);

  const unlockAudio = useCallback(async () => {
    if (audioUnlockedRef.current) return;
    // Unlock Web Speech API for iOS synchronously before any await
    if ("speechSynthesis" in window) {
      const s = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(s);
    }
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    } catch {}
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!ttsEnabledRef.current || !audioUnlockedRef.current || !text.trim()) return;

    // Stop any currently playing audio
    currentSourceRef.current?.stop();
    currentSourceRef.current = null;

    try {
      // --- Kokoro TTS via backend ---
      const params = new URLSearchParams({ text, lang: sessionTargetLangRef.current });
      const res = await fetch(`${apiUrl}/api/tts?${params}`);
      if (!res.ok) throw new Error("TTS endpoint unavailable");

      const arrayBuffer = await res.arrayBuffer();
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      currentSourceRef.current = source;
    } catch {
      // Fallback: Web Speech API if Kokoro endpoint is down
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    }
  }, [apiUrl]);

  // Stable ref so the WebSocket effect doesn't depend on `speak`
  const speakRef = useRef<typeof speak | null>(null);
  speakRef.current = speak;

  // Track song mode in a ref so TTS can check it without being a dep
  const activeSongRef = useRef<ActiveSong | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiUrl.replace("http://", "ws://").replace("https://", "wss://");
    const url = `${wsUrl}/api/ws/watch/${sessionId}`;

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "ping" }));
            return;
          }

          if (msg.type === "history" && Array.isArray(msg.translations)) {
            const entries: Translation[] = msg.translations.map((t: {
              source_text: string;
              target_text: string;
              content_type: string;
              timestamp: string;
            }) => ({
              id: ++idCounter.current,
              source_text: t.source_text || "",
              target_text: t.target_text,
              content_type: (t.content_type as Translation["content_type"]) || "speech",
              timestamp: t.timestamp,
            }));
            setTranslations(entries);
            if (entries.length > 0) setLastText(entries[entries.length - 1].target_text);
            return;
          }

          if (msg.type === "presenting") {
            if (msg.content_type === "song") {
              const tgt = msg.target_lang || "en";
              const song = {
                song_id: msg.song_id ?? null,
                song_titles: msg.song_titles || {},
                source_lang: msg.source_lang || "es",
                target_lang: tgt,
                sections: msg.sections || [],
              };
              sessionTargetLangRef.current = tgt;
              activeSongRef.current = song;
              setActiveSong(song);
              currentSourceRef.current?.stop();
              currentSourceRef.current = null;
              window.speechSynthesis?.cancel();
              setPresenting({ content_type: "song", ...song });
            } else if (msg.content_type === "scripture") {
              setPresenting({
                content_type: "scripture",
                target_text: msg.target_text || "",
                verse_ref: msg.verse_ref || null,
                source_text: msg.source_text || "",
              });
            }
            return;
          }

          if (msg.type === "presenting_cleared") {
            setPresenting(null);
            return;
          }

          if (msg.type === "song_started" && msg.song_id) {
            const tgt = msg.target_lang || "en";
            const song = {
              song_id: msg.song_id,
              song_titles: msg.song_titles || {},
              source_lang: msg.source_lang || "es",
              target_lang: tgt,
              sections: msg.sections || [],
            };
            sessionTargetLangRef.current = tgt;
            activeSongRef.current = song;
            setActiveSong(song);
            // Stop any playing audio when song mode starts
            currentSourceRef.current?.stop();
            currentSourceRef.current = null;
            window.speechSynthesis?.cancel();
            setPresenting({ content_type: "song", ...song });
          }

          if (msg.type === "song_ended") {
            activeSongRef.current = null;
            setActiveSong(null);
            setPresenting(null);
            // WebSocket stays connected — translation history is preserved
          }

          if (msg.type === "translation" && (msg.translated_text || msg.target_text)) {
            const entry: Translation = {
              id: ++idCounter.current,
              source_text: msg.source_text || "",
              target_text: msg.translated_text || msg.target_text,
              content_type: msg.content_type || "speech",
              timestamp: msg.timestamp || new Date().toISOString(),
            };
            setTranslations((prev) => [...prev.slice(-49), entry]);
            setLastText(entry.target_text);
            // Skip TTS while song overlay is active
            if (!activeSongRef.current) {
              speakRef.current?.(entry.target_text);
            }
          }

          if (msg.type === "error" && msg.error === "Session has ended") {
            setStatus("ended");
            ws.close();
          }
        } catch {}
      };

      ws.onclose = (event) => {
        if (dead) return;
        // code 1000 = intentional close (e.g. song_ended reconnect) — reconnect immediately
        const delay = event.code === 1000 ? 0 : 3000;
        setStatus("disconnected");
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      dead = true;
      clearTimeout(reconnectTimeout);
      window.speechSynthesis?.cancel();
      wsRef.current?.close();
    };
  }, [sessionId]);


  const fontSizeClass = { md: "text-xl", lg: "text-2xl", xl: "text-3xl" }[fontSize];
  const sourceSizeClass = { md: "text-sm", lg: "text-base", xl: "text-lg" }[fontSize];

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden" onClick={unlockAudio}>
      {/* Audio unlock banner — dismisses on first tap anywhere */}
      {!audioUnlocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <span className="text-5xl">🔊</span>
            <p className="text-xl font-semibold text-white">Tap to enable audio</p>
            <p className="text-sm text-gray-400">Live translation with voice will start automatically</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === "connected"
                ? "bg-green-400"
                : status === "connecting" || status === "disconnected"
                ? "bg-yellow-400 animate-pulse"
                : "bg-red-400"
            }`}
          />
          <span className="text-sm text-gray-400">
            {status === "connected"
              ? "Live"
              : status === "connecting"
              ? "Connecting..."
              : status === "disconnected"
              ? "Reconnecting..."
              : "Session ended"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Font size */}
          <div className="flex gap-1">
            {(["md", "lg", "xl"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={`px-2 py-1 rounded text-xs font-bold transition ${
                  fontSize === s
                    ? "bg-gray-600 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {s === "md" ? "A" : s === "lg" ? "A" : "A"}
                <sup>{s === "md" ? "" : s === "lg" ? "+" : "++"}</sup>
              </button>
            ))}
          </div>

          {/* TTS toggle */}
          <button
            onClick={() => {
              setTtsEnabled((v) => {
                if (v) {
                  currentSourceRef.current?.stop();
                  currentSourceRef.current = null;
                  window.speechSynthesis?.cancel();
                }
                return !v;
              });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              ttsEnabled
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            {ttsEnabled ? "🔊 Audio On" : "🔇 Audio Off"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

        {presenting?.content_type === "song" ? (

          /* === SONG MODE: full-height takeover === */
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Label bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800/60 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Now Playing</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Presenting Now
              </span>
            </div>

            {/* Song body — scrollable, fills remaining height */}
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="mb-6">
                <p className={`${fontSizeClass} font-bold text-white`}>
                  {presenting.song_titles[presenting.target_lang] || presenting.song_titles[presenting.source_lang] || Object.values(presenting.song_titles)[0] || ""}
                </p>
                {presenting.song_titles[presenting.source_lang] && presenting.song_titles[presenting.target_lang] && presenting.song_titles[presenting.source_lang] !== presenting.song_titles[presenting.target_lang] && (
                  <p className="text-purple-300 text-sm mt-1">{presenting.song_titles[presenting.source_lang]}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                {[...presenting.sections]
                  .sort((a, b) => a.section_number - b.section_number)
                  .map((section) => (
                    <div key={section.section_number} className="min-w-[200px]">
                      <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1">
                        {section.section_name}
                      </p>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className={`${fontSizeClass} leading-relaxed text-white whitespace-pre-wrap`}>
                          {section.texts[presenting.target_lang] || section.texts[presenting.source_lang] || Object.values(section.texts)[0] || ""}
                        </p>
                        {section.texts[presenting.target_lang] && section.texts[presenting.source_lang] && section.texts[presenting.target_lang] !== section.texts[presenting.source_lang] && (
                          <p className={`${sourceSizeClass} text-purple-200 mt-2 italic whitespace-pre-wrap`}>
                            {section.texts[presenting.source_lang]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

        ) : (

          /* === NORMAL MODE: translation feed + optional scripture panel === */
          <>
            {/* Translation feed */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Column label */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Live Translation</span>
              </div>

              {/* Latest translation — prominent */}
              {lastText && (
                <div className="px-5 py-4 bg-gray-900/60 border-b border-gray-800 border-l-4 border-l-blue-500 flex-shrink-0">
                  <p className={`${fontSizeClass} font-semibold leading-snug text-white`}>
                    {lastText}
                  </p>
                </div>
              )}

              {/* Scrollable feed */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {status === "connecting" && translations.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-500">
                    <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
                    <p className="text-sm">Connecting to translation stream...</p>
                  </div>
                )}

                {status === "ended" && (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-500">
                    <p className="text-lg">Service has ended</p>
                    <p className="text-sm">Thank you for joining</p>
                  </div>
                )}

                {[...translations].reverse().map((t) => (
                  <div key={t.id} className="space-y-1">
                    <span className="text-xs text-gray-600">
                      {new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <p className={`${fontSizeClass} leading-snug text-gray-100`}>{t.target_text}</p>
                    {t.source_text && (
                      <p className={`${sourceSizeClass} text-gray-500 italic`}>{t.source_text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Scripture panel — bottom, only for non-song presenting content */}
            {presenting && presenting.content_type === "scripture" && (
              <div className="border-t border-gray-800 bg-gray-900 flex-shrink-0 max-h-[45vh] overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800/60 border-b border-gray-800 sticky top-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Scripture</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Presenting Now
                  </span>
                </div>
                <div className="px-5 py-4 flex flex-col gap-3">
                  {presenting.verse_ref && (
                    <p className="text-amber-400 text-sm font-semibold tracking-wide">{presenting.verse_ref}</p>
                  )}
                  <p className={`${fontSizeClass} text-white leading-relaxed`}>{presenting.target_text}</p>
                  {presenting.source_text && presenting.source_text !== presenting.target_text && (
                    <p className={`${sourceSizeClass} text-gray-500 italic`}>{presenting.source_text}</p>
                  )}
                </div>
              </div>
            )}
          </>

        )}

      </div>
    </div>
  );
}
