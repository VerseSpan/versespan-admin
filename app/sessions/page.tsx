"use client";


import { useEffect, useState } from "react";
import { useStore, mapBackendSession, type BackendSession } from "@/lib/store";
import { SessionRow } from "@/components/SessionRow";
import Link from "next/link";
import { api } from "@/lib/api";

export default function SessionsPage() {
  const sessions = useStore((state) => state.sessions);
  const setSessions = useStore((state) => state.setSessions);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        setIsLoading(true);
        setError(null);
        const backendSessions = await api.getSessions() as BackendSession[];

        // Get current sessions from store at the time of loading
        const currentSessions = sessions;

        // Merge backend data with existing store data to preserve translations
        const mappedSessions = backendSessions.map((backendSession) => {
          // Find existing session in current store
          const existingSession = currentSessions.find((s) => s.id === backendSession.id);

          // Map backend session
          const newSession = mapBackendSession(backendSession);

          // Preserve translations and other frontend-only data if session exists
          if (existingSession) {
            return {
              ...newSession,
              translations: existingSession.translations || [],
              deviceId: existingSession.deviceId,
            };
          }

          return newSession;
        });

        setSessions(mappedSessions);
      } catch (err) {
        console.error("Failed to load sessions:", err);
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        setIsLoading(false);
      }
    }

    // Only load once on mount
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1
          style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            fontSize: "2rem",
            fontWeight: 600,
            color: "#F5F0E8",
          }}
        >
          Sessions
        </h1>
        <Link href="/sessions/new">
          <button
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "#C9A84C", color: "#09090F" }}
          >
            + New Session
          </button>
        </Link>
      </div>
      {error && (
        <div
          className="p-4 rounded-lg text-sm"
          style={{ color: "#F87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#111118", border: "1px solid #1E1E2A" }}
      >
        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: "#3A3A4A" }}>
            Loading sessions...
          </div>
        ) : sessions.length > 0 ? (
          sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="block transition-colors"
              style={{ borderBottom: "1px solid #1E1E2A" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <SessionRow
                name={session.name}
                startedAt={session.startedAt}
                status={session.status}
                connectedUsers={session.connectedUsers}
              />
            </Link>
          ))
        ) : (
          <div className="px-5 py-8 text-center text-sm" style={{ color: "#3A3A4A" }}>
            No sessions found.
          </div>
        )}
      </div>
    </div>
  );
}
