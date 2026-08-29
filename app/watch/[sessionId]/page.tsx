"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useMetrics } from "@/hooks/useMetrics";
import { useTTS } from "@/hooks/useTTS";
import { useWatchSocket } from "@/hooks/useWatchSocket";
import PendingLine from "./components/PendingLine";
import ScriptureOverlay from "./components/ScriptureOverlay";
import SongOverlay from "./components/SongOverlay";
import type { FeedbackState, FormValues, I18NStrings } from "./types";

const JoinScreen = dynamic(() => import("./components/JoinScreen"), { ssr: false });
const FeedbackForm = dynamic(() => import("./components/FeedbackForm"), { ssr: false });

// ─── i18n ─────────────────────────────────────────────────────────────────────

const I18N: Record<string, I18NStrings> = {
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

// ─── WatchPage ────────────────────────────────────────────────────────────────

export default function WatchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [fontSize, setFontSize] = useState<"md" | "lg" | "xl">("lg");
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [form, setForm] = useState<FormValues>({
    ratingOverall: 0,
    ratingTranslation: 0,
    ratingAudio: 0,
    ratingAudioDelay: 0,
    hadBugs: null,
    bugDescription: "",
    comment: "",
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const sessionTargetLangRef = useRef("en");
  const viewerIdRef = useRef<string>("");

  useEffect(() => {
    let id = localStorage.getItem("viewer_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("viewer_id", id);
    }
    viewerIdRef.current = id;
  }, []);

  const {
    metricsKey,
    saveMetrics,
    buildMetadata,
    connectionDropsRef,
    totalTranslationsRef,
    ttsLatenciesRef,
    wsMessageTimestampsRef,
    firstTranslationTimeRef,
    lastDisconnectCodeRef,
  } = useMetrics(sessionId);

  const { ttsEnabled, setTtsEnabled, audioUnlocked, speak, stopTTS, unlockAudio } = useTTS({
    sessionId,
    apiUrl,
    sessionTargetLangRef,
    viewerIdRef,
    ttsLatenciesRef,
    saveMetrics,
  });

  const { status, translations, lastText, targetLang, presenting, pendingUtterance } = useWatchSocket({
    sessionId,
    speak,
    stopTTS,
    saveMetrics,
    sessionTargetLangRef,
    connectionDropsRef,
    totalTranslationsRef,
    wsMessageTimestampsRef,
    firstTranslationTimeRef,
    lastDisconnectCodeRef,
  });

  const submitFeedback = useCallback(async () => {
    const payload = {
      session_id: sessionId,
      viewer_id: viewerIdRef.current || null,
      rating_overall: form.ratingOverall,
      rating_translation: form.ratingTranslation,
      rating_audio: form.ratingAudio,
      rating_audio_delay: form.ratingAudioDelay,
      had_bugs: form.hadBugs ?? false,
      bug_description: form.bugDescription || null,
      comment: form.comment || null,
      ...buildMetadata(ttsEnabled),
    };
    try {
      await fetch(`${apiUrl}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {}
    localStorage.removeItem(metricsKey);
    setFeedbackState("submitted");
  }, [form, sessionId, apiUrl, buildMetadata, metricsKey, ttsEnabled]);

  const fontSizeClass = { md: "text-xl", lg: "text-2xl", xl: "text-3xl" }[fontSize];
  const sourceSizeClass = { md: "text-sm", lg: "text-base", xl: "text-lg" }[fontSize];
  const t = I18N[targetLang] ?? I18N.en;

  if (status === "ended") {
    return (
      <FeedbackForm
        feedbackState={feedbackState}
        setFeedbackState={setFeedbackState}
        form={form}
        setForm={setForm}
        submitFeedback={submitFeedback}
        t={t}
      />
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "#09090F", color: "#F5F0E8", fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
      onClick={() => unlockAudio(lastText ?? "")}
    >
      {!audioUnlocked && (
        <JoinScreen targetLang={targetLang} lastText={lastText} unlockAudio={unlockAudio} t={t} />
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${status !== "connected" ? "animate-pulse" : ""}`}
            style={{ background: status === "connected" ? "#4ADE80" : "#FBBF24" }}
          />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6B6B7A" }}>
            {status === "connected" ? t.live : status === "connecting" ? t.connecting : t.reconnecting}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(["md", "lg", "xl"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                aria-label={s === "md" ? "Small text" : s === "lg" ? "Medium text" : "Large text"}
                className="px-2 py-1 rounded text-xs font-bold transition"
                style={{ color: fontSize === s ? "#C9A84C" : "#3A3A4A", background: fontSize === s ? "rgba(201,168,76,0.1)" : "transparent" }}
              >
                {s === "md" ? "A" : "A"}
                <sup>{s === "md" ? "" : s === "lg" ? "+" : "++"}</sup>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setTtsEnabled((v) => {
                if (v) stopTTS();
                return !v;
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition"
            style={
              ttsEnabled
                ? { background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }
                : { background: "rgba(58,58,74,0.3)", color: "#3A3A4A", border: "1px solid #1E1E2A" }
            }
          >
            {ttsEnabled ? `🔊 ${t.audioOn}` : `🔇 ${t.audioOff}`}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {presenting?.content_type === "song" ? (
          <SongOverlay
            songTitles={presenting.song_titles}
            sections={presenting.sections}
            sourceLang={presenting.source_lang}
            targetLang={presenting.target_lang}
            fontSizeClass={fontSizeClass}
            sourceSizeClass={sourceSizeClass}
            t={t}
          />
        ) : (
          <>
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div
                className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
                style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
              >
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C9A84C" }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>{t.liveTranslation}</span>
              </div>

              {(pendingUtterance || lastText) && (
                <div
                  className="px-5 py-4 flex-shrink-0"
                  style={{ background: "#111118", borderBottom: "1px solid #1E1E2A", borderLeft: "3px solid #C9A84C" }}
                >
                  {pendingUtterance ? (
                    <PendingLine key={pendingUtterance.utteranceId} text={pendingUtterance.text} fontSizeClass={fontSizeClass} />
                  ) : (
                    <p className={`${fontSizeClass} font-semibold leading-snug transition-colors duration-300`} style={{ color: "#F5F0E8" }}>
                      {lastText}
                    </p>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {status === "connecting" && translations.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "#1E1E2A", borderTopColor: "#C9A84C" }} />
                    <p className="text-sm" style={{ color: "#3A3A4A" }}>{t.connectingStream}</p>
                  </div>
                )}
                {[...translations].reverse().map((tr) => (
                  <div key={tr.id} className="space-y-1">
                    <span className="text-xs" style={{ color: "#3A3A4A" }}>
                      {new Date(tr.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <p className={`${fontSizeClass} leading-snug`} style={{ color: "#F5F0E8" }}>{tr.target_text}</p>
                    {tr.source_text && (
                      <p className={`${sourceSizeClass} italic`} style={{ color: "#3A3A4A" }}>{tr.source_text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {presenting?.content_type === "scripture" && (
              <ScriptureOverlay
                targetText={presenting.target_text}
                sourceText={presenting.source_text}
                verseRef={presenting.verse_ref}
                fontSizeClass={fontSizeClass}
                sourceSizeClass={sourceSizeClass}
                t={t}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
