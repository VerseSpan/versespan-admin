import { useEffect, useRef, useState, useCallback, type RefObject } from "react";

export function useTTS({
  sessionId,
  apiUrl,
  sessionTargetLangRef,
  viewerIdRef,
  ttsLatenciesRef,
  saveMetrics,
}: {
  sessionId: string | undefined;
  apiUrl: string;
  sessionTargetLangRef: RefObject<string>;
  viewerIdRef: RefObject<string>;
  ttsLatenciesRef: RefObject<number[]>;
  saveMetrics: () => void;
}) {
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const ttsEnabledRef = useRef(true);
  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const ttsProcessingRef = useRef(false);

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
        const params = new URLSearchParams({ text: t, lang: sessionTargetLangRef.current!, viewer_id: viewerIdRef.current!, session_id: sessionId ?? "" });
        const t0 = Date.now();
        const res = await fetch(`${apiUrl}/api/tts?${params}`, { signal: ctrl.signal });
        if (!res.ok || ctrl.signal.aborted) return null;
        ttsLatenciesRef.current!.push(Date.now() - t0);
        saveMetrics();
        const ab = await res.arrayBuffer();
        if (ctrl.signal.aborted) return null;
        const ctx = audioCtxRef.current!;
        if (ctx.state === "suspended") await ctx.resume();
        return ctx.decodeAudioData(ab);
      } catch { return null; }
    };

    let prefetch: Promise<AudioBuffer | null> | null = null;

    try {
      while (ttsQueueRef.current.length > 0) {
        if (!ttsEnabledRef.current) { ttsQueueRef.current = []; break; }

        const item = ttsQueueRef.current.shift()!;
        const bufferPromise = prefetch ?? fetchAudio(item);
        prefetch = null;

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
          if (!prefetch && ttsQueueRef.current.length > 0) {
            prefetch = fetchAudio(ttsQueueRef.current[0]);
          }
        });
      }
    } finally {
      ttsProcessingRef.current = false;
    }
  }, [apiUrl, saveMetrics, sessionId, sessionTargetLangRef, viewerIdRef, ttsLatenciesRef]);

  const stopTTS = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsQueueRef.current = [];
    currentSourceRef.current?.stop();
    currentSourceRef.current = null;
  }, []);

  const unlockAudio = useCallback(async (lastText: string) => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    } catch {}
    if (lastText) speak(lastText);
  }, [speak]);

  return {
    ttsEnabled,
    setTtsEnabled,
    audioUnlocked,
    speak,
    stopTTS,
    unlockAudio,
  };
}
