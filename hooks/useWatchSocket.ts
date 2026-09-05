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
 *  `llm_pending` and ALWAYS follows with one "speak this" revision — the Qwen
 *  text when it succeeds, or the opus-mt floor if Qwen failed/timed out. So we
 *  simply hold TTS for that revision and speak whatever it carries; no timing
 *  race to lose. This value is only a last-resort safety net for a revision
 *  message that never arrives at all (lost in transit): set it past the backend
 *  Qwen timeout (8s) + margin so it never pre-empts the real signal. */
const LLM_SPEAK_WAIT_MS = 9000;

/** Watchdog: ping this often. The server answers every ping with a pong and
 *  also sends a keepalive ping when idle, so SOME message should arrive well
 *  within WS_STALE_MS. If none does, the socket went half-open (a silent
 *  deploy/network drop with no close frame) — force a reconnect, since onclose
 *  never fires for a half-open connection and the viewer would hang forever. */
const WS_PING_MS = 15_000;
const WS_STALE_MS = 45_000;

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
  // Timestamp of the last message received on the socket — the watchdog uses it
  // to detect a half-open connection (no traffic, including pongs) and reconnect.
  const lastMessageAtRef = useRef<number>(0);
  // Ordered TTS queue — every speakable final gets a slot in finalization order.
  // A slot with text=null is a `llm_pending` final awaiting its Qwen revision
  // (or the safety timeout → opus floor); a slot with text set is ready. We only
  // ever speak from the FRONT, so a later sentence never jumps ahead of an
  // earlier one whose Qwen is still in flight (Qwen tasks finish out of order).
  const speakQueueRef = useRef<
    Array<{ uid?: string; text: string | null; opusText: string; timer: ReturnType<typeof setTimeout> | null }>
  >([]);

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
    // it clears whatever TTS timers exist at teardown, not a stale snapshot.
    const speakQueue = speakQueueRef.current;

    // Speak ready slots strictly from the front, so audio stays in finalization
    // order even when a later sentence's Qwen revision arrives before an earlier
    // one's. Stops at the first not-yet-ready slot.
    const drainSpeak = () => {
      const q = speakQueueRef.current;
      while (q.length && q[0].text !== null) {
        const slot = q.shift()!;
        if (slot.timer) clearTimeout(slot.timer);
        speak(slot.text!);
      }
    };

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
        lastMessageAtRef.current = Date.now();
        const watchdog = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          // Half-open guard: no message (not even our ping's pong) for WS_STALE_MS
          // means the socket died silently — close it so onclose fires and we
          // reconnect. Otherwise send the keepalive ping.
          if (Date.now() - lastMessageAtRef.current > WS_STALE_MS) {
            console.warn("[Watch] Connection stale — forcing reconnect");
            try { ws.close(); } catch {}
            return;
          }
          ws.send(JSON.stringify({ type: "ping" }));
        }, WS_PING_MS);
        ws.addEventListener("close", () => clearInterval(watchdog));
      };

      ws.onmessage = (event) => {
        lastMessageAtRef.current = Date.now(); // any traffic keeps the watchdog satisfied
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "ping" }));
            return;
          }

          if (msg.type === "pong") return; // watchdog keepalive ack — nothing else to do

          if (msg.type === "server_restart") {
            // Backend is going down for a deploy; reconnect proactively instead of
            // waiting for a close frame that a half-open socket may never deliver.
            console.log("[Watch] Server restarting — reconnecting");
            try { ws.close(); } catch {}
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
            // utterance_id (never append or re-count), then fill this utterance's
            // TTS slot with the refined text and drain — the ordered queue speaks
            // it once every earlier slot has been spoken (so out-of-order Qwen
            // completions never reorder the audio). If the slot is gone (already
            // spoken, or the line was pruned) the revision only updates the text.
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
              const slot = speakQueueRef.current.find((s) => s.uid === msg.utterance_id && s.text === null);
              if (slot) {
                slot.text = text; // refined Qwen (or opus fallback carried by llm_failed)
                drainSpeak();
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
              // Every speakable final takes a slot in the ordered queue so audio
              // stays in finalization order.
              if (msg.llm_pending && msg.utterance_id) {
                // Qwen revision is coming — reserve a not-ready slot; the revision
                // fills it, or the safety timer falls back to this opus-mt text so
                // a lost revision never wedges the queue.
                const uid = msg.utterance_id as string;
                const opusText = entry.target_text;
                const timer = setTimeout(() => {
                  const s = speakQueueRef.current.find((x) => x.uid === uid && x.text === null);
                  if (s) {
                    s.text = s.opusText;
                    drainSpeak();
                  }
                }, LLM_SPEAK_WAIT_MS);
                speakQueueRef.current.push({ uid, text: null, opusText, timer });
              } else {
                // Non-deferred final (no Qwen revision expected) — ready immediately.
                speakQueueRef.current.push({
                  uid: msg.utterance_id,
                  text: entry.target_text,
                  opusText: entry.target_text,
                  timer: null,
                });
                drainSpeak();
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
      speakQueue.forEach((s) => s.timer && clearTimeout(s.timer));
      speakQueue.length = 0;
      wsRef.current?.close();
    };
  }, [sessionId, speak, stopTTS, saveMetrics, sessionTargetLangRef, connectionDropsRef, totalTranslationsRef, wsMessageTimestampsRef, firstTranslationTimeRef, lastDisconnectCodeRef]);

  return { status, translations, lastText, targetLang, activeSong, presenting, pendingUtterance };
}
