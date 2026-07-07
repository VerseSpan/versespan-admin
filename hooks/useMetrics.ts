import { useEffect, useRef, useCallback } from "react";

export function useMetrics(sessionId: string | undefined) {
  const metricsKey = `versespan-metrics-${sessionId}`;

  const watchStartTimeRef = useRef(0);
  const connectionDropsRef = useRef(0);
  const totalTranslationsRef = useRef(0);
  const ttsLatenciesRef = useRef<number[]>([]);
  const wsMessageTimestampsRef = useRef<number[]>([]);
  const firstTranslationTimeRef = useRef<number | null>(null);
  const lastDisconnectCodeRef = useRef<number | null>(null);

  const saveMetrics = useCallback(() => {
    const lats = ttsLatenciesRef.current;
    const avgTts = lats.length > 0
      ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length)
      : null;
    const ts = wsMessageTimestampsRef.current;
    const avgWs = ts.length > 1
      ? Math.round(ts.slice(1).reduce((sum, t, i) => sum + (t - ts[i]), 0) / (ts.length - 1))
      : null;
    localStorage.setItem(metricsKey, JSON.stringify({
      watchStartTime: watchStartTimeRef.current,
      connectionDrops: connectionDropsRef.current,
      totalTranslations: totalTranslationsRef.current,
      firstTranslationTime: firstTranslationTimeRef.current,
      avgTtsLatencyMs: avgTts,
      avgWsIntervalMs: avgWs,
    }));
  }, [metricsKey]);

  const buildMetadata = useCallback((ttsEnabled: boolean) => {
    const timestamps = wsMessageTimestampsRef.current;
    const avgInterval = timestamps.length > 1
      ? Math.round(
          timestamps.slice(1).reduce((sum, t, i) => sum + (t - timestamps[i]), 0) /
          (timestamps.length - 1)
        )
      : null;
    const latencies = ttsLatenciesRef.current;
    const avgTts = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    let resolvedAvgTts = avgTts;
    let resolvedAvgWs = avgInterval;
    if (avgTts === null || avgInterval === null) {
      try {
        const saved = JSON.parse(localStorage.getItem(metricsKey) || "{}");
        if (avgTts === null && saved.avgTtsLatencyMs) resolvedAvgTts = saved.avgTtsLatencyMs;
        if (avgInterval === null && saved.avgWsIntervalMs) resolvedAvgWs = saved.avgWsIntervalMs;
      } catch {}
    }

    return {
      user_agent: navigator.userAgent,
      watch_duration_seconds: Math.round((Date.now() - watchStartTimeRef.current) / 1000),
      tts_enabled: ttsEnabled,
      connection_drops: connectionDropsRef.current,
      avg_tts_latency_ms: resolvedAvgTts,
      total_translations_received: totalTranslationsRef.current,
      session_duration_ms: firstTranslationTimeRef.current
        ? Date.now() - firstTranslationTimeRef.current
        : null,
      last_disconnect_reason: lastDisconnectCodeRef.current?.toString() ?? null,
      avg_ws_message_interval_ms: resolvedAvgWs,
    };
  }, [metricsKey]);

  useEffect(() => {
    const saved = localStorage.getItem(metricsKey);
    if (saved) {
      try {
        const m = JSON.parse(saved);
        if (m.watchStartTime) watchStartTimeRef.current = m.watchStartTime;
        if (m.connectionDrops) connectionDropsRef.current = m.connectionDrops;
        if (m.totalTranslations) totalTranslationsRef.current = m.totalTranslations;
        if (m.firstTranslationTime) firstTranslationTimeRef.current = m.firstTranslationTime;
      } catch {}
    } else {
      watchStartTimeRef.current = Date.now();
      saveMetrics();
    }
  }, [metricsKey, saveMetrics]);

  return {
    metricsKey,
    saveMetrics,
    buildMetadata,
    watchStartTimeRef,
    connectionDropsRef,
    totalTranslationsRef,
    ttsLatenciesRef,
    wsMessageTimestampsRef,
    firstTranslationTimeRef,
    lastDisconnectCodeRef,
  };
}
