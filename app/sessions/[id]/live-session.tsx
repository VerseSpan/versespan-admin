"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TranslationClient } from "@/lib/translation-client";
import { api } from "@/lib/api";
import { useStore, type TranslationMessage } from "@/lib/store";
import { getLangName } from "@/lib/languages";

interface BackendTranslation {
  content_type?: 'speech' | 'scripture' | 'song';
  source_text?: string;
  target_text?: string;
  confidence?: number;
  timestamp?: string;
  created_at?: string;
}

interface LiveSessionProps {
  sessionId: string;
  sessionName: string;
  deviceId: string;
  startedAt: string;
  sourceLanguage: string;
  targetLanguage: string;
}


export function LiveSession({ sessionId, sessionName, deviceId, startedAt, sourceLanguage, targetLanguage }: LiveSessionProps) {
  const router = useRouter();
  const clientRef = useRef<TranslationClient | null>(null);

  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [activeClients, setActiveClients] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isStartingAudio, setIsStartingAudio] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelStatus, setModelStatus] = useState<Record<string, boolean> | null>(null);

  // Get translations from store instead of local state
  const session = useStore((state) => state.sessions.find((s) => s.id === sessionId));
  const translations = session?.translations || [];
  const addTranslation = useStore((state) => state.addTranslation);
  const setTranslations = useStore((state) => state.setTranslations);
  const setActiveSong = useStore((state) => state.setActiveSong);
  const activeSong = session?.activeSong;

  useEffect(() => {
    // Clear any previous errors when component mounts
    setError(null);

    // Initialize WebSocket client
    const client = new TranslationClient({
      sessionId,
      onTranslation: (message: TranslationMessage) => {
        // Add translation to store so it persists across navigation
        addTranslation(sessionId, message);
      },
      onStatus: (message: TranslationMessage) => {
        if (message.active_clients !== undefined) {
          setActiveClients(message.active_clients);
        }
        if (message.count !== undefined) {
          setActiveClients(message.count);
        }
      },
      onError: (error: string) => {
        setError(error);
        console.error('[LiveSession] Error:', error);
      },
      onConnectionChange: (connected: boolean) => {
        setConnected(connected);
        if (!connected) {
          setStreaming(false);
        }
      },
      onStreamingResumed: () => {
        setStreaming(true);
      },
      onSongStarted: (message: TranslationMessage) => {
        console.log('[LiveSession] Song started event received:', {
          song_id: message.song_id,
          song_titles: message.song_titles,
          sections_count: message.sections?.length,
        });
        if (message.song_id && message.song_titles && message.sections && message.sections.length > 0) {
          setActiveSong(sessionId, {
            song_id: message.song_id,
            song_titles: message.song_titles,
            source_lang: message.source_lang || 'es',
            target_lang: message.target_lang || 'en',
            sections: message.sections,
          });
        }
      },
      onSongEnded: () => {
        console.log('[LiveSession] Song ended, hiding lyrics overlay');
        setActiveSong(sessionId, null);
      },
    });

    clientRef.current = client;

    // Verify session + load history in parallel, then connect WebSocket
    const connectWithRetry = async () => {
      try {
        const [, historicalTranslations] = await Promise.all([
          api.getSession(sessionId),
          api.getSessionTranslations(sessionId),
        ]);

        if (Array.isArray(historicalTranslations)) {
          const messages: TranslationMessage[] = historicalTranslations.map((t: BackendTranslation) => ({
            type: 'translation',
            content_type: t.content_type || 'speech',
            source_text: t.source_text,
            target_text: t.target_text,
            confidence: t.confidence,
            timestamp: t.timestamp || t.created_at,
          }));
          setTranslations(sessionId, messages.reverse());
        }

        await client.connect();
        console.log('[LiveSession] ✓ Connected');
      } catch (error: unknown) {
        console.error('[LiveSession] Failed to connect:', error);
        setError(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    connectWithRetry();

    // Cleanup on unmount
    return () => {
      console.log('[LiveSession] Cleaning up and disconnecting...');
      client.disconnect();
    };
  }, [sessionId]);

  // Poll /health until all critical models are loaded — stops after 20 attempts (~60s)
  useEffect(() => {
    let stopped = false;
    let retries = 0;
    const MAX_RETRIES = 20;
    const poll = async () => {
      if (stopped || retries >= MAX_RETRIES) {
        if (retries >= MAX_RETRIES) setError("Service is taking too long to start. Please refresh.");
        return;
      }
      retries++;
      try {
        const health = await api.getHealth();
        if (stopped) return;
        setModelStatus(health.models);
        setModelsReady(health.models_ready);
        if (!health.models_ready) setTimeout(poll, 3000);
      } catch {
        if (!stopped) setTimeout(poll, 5000);
      }
    };
    poll();
    return () => { stopped = true; };
  }, []);

  // Warn user before navigating away while streaming
  useEffect(() => {
    if (!streaming) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [streaming]);

  const handleStartStreaming = async () => {
    if (!clientRef.current || !connected || isStartingAudio) return;

    setIsStartingAudio(true);
    try {
      await clientRef.current.startAudioCapture(deviceId);
      setStreaming(true);
      setError(null);
    } catch (error: unknown) {
      setError(`Failed to start audio: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsStartingAudio(false);
    }
  };

  const handleStopStreaming = () => {
    if (!clientRef.current) return;

    clientRef.current.stopAudioCapture();
    setStreaming(false);
  };

  const updateSession = useStore((state) => state.updateSession);

  const handleStopSession = async () => {
    if (isStopping) return;
    setIsStopping(true);

    try {
      // Stop audio and disconnect WebSocket
      if (clientRef.current) {
        clientRef.current.stopAudioCapture();
        clientRef.current.disconnect();
      }
      // End session on the backend
      await api.stopSession(sessionId);
      // Update store so session shows as ended
      updateSession(sessionId, { status: 'ended' });
    } catch (err) {
      console.error('[LiveSession] Failed to stop session on backend:', err);
      setError(`Failed to stop session: ${err instanceof Error ? err.message : String(err)}`);
      setIsStopping(false);
      return;
    }
    router.push('/sessions');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/sessions" className="text-blue-600 hover:underline">
          &larr; Back to Sessions
        </Link>
        <button
          className="bg-red-600 text-white px-6 py-2 rounded shadow hover:bg-red-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleStopSession}
          disabled={isStopping}
        >
          {isStopping ? 'Stopping...' : 'Stop Session'}
        </button>
      </div>

      {/* Session Info */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">{sessionName}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className={`font-bold ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
          {streaming && <span className="text-red-600 font-bold">● Streaming Audio</span>}
          <span className="text-gray-500">Started: {new Date(startedAt).toLocaleString()}</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
            {getLangName(sourceLanguage)} &rarr; {getLangName(targetLanguage)}
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <div className="text-4xl font-bold text-gray-900">{activeClients}</div>
          <div className="text-gray-500 mt-1">Connected Users</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <div className="text-4xl font-bold text-gray-900">{translations.length}</div>
          <div className="text-gray-500 mt-1">Translations</div>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Audio Stream Controls</h2>
        <div className="flex items-center gap-4">
          {!streaming ? (
            <button
              onClick={handleStartStreaming}
              disabled={!connected || isStartingAudio || !modelsReady}
              className={`px-6 py-3 rounded-lg font-semibold ${
                connected && !isStartingAudio && modelsReady
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isStartingAudio ? 'Starting...' : 'Start Streaming Audio'}
            </button>
          ) : (
            <button
              onClick={handleStopStreaming}
              className="px-6 py-3 rounded-lg font-semibold bg-yellow-600 text-white hover:bg-yellow-700"
            >
              Pause Streaming
            </button>
          )}
          <div className="text-sm text-gray-500">
            {!connected
              ? 'Connecting to server...'
              : !modelsReady
              ? 'Waiting for ML models to load...'
              : 'Ready to stream'}
          </div>
        </div>

        {/* Model loading status */}
        {!modelsReady && modelStatus && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-semibold text-yellow-800 mb-2">ML Models Loading...</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-yellow-700">
              {Object.entries(modelStatus).map(([name, loaded]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span>{loaded ? '✓' : '⏳'}</span>
                  <span className={loaded ? 'text-green-700' : ''}>{name.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {modelsReady && modelStatus && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-semibold text-green-800">All ML models loaded</p>
          </div>
        )}
      </div>


      {/* Song Lyrics Overlay - Shows when song is active */}
      {activeSong && (
        <div className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-lg shadow-2xl p-8 text-white">
          <div className="text-center mb-8">
            <div className="text-sm text-blue-200 uppercase tracking-wide mb-2">Now Playing</div>
            <h2 className="text-3xl font-bold mb-1">{activeSong.song_titles[activeSong.target_lang] || activeSong.song_titles[activeSong.source_lang] || Object.values(activeSong.song_titles)[0]}</h2>
            {activeSong.song_titles[activeSong.source_lang] && activeSong.song_titles[activeSong.source_lang] !== activeSong.song_titles[activeSong.target_lang] && (
              <div className="text-lg text-blue-300">{activeSong.song_titles[activeSong.source_lang]}</div>
            )}
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-6">
            {/* Display sections */}
            {[...activeSong.sections]
              .sort((a, b) => a.section_number - b.section_number)
              .map((section, index) => (
                <div key={`section-${section.section_number}-${index}`} className="mb-6">
                  <div className="text-sm font-semibold text-blue-300 mb-3 uppercase tracking-wide">
                    {section.section_name}
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="text-xl leading-relaxed whitespace-pre-wrap">
                      {section.texts[activeSong.target_lang] || section.texts[activeSong.source_lang] || Object.values(section.texts)[0]}
                    </div>
                    {section.texts[activeSong.target_lang] && section.texts[activeSong.source_lang] && section.texts[activeSong.target_lang] !== section.texts[activeSong.source_lang] && (
                      <div className="text-sm text-blue-200 mt-3 italic whitespace-pre-wrap">
                        {section.texts[activeSong.source_lang]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Translation Feed - Hidden when song is active */}
      {!activeSong && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Live Translation Feed</h2>
          </div>
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {translations.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                {streaming ? 'Waiting for translations...' : 'Start streaming to see translations here'}
              </div>
            ) : (
              translations.map((translation, index) => (
              <div key={index} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        translation.content_type === 'scripture'
                          ? 'bg-purple-100 text-purple-700'
                          : translation.content_type === 'song'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {translation.content_type || 'speech'}
                    </span>
                    {translation.confidence !== undefined && (
                      <span className="text-xs text-gray-500">
                        {(translation.confidence * 100).toFixed(2)}% confidence
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {translation.timestamp
                      ? new Date(translation.timestamp).toLocaleTimeString()
                      : new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{getLangName(sourceLanguage)}</div>
                    <div className="text-gray-900">{translation.source_text}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{getLangName(targetLanguage)}</div>
                    <div className="text-gray-900">{translation.target_text}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}
    </div>
  );
}