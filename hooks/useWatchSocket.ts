import { useEffect, useRef, useState, type RefObject } from "react";

export interface Translation {
  id: number;
  source_text: string;
  target_text: string;
  content_type: "speech" | "scripture" | "song";
  timestamp: string;
  /** Set on live finals so a later Stage C (Qwen) revision can swap the text
   *  in place by matching this id. Absent on history entries. */
  utteranceId?: string;
}

/** A sentence still forming (sentence_assembler backend flag). Updated in place
 *  by utterance_id; never spoken, never appended to history. */
export interface PendingUtterance {
  utteranceId: string;
  text: string;
  sourceText: string;
  revision: number;
}

export interface SongSection {
  section_number: number;
  section_name: string;
  texts: Record<string, string>;
}

export interface ActiveSong {
  song_id: number;
  song_titles: Record<string, string>;
  source_lang: string;
  target_lang: string;
  sections: SongSection[];
}

export type PresentingState =
  | { content_type: "song"; song_id: number | null; song_titles: Record<string, string>; source_lang: string; target_lang: string; sections: SongSection[] }
  | { content_type: "scripture"; target_text: string; verse_ref: string | null; source_text: string };

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "ended";

/** Orphan backstop: live partials update ~1/s and batches arrive within ~7s
 *  even in flowing speech, so a pending line untouched this long lost its
 *  final (e.g. its batch was hallucination-filtered) and must not hang. */
const PENDING_ORPHAN_TTL_MS = 10_000;

/** When llm_translation_act is on, the backend marks the opus-mt final
 *  `llm_pending` and a Qwen revision follows ~1s later. We hold TTS this long
 *  for that revision (covers the observed p90 ~2.1s) so spoken audio matches the
 *  settled Qwen text, then speak the opus-mt floor rather than leave silence. */
const LLM_SPEAK_WAIT_MS = 2500;

export function useWatchSocket({
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
}: {
  sessionId: string | undefined;
  speak: (text: string) => void;
  stopTTS: () => void;
  saveMetrics: () => void;
  sessionTargetLangRef: RefObject<string>;
  connectionDropsRef: RefObject<number>;
  totalTranslationsRef: RefObject<number>;
  wsMessageTimestampsRef: RefObject<number[]>;
  firstTranslationTimeRef: RefObject<number | null>;
  lastDisconnectCodeRef: RefObject<number | null>;
}) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [lastText, setLastText] = useState("");
  const [targetLang, setTargetLang] = useState<"en" | "es">("en");
  const [activeSong, setActiveSong] = useState<ActiveSong | null>(null);
  const [presenting, setPresenting] = useState<PresentingState | null>(null);
  const [pendingUtterance, setPendingUtterance] = useState<PendingUtterance | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const activeSongRef = useRef<ActiveSong | null>(null);
  const sessionEndedRef = useRef(false);
  const idCounter = useRef(0);
  const lastFinalizedUtteranceRef = useRef<string | null>(null);
  // utterance_id -> held TTS. When a final is `llm_pending` we defer its audio
  // here until the Qwen revision arrives (speak that) or the timer fires (speak
  // the opus-mt floor). Guarantees each utterance is spoken exactly once.
  const pendingSpeakRef = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; opusText: string }>>(new Map());

  // Every partial replaces pendingUtterance with a fresh object, so this timer
  // resets on each update and only fires for a line nothing will ever finalize
  useEffect(() => {
    if (!pendingUtterance) return;
    const timer = setTimeout(() => setPendingUtterance(null), PENDING_ORPHAN_TTL_MS);
    return () => clearTimeout(timer);
  }, [pendingUtterance]);

  useEffect(() => {
    if (!sessionId) return;

    // Stable singleton (mutated, never reassigned) — capture for the cleanup so
    // it clears whatever TTS holds exist at teardown, not a stale snapshot.
    const heldSpeech = pendingSpeakRef.current;

    const wsApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = wsApiUrl.replace("http://", "ws://").replace("https://", "wss://");
    const url = `${wsUrl}/api/ws/watch/${sessionId}?viewer_id=`;

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      console.log(`[Watch] Connecting`);
      setStatus("connecting");
      const viewerId = localStorage.getItem("viewer_id") ?? "";
      const ws = new WebSocket(url + viewerId);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[Watch] Connected (drops so far: ${connectionDropsRef.current})`);
        setStatus("connected");
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
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
              setTargetLang(tgt as "en" | "es");
              // Set the song flag (suppresses SUBSEQUENT speech finals at the
              // speak() guard below) but do NOT stopTTS — the cue-flush final
              // was just broadcast right before this event and is the speaker's
              // real words transitioning into worship; let it finish speaking.
              activeSongRef.current = song;
              setActiveSong(song);
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
            // Same as the presenting/song path: flag suppresses subsequent
            // speech, but any cue-flush final already speaking finishes.
            activeSongRef.current = song;
            setActiveSong(song);
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

            // Partial: a sentence still forming (sentence_assembler flag on the
            // backend). Update the pending line in place — never append to
            // history, never speak, never count in metrics.
            if (msg.status === "partial" && msg.utterance_id) {
              // Stale guard: a partial arriving after its final is dropped
              if (msg.utterance_id === lastFinalizedUtteranceRef.current) return;
              setPendingUtterance((prev) => {
                if (prev && prev.utteranceId === msg.utterance_id && msg.revision <= prev.revision) {
                  return prev; // apply-if-newer
                }
                return {
                  utteranceId: msg.utterance_id,
                  text,
                  sourceText: msg.source_text || "",
                  revision: msg.revision ?? 0,
                };
              });
              return;
            }

            // Stage C revision (llm_translation_act): the local LLM's improved
            // translation of a final already on screen. Swap the text in place by
            // utterance_id (never append or re-count). If TTS was held for this
            // utterance (llm_pending), speak the refined text now and cancel the
            // fallback; if the hold already timed out and spoke opus-mt, the entry
            // is gone so we do NOT re-speak. If the original line isn't found
            // (pruned past the 50-cap, or out of order) the swap is dropped.
            if (msg.status === "final" && msg.llm_revised && msg.utterance_id) {
              setTranslations((prev) => {
                for (let i = prev.length - 1; i >= 0; i--) {
                  if (prev[i].utteranceId === msg.utterance_id) {
                    const next = prev.slice();
                    next[i] = { ...next[i], target_text: text };
                    return next;
                  }
                }
                return prev;
              });
              // Only touch the big current-line if no newer final has landed
              if (lastFinalizedUtteranceRef.current === msg.utterance_id) setLastText(text);
              const held = pendingSpeakRef.current.get(msg.utterance_id);
              if (held) {
                clearTimeout(held.timer);
                pendingSpeakRef.current.delete(msg.utterance_id);
                speak(text); // speak the refined Qwen version instead of opus-mt
              }
              return;
            }

            // Final (status === "final", or no status — legacy backend / flag off).
            // ANY final clears the forming line: the backend flushes its pending
            // before emitting one, so whatever partial is on screen is stale even
            // when the final arrived under a different utterance id (scripture,
            // ProPresenter cues). A still-forming sentence re-establishes itself
            // on its next partial (~1s later).
            if (msg.utterance_id) {
              lastFinalizedUtteranceRef.current = msg.utterance_id;
            }
            setPendingUtterance(null);

            const now = Date.now();
            const entry: Translation = {
              id: ++idCounter.current,
              source_text: msg.source_text || "",
              target_text: text,
              content_type: msg.content_type || "speech",
              timestamp: msg.timestamp || new Date().toISOString(),
              utteranceId: msg.utterance_id,
            };
            console.log(`[Watch] Translation received (${msg.content_type || "speech"}): "${msg.source_text}" → "${text}" | TTS lang: ${sessionTargetLangRef.current}`);
            setTranslations((prev) => [...prev.slice(-49), entry]);
            setLastText(entry.target_text);

            totalTranslationsRef.current! += 1;
            if (firstTranslationTimeRef.current === null) firstTranslationTimeRef.current = now;
            wsMessageTimestampsRef.current!.push(now);
            if (wsMessageTimestampsRef.current!.length > 200) wsMessageTimestampsRef.current!.shift();
            saveMetrics();

            // Speak finals unless a song is presenting — EXCEPT passthrough
            // finals (the leader talking over a song slide), which are spoken
            // even during song mode since the listener still needs them.
            if (!activeSongRef.current || (msg as { passthrough?: boolean }).passthrough) {
              if (msg.llm_pending && msg.utterance_id) {
                // Hold audio for the incoming Qwen revision so the spoken text
                // matches what settles on screen; fall back to this opus-mt text
                // if the revision doesn't arrive in time.
                const uid = msg.utterance_id as string;
                const opusText = entry.target_text;
                const existing = pendingSpeakRef.current.get(uid);
                if (existing) clearTimeout(existing.timer);
                const timer = setTimeout(() => {
                  pendingSpeakRef.current.delete(uid);
                  speak(opusText);
                }, LLM_SPEAK_WAIT_MS);
                pendingSpeakRef.current.set(uid, { timer, opusText });
              } else {
                speak(entry.target_text);
              }
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
        const delay = event.code === 1000 ? 0 : 1000;
        if (event.code !== 1000) { connectionDropsRef.current! += 1; saveMetrics(); }
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
      heldSpeech.forEach(({ timer }) => clearTimeout(timer));
      heldSpeech.clear();
      wsRef.current?.close();
    };
  }, [sessionId, speak, stopTTS, saveMetrics, sessionTargetLangRef, connectionDropsRef, totalTranslationsRef, wsMessageTimestampsRef, firstTranslationTimeRef, lastDisconnectCodeRef]);

  return { status, translations, lastText, targetLang, activeSong, presenting, pendingUtterance };
}
