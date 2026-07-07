"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useMetrics } from "@/hooks/useMetrics";
import { useTTS } from "@/hooks/useTTS";
import { useWatchSocket } from "@/hooks/useWatchSocket";

type FeedbackState = "idle" | "form" | "submitted";

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm" style={{ color: "#6B6B7A" }}>{label}</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="text-2xl transition-transform active:scale-90"
            style={{ color: star <= value ? "#C9A84C" : "#1E1E2A" }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── WatchPage ────────────────────────────────────────────────────────────────

export default function WatchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [fontSize, setFontSize] = useState<"md" | "lg" | "xl">("lg");
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [form, setForm] = useState({
    ratingOverall: 0,
    ratingTranslation: 0,
    ratingAudio: 0,
    ratingAudioDelay: 0,
    hadBugs: null as boolean | null,
    bugDescription: "",
    comment: "",
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Shared refs passed between hooks
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

  const {
    ttsEnabled,
    setTtsEnabled,
    audioUnlocked,
    speak,
    stopTTS,
    unlockAudio,
  } = useTTS({
    sessionId,
    apiUrl,
    sessionTargetLangRef,
    viewerIdRef,
    ttsLatenciesRef,
    saveMetrics,
  });

  const { status, translations, lastText, targetLang, presenting } = useWatchSocket({
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

  const vsStyle = { background: "#09090F", color: "#F5F0E8", fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" };

  if (status === "ended") {
    if (feedbackState === "submitted") {
      return (
        <div className="h-screen flex flex-col items-center justify-center px-8 text-center gap-5" style={vsStyle}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
            style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}
          >
            <svg className="w-8 h-8" style={{ color: "#4ADE80" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", color: "#F5F0E8" }}>{t.thankYou}</p>
          <p className="text-sm max-w-xs" style={{ color: "#3A3A4A" }}>{t.thankYouSub}</p>
        </div>
      );
    }

    if (feedbackState === "form") {
      const canSubmit = form.ratingOverall > 0 && form.ratingTranslation > 0 && form.ratingAudio > 0 && form.ratingAudioDelay > 0 && form.hadBugs !== null;
      return (
        <div className="h-screen flex flex-col overflow-hidden" style={vsStyle}>
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
          >
            <button
              onClick={() => setFeedbackState("idle")}
              className="p-1 transition"
              style={{ color: "#3A3A4A" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-base font-semibold" style={{ color: "#F5F0E8" }}>{t.formTitle}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            <StarRating value={form.ratingOverall} onChange={(v) => setForm((f) => ({ ...f, ratingOverall: v }))} label={t.overall} />
            <StarRating value={form.ratingTranslation} onChange={(v) => setForm((f) => ({ ...f, ratingTranslation: v }))} label={t.translation} />
            <StarRating value={form.ratingAudio} onChange={(v) => setForm((f) => ({ ...f, ratingAudio: v }))} label={t.audio} />

            <div className="flex flex-col gap-1.5">
              <span className="text-sm" style={{ color: "#6B6B7A" }}>{t.audioDelay}</span>
              <div className="flex gap-2">
                {t.audioDelayLabels.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, ratingAudioDelay: i + 1 }))}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition"
                    style={form.ratingAudioDelay === i + 1
                      ? { background: "#C9A84C", color: "#09090F" }
                      : { background: "#111118", color: "#3A3A4A", border: "1px solid #1E1E2A" }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm" style={{ color: "#6B6B7A" }}>{t.hadBugs}</span>
              <div className="flex gap-3">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, hadBugs: val, bugDescription: val ? f.bugDescription : "" }))}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition"
                    style={form.hadBugs === val
                      ? { background: "#C9A84C", color: "#09090F" }
                      : { background: "#111118", color: "#3A3A4A", border: "1px solid #1E1E2A" }
                    }
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
                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                  style={{ background: "#111118", border: "1px solid #1E1E2A", color: "#F5F0E8" }}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm" style={{ color: "#6B6B7A" }}>{t.comment}</span>
              <textarea
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder={t.commentPlaceholder}
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                style={{ background: "#111118", border: "1px solid #1E1E2A", color: "#F5F0E8" }}
              />
            </div>
          </div>

          <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid #1E1E2A", background: "#09090F" }}>
            <button
              onClick={submitFeedback}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl text-base font-semibold transition"
              style={canSubmit
                ? { background: "#C9A84C", color: "#09090F" }
                : { background: "#111118", color: "#3A3A4A", cursor: "not-allowed" }
              }
            >
              {t.submit}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen flex flex-col items-center justify-center px-8 text-center gap-6" style={vsStyle}>
        <div>
          <div
            style={{
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
              fontSize: "1.75rem",
              fontWeight: 600,
              color: "#C9A84C",
              letterSpacing: "-0.02em",
              marginBottom: "4px",
            }}
          >
            Versespan
          </div>
        </div>
        <div className="space-y-2">
          <p
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", color: "#F5F0E8" }}
          >
            {t.sessionEnded}
          </p>
          <p className="text-sm" style={{ color: "#3A3A4A" }}>{t.thankYouJoining}</p>
        </div>
        <button
          onClick={() => setFeedbackState("form")}
          className="mt-2 px-8 py-3 rounded-xl font-semibold text-base transition active:scale-95"
          style={{ background: "#C9A84C", color: "#09090F" }}
        >
          {t.shareFeedback}
        </button>
        <button
          onClick={() => setFeedbackState("submitted")}
          className="text-sm transition"
          style={{ color: "#3A3A4A" }}
        >
          {t.skip}
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "#09090F", color: "#F5F0E8", fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
      onClick={() => unlockAudio(lastText)}
    >
      {/* Join screen */}
      {!audioUnlocked && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8"
          style={{ background: "#09090F" }}
        >
          <div className="flex flex-col items-center gap-8 text-center max-w-xs w-full">
            <div>
              <div
                style={{
                  fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
                  fontSize: "2.75rem",
                  fontWeight: 600,
                  color: "#C9A84C",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                Versespan
              </div>
              <div
                className="mt-2"
                style={{
                  color: "#3A3A4A",
                  fontSize: "0.6rem",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
                }}
              >
                Live Translation
              </div>
            </div>

            <div
              style={{
                background: "rgba(201,168,76,0.08)",
                border: "1px solid rgba(201,168,76,0.2)",
                borderRadius: "999px",
                padding: "5px 18px",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "#C9A84C",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
              }}
            >
              {targetLang === "es" ? "Español" : "English"}
            </div>

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => unlockAudio(lastText)}
                className="w-full py-4 rounded-xl font-semibold text-base transition-all active:scale-95"
                style={{
                  background: "#C9A84C",
                  color: "#09090F",
                  fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
                }}
              >
                {t.tapToEnable}
              </button>
              <p
                style={{
                  color: "#3A3A4A",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
                }}
              >
                {t.tapToEnableSub}
              </p>
            </div>
          </div>
        </div>
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
            style={ttsEnabled
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
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div
              className="flex items-center justify-between px-4 py-2 flex-shrink-0"
              style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C9A84C" }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>{t.nowPlaying}</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "#4ADE80" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ADE80" }} />
                {t.live}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="mb-6">
                <p
                  className={fontSizeClass}
                  style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", fontWeight: 600, color: "#F5F0E8" }}
                >
                  {presenting.song_titles[presenting.target_lang] || presenting.song_titles[presenting.source_lang] || Object.values(presenting.song_titles)[0] || ""}
                </p>
                {presenting.song_titles[presenting.source_lang] && presenting.song_titles[presenting.target_lang] && presenting.song_titles[presenting.source_lang] !== presenting.song_titles[presenting.target_lang] && (
                  <p className="text-sm mt-1" style={{ color: "#C9A84C" }}>{presenting.song_titles[presenting.source_lang]}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                {[...presenting.sections]
                  .sort((a, b) => a.section_number - b.section_number)
                  .map((section) => (
                    <div key={section.section_number} className="min-w-[200px]">
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#6B6B7A" }}>
                        {section.section_name}
                      </p>
                      <div className="rounded-xl p-3" style={{ background: "#111118", border: "1px solid #1E1E2A" }}>
                        <p className={`${fontSizeClass} leading-relaxed whitespace-pre-wrap`} style={{ color: "#F5F0E8" }}>
                          {section.texts[presenting.target_lang] || section.texts[presenting.source_lang] || Object.values(section.texts)[0] || ""}
                        </p>
                        {section.texts[presenting.target_lang] && section.texts[presenting.source_lang] && section.texts[presenting.target_lang] !== section.texts[presenting.source_lang] && (
                          <p className={`${sourceSizeClass} mt-2 italic whitespace-pre-wrap`} style={{ color: "#C9A84C" }}>
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
              <div
                className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
                style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
              >
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C9A84C" }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>{t.liveTranslation}</span>
              </div>

              {lastText && (
                <div
                  className="px-5 py-4 flex-shrink-0"
                  style={{ background: "#111118", borderBottom: "1px solid #1E1E2A", borderLeft: "3px solid #C9A84C" }}
                >
                  <p className={`${fontSizeClass} font-semibold leading-snug`} style={{ color: "#F5F0E8" }}>{lastText}</p>
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

            {presenting && presenting.content_type === "scripture" && (
              <div
                className="flex-shrink-0 max-h-[45vh] overflow-y-auto"
                style={{ background: "#0D0D17", borderTop: "1px solid #1E1E2A" }}
              >
                <div
                  className="flex items-center justify-between px-4 py-2 sticky top-0"
                  style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C9A84C" }} />
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>{t.scripture}</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "#4ADE80" }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ADE80" }} />
                    {t.live}
                  </span>
                </div>
                <div className="px-5 py-4 flex flex-col gap-3">
                  {presenting.verse_ref && (
                    <p className="text-sm font-semibold tracking-wide" style={{ color: "#C9A84C" }}>{presenting.verse_ref}</p>
                  )}
                  <p
                    className={`${fontSizeClass} leading-relaxed`}
                    style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", color: "#F5F0E8" }}
                  >
                    {presenting.target_text}
                  </p>
                  {presenting.source_text && presenting.source_text !== presenting.target_text && (
                    <p className={`${sourceSizeClass} italic`} style={{ color: "#3A3A4A" }}>{presenting.source_text}</p>
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
