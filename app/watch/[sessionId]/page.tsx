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

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "ended";
type FeedbackState = "idle" | "form" | "submitted";

const CONTENT_COLORS: Record<string, string> = {
  scripture: "text-amber-300",
  song: "text-blue-300",
  speech: "text-gray-400",
};


const I18N = {
  en: {
    sessionEnded: "Service has ended",
    thankYouJoining: "Thank you for joining today",
    shareFeedback: "Share Feedback",
    skip: "Skip",
    formTitle: "How was your experience?",
    overall: "Overall experience",
    translation: "Translation quality",
    audio: "Audio quality",
    audioDelay: "Audio delay",
    audioDelayLabels: ["None", "Slight", "Moderate", "Noticeable", "Severe"],
    hadBugs: "Did you experience any bugs or issues?",
    yes: "Yes",
    no: "No",
    bugDescription: "Please describe the issue",
    bugDescriptionPlaceholder: "What happened?",
    comment: "Additional comments",
    commentPlaceholder: "Anything else you'd like to share... (optional)",
    submit: "Submit Feedback",
    back: "Back",
    thankYou: "Thank you for your feedback!",
    thankYouSub: "Your response helps us improve the experience.",
    tapToEnable: "Tap to enable audio",
    tapToEnableSub: "Live translation with voice will start automatically",
    live: "Live",
    connecting: "Connecting...",
    reconnecting: "Reconnecting...",
    audioOn: "Audio On",
    audioOff: "Audio Off",
    nowPlaying: "Now Playing",
    liveTranslation: "Live Translation",
    connectingStream: "Connecting to translation stream...",
    scripture: "Scripture",
    labelSpeech: "Speech",
    labelSong: "Song",
    labelScripture: "Scripture",
  },
  es: {
    sessionEnded: "El servicio ha terminado",
    thankYouJoining: "Gracias por acompañarnos hoy",
    shareFeedback: "Compartir comentarios",
    skip: "Omitir",
    formTitle: "¿Cómo fue tu experiencia?",
    overall: "Experiencia general",
    translation: "Calidad de traducción",
    audio: "Calidad de audio",
    audioDelay: "Retraso de audio",
    audioDelayLabels: ["Ninguno", "Leve", "Moderado", "Notable", "Severo"],
    hadBugs: "¿Experimentaste algún error o problema?",
    yes: "Sí",
    no: "No",
    bugDescription: "Por favor describe el problema",
    bugDescriptionPlaceholder: "¿Qué ocurrió?",
    comment: "Comentarios adicionales",
    commentPlaceholder: "¿Algo más que quieras compartir? (opcional)",
    submit: "Enviar comentarios",
    back: "Atrás",
    thankYou: "¡Gracias por tus comentarios!",
    thankYouSub: "Tu respuesta nos ayuda a mejorar la experiencia.",
    tapToEnable: "Toca para activar el audio",
    tapToEnableSub: "La traducción en vivo con voz comenzará automáticamente",
    live: "En vivo",
    connecting: "Conectando...",
    reconnecting: "Reconectando...",
    audioOn: "Audio activado",
    audioOff: "Audio desactivado",
    nowPlaying: "Reproduciendo",
    liveTranslation: "Traducción en vivo",
    connectingStream: "Conectando al flujo de traducción...",
    scripture: "Escritura",
    labelSpeech: "Habla",
    labelSong: "Canción",
    labelScripture: "Escritura",
  },
};

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-2xl transition-transform active:scale-90 ${star <= value ? "text-yellow-400" : "text-gray-600"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [targetLang, setTargetLang] = useState<"en" | "es">("en");
  const [form, setForm] = useState({
    ratingOverall: 0,
    ratingTranslation: 0,
    ratingAudio: 0,
    ratingAudioDelay: 0,
    hadBugs: null as boolean | null,
    bugDescription: "",
    comment: "",
  });

  // Stable refs
  const sessionTargetLangRef = useRef("en");
  const wsRef = useRef<WebSocket | null>(null);
  const ttsEnabledRef = useRef(true);
  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const ttsProcessingRef = useRef(false);
  const lastTextRef = useRef("");
  const activeSongRef = useRef<ActiveSong | null>(null);
  const sessionEndedRef = useRef(false);
  const idCounter = useRef(0);

  // Metadata tracking refs
  const watchStartTimeRef = useRef(0);
  useEffect(() => { watchStartTimeRef.current = Date.now(); }, []);
  const connectionDropsRef = useRef(0);
  const totalTranslationsRef = useRef(0);
  const ttsLatenciesRef = useRef<number[]>([]);
  const wsMessageTimestampsRef = useRef<number[]>([]);
  const firstTranslationTimeRef = useRef<number | null>(null);
  const lastDisconnectCodeRef = useRef<number | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { audioUnlockedRef.current = audioUnlocked; }, [audioUnlocked]);

  const speak = useCallback(async (text: string) => {
    if (!ttsEnabledRef.current || !audioUnlockedRef.current || !text.trim()) return;

    ttsQueueRef.current.push(text);
    if (ttsProcessingRef.current) return;
    ttsProcessingRef.current = true;

    const fetchAudio = async (t: string): Promise<AudioBuffer | null> => {
      const ctrl = new AbortController();
      ttsAbortRef.current = ctrl;
      try {
        const params = new URLSearchParams({ text: t, lang: sessionTargetLangRef.current });
        const res = await fetch(`${apiUrl}/api/tts?${params}`, { signal: ctrl.signal });
        if (!res.ok || ctrl.signal.aborted) return null;
        const ab = await res.arrayBuffer();
        if (ctrl.signal.aborted) return null;
        const ctx = audioCtxRef.current!;
        if (ctx.state === "suspended") await ctx.resume();
        return ctx.decodeAudioData(ab);
      } catch { return null; }
    };

    // Prefetch pipeline: while item N plays, fetch item N+1 in parallel
    // so playback is gapless.
    let prefetch: Promise<AudioBuffer | null> | null = null;

    while (ttsQueueRef.current.length > 0) {
      if (!ttsEnabledRef.current) { ttsQueueRef.current = []; break; }

      const item = ttsQueueRef.current.shift()!;

      // Use pre-fetched buffer if ready, otherwise fetch now
      const bufferPromise = prefetch ?? fetchAudio(item);
      prefetch = null;

      // Kick off fetch for the next queued item immediately (parallel)
      if (ttsQueueRef.current.length > 0) {
        prefetch = fetchAudio(ttsQueueRef.current[0]);
      }

      const audioBuffer = await bufferPromise;
      if (!audioBuffer) continue;

      const ctx = audioCtxRef.current!;
      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start();
        currentSourceRef.current = source;
        // Also start prefetch while playing if a new item arrived after fetch began
        if (!prefetch && ttsQueueRef.current.length > 0) {
          prefetch = fetchAudio(ttsQueueRef.current[0]);
        }
      });
    }

    ttsProcessingRef.current = false;
  }, [apiUrl]);

  const unlockAudio = useCallback(async () => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    } catch {}
    if (lastTextRef.current) {
      speak(lastTextRef.current);
    }
  }, [speak]);

  useEffect(() => {
    if (!sessionId) return;

    const wsApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = wsApiUrl.replace("http://", "ws://").replace("https://", "wss://");
    const url = `${wsUrl}/api/ws/watch/${sessionId}`;

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      console.log(`[Watch] Connecting to ${url}`);
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[Watch] Connected (drops so far: ${connectionDropsRef.current})`);
        setStatus("connected");
        // Heartbeat: watch page sends no audio so the connection looks idle
        // to Fly.io's proxy during translation gaps. Ping every 20s to keep it alive.
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 20000);
        ws.addEventListener("close", () => clearInterval(heartbeat));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "ping" }));
            return;
          }

          if (msg.type === "status") {
            if (msg.target_language) {
              const tgt = msg.target_language as "en" | "es";
              sessionTargetLangRef.current = tgt;
              setTargetLang(tgt);
              console.log(`[Watch] Session language: ${msg.source_language} → ${msg.target_language}`);
            }
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
            console.log(`[Watch] History loaded: ${entries.length} translations`);
            setTranslations(entries);
            if (entries.length > 0) {
              const t = entries[entries.length - 1].target_text;
              setLastText(t);
              lastTextRef.current = t;
            }
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
              setTargetLang(tgt as "en" | "es");
              activeSongRef.current = song;
              setActiveSong(song);
              currentSourceRef.current?.stop();
              currentSourceRef.current = null;
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
            console.log(`[Watch] Song started: ${JSON.stringify(msg.song_titles)}`);
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
            currentSourceRef.current?.stop();
            currentSourceRef.current = null;
            setPresenting({ content_type: "song", ...song });
          }

          if (msg.type === "song_ended") {
            console.log("[Watch] Song ended");
            activeSongRef.current = null;
            setActiveSong(null);
            setPresenting(null);
          }

          if (msg.type === "translation") {
            const text = msg.translated_text || msg.target_text;
            if (!text) {
              console.warn("[Watch] Translation dropped — empty target_text", msg);
              return;
            }
            const now = Date.now();
            const entry: Translation = {
              id: ++idCounter.current,
              source_text: msg.source_text || "",
              target_text: text,
              content_type: msg.content_type || "speech",
              timestamp: msg.timestamp || new Date().toISOString(),
            };
            console.log(`[Watch] Translation received (${msg.content_type || "speech"}): "${msg.source_text}" → "${text}" | TTS lang: ${sessionTargetLangRef.current}`);
            setTranslations((prev) => [...prev.slice(-49), entry]);
            setLastText(entry.target_text);
            lastTextRef.current = entry.target_text;

            // Track metadata
            totalTranslationsRef.current += 1;
            if (firstTranslationTimeRef.current === null) firstTranslationTimeRef.current = now;
            wsMessageTimestampsRef.current.push(now);
            if (wsMessageTimestampsRef.current.length > 200) wsMessageTimestampsRef.current.shift();

            if (!activeSongRef.current) {
              speak(entry.target_text);
            }
          }

          if (msg.type === "error") {
            if (msg.error === "Session has ended") {
              console.log("[Watch] Session ended by admin");
              sessionEndedRef.current = true;
              setStatus("ended");
              ws.close();
            } else {
              console.error("[Watch] Server error:", msg.error);
            }
          }
        } catch (e) {
          console.error("[Watch] Failed to parse message:", e, event.data);
        }
      };

      ws.onclose = (event) => {
        if (dead || sessionEndedRef.current) return;
        lastDisconnectCodeRef.current = event.code;
        const delay = event.code === 1000 ? 0 : 3000;
        if (event.code !== 1000) connectionDropsRef.current += 1;
        console.warn(`[Watch] Disconnected — code: ${event.code}, reason: "${event.reason || "none"}", clean: ${event.wasClean}, drops: ${connectionDropsRef.current}, reconnecting in ${delay}ms`);
        setStatus("disconnected");
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = (e) => {
        console.error("[Watch] WebSocket error:", e);
        ws.close();
      };
    }

    connect();

    return () => {
      dead = true;
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [sessionId, speak]);

  const buildMetadata = useCallback(() => {
    const timestamps = wsMessageTimestampsRef.current;
    const avgInterval = timestamps.length > 1
      ? Math.round(
          timestamps.slice(1).reduce((sum, t, i) => sum + (t - timestamps[i]), 0) /
          (timestamps.length - 1)
        )
      : null;
    const latencies = ttsLatenciesRef.current;
    return {
      user_agent: navigator.userAgent,
      watch_duration_seconds: Math.round((Date.now() - watchStartTimeRef.current) / 1000),
      tts_enabled: ttsEnabledRef.current,
      connection_drops: connectionDropsRef.current,
      avg_tts_latency_ms: latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
      total_translations_received: totalTranslationsRef.current,
      session_duration_ms: firstTranslationTimeRef.current
        ? Date.now() - firstTranslationTimeRef.current
        : null,
      last_disconnect_reason: lastDisconnectCodeRef.current?.toString() ?? null,
      avg_ws_message_interval_ms: avgInterval,
    };
  }, []);

  const submitFeedback = useCallback(async () => {
    const payload = {
      session_id: sessionId,
      rating_overall: form.ratingOverall,
      rating_translation: form.ratingTranslation,
      rating_audio: form.ratingAudio,
      rating_audio_delay: form.ratingAudioDelay,
      had_bugs: form.hadBugs ?? false,
      bug_description: form.bugDescription || null,
      comment: form.comment || null,
      ...buildMetadata(),
    };
    try {
      await fetch(`${apiUrl}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {}
    setFeedbackState("submitted");
  }, [form, sessionId, apiUrl, buildMetadata]);

  const fontSizeClass = { md: "text-xl", lg: "text-2xl", xl: "text-3xl" }[fontSize];
  const sourceSizeClass = { md: "text-sm", lg: "text-base", xl: "text-lg" }[fontSize];
  const t = I18N[targetLang] ?? I18N.en;

  // Full-screen session-ended flow
  if (status === "ended") {
    if (feedbackState === "submitted") {
      return (
        <div className="h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-8 text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-2xl font-semibold text-white">{t.thankYou}</p>
          <p className="text-gray-400 text-sm max-w-xs">{t.thankYouSub}</p>
        </div>
      );
    }

    if (feedbackState === "form") {
      const canSubmit = form.ratingOverall > 0 && form.ratingTranslation > 0 && form.ratingAudio > 0 && form.ratingAudioDelay > 0 && form.hadBugs !== null;
      return (
        <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
          {/* Form header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
            <button
              onClick={() => setFeedbackState("idle")}
              className="text-gray-400 hover:text-white transition p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-base font-semibold">{t.formTitle}</p>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            <StarRating value={form.ratingOverall} onChange={(v) => setForm((f) => ({ ...f, ratingOverall: v }))} label={t.overall} />
            <StarRating value={form.ratingTranslation} onChange={(v) => setForm((f) => ({ ...f, ratingTranslation: v }))} label={t.translation} />
            <StarRating value={form.ratingAudio} onChange={(v) => setForm((f) => ({ ...f, ratingAudio: v }))} label={t.audio} />

            {/* Audio delay — labeled severity scale */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-gray-300">{t.audioDelay}</span>
              <div className="flex gap-2">
                {t.audioDelayLabels.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, ratingAudioDelay: i + 1 }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                      form.ratingAudioDelay === i + 1
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bug yes/no */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-300">{t.hadBugs}</span>
              <div className="flex gap-3">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, hadBugs: val, bugDescription: val ? f.bugDescription : "" }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      form.hadBugs === val
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {val ? t.yes : t.no}
                  </button>
                ))}
              </div>
              {form.hadBugs && (
                <textarea
                  value={form.bugDescription}
                  onChange={(e) => setForm((f) => ({ ...f, bugDescription: e.target.value }))}
                  placeholder={t.bugDescriptionPlaceholder}
                  rows={3}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {/* Optional comment */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-gray-300">{t.comment}</span>
              <textarea
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder={t.commentPlaceholder}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Submit button */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-800 bg-gray-950">
            <button
              onClick={submitFeedback}
              disabled={!canSubmit}
              className={`w-full py-3 rounded-xl text-base font-semibold transition ${
                canSubmit
                  ? "bg-blue-600 text-white active:bg-blue-700"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }`}
            >
              {t.submit}
            </button>
          </div>
        </div>
      );
    }

    // Idle — session ended landing
    return (
      <div className="h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-semibold">{t.sessionEnded}</p>
          <p className="text-gray-400">{t.thankYouJoining}</p>
        </div>
        <button
          onClick={() => setFeedbackState("form")}
          className="mt-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold text-base active:bg-blue-700 transition"
        >
          {t.shareFeedback}
        </button>
        <button
          onClick={() => setFeedbackState("submitted")}
          className="text-sm text-gray-500 hover:text-gray-300 transition"
        >
          {t.skip}
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden" onClick={unlockAudio}>
      {/* Audio unlock banner */}
      {!audioUnlocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <span className="text-5xl">🔊</span>
            <p className="text-xl font-semibold text-white">{t.tapToEnable}</p>
            <p className="text-sm text-gray-400">{t.tapToEnableSub}</p>
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
                : "bg-yellow-400 animate-pulse"
            }`}
          />
          <span className="text-sm text-gray-400">
            {status === "connected" ? t.live : status === "connecting" ? t.connecting : t.reconnecting}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(["md", "lg", "xl"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={`px-2 py-1 rounded text-xs font-bold transition ${
                  fontSize === s ? "bg-gray-600 text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {s === "md" ? "A" : "A"}
                <sup>{s === "md" ? "" : s === "lg" ? "+" : "++"}</sup>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setTtsEnabled((v) => {
                if (v) {
                  ttsAbortRef.current?.abort();
                  currentSourceRef.current?.stop();
                  currentSourceRef.current = null;
                  ttsQueueRef.current = [];
                }
                return !v;
              });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              ttsEnabled ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"
            }`}
          >
            {ttsEnabled ? `🔊 ${t.audioOn}` : `🔇 ${t.audioOff}`}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {presenting?.content_type === "song" ? (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800/60 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">{t.nowPlaying}</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {t.live}
              </span>
            </div>
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
          <>
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">{t.liveTranslation}</span>
              </div>

              {lastText && (
                <div className="px-5 py-4 bg-gray-900/60 border-b border-gray-800 border-l-4 border-l-blue-500 flex-shrink-0">
                  <p className={`${fontSizeClass} font-semibold leading-snug text-white`}>{lastText}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {status === "connecting" && translations.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-500">
                    <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
                    <p className="text-sm">{t.connectingStream}</p>
                  </div>
                )}

                {[...translations].reverse().map((tr) => (
                  <div key={tr.id} className="space-y-1">
                    <span className="text-xs text-gray-600">
                      {new Date(tr.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <p className={`${fontSizeClass} leading-snug text-gray-100`}>{tr.target_text}</p>
                    {tr.source_text && (
                      <p className={`${sourceSizeClass} text-gray-500 italic`}>{tr.source_text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {presenting && presenting.content_type === "scripture" && (
              <div className="border-t border-gray-800 bg-gray-900 flex-shrink-0 max-h-[45vh] overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800/60 border-b border-gray-800 sticky top-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">{t.scripture}</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {t.live}
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
