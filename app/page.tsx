"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore, mapBackendSession, type BackendSession } from "@/lib/store";
import { StatCard } from "@/components/StatCard";
import { SessionRow } from "@/components/SessionRow";
import { api } from "@/lib/api";

export default function DashboardPage() {
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
        const currentSessions = useStore.getState().sessions;
        const mappedSessions = backendSessions.map((bs) => {
          const existing = currentSessions.find((s) => s.id === bs.id);
          const mapped = mapBackendSession(bs);
          if (existing) {
            return {
              ...mapped,
              translations: existing.translations || [],
              deviceId: existing.deviceId,
            };
          }
          return mapped;
        });
        setSessions(mappedSessions);
      } catch (err) {
        console.error("Failed to load sessions:", err);
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        setIsLoading(false);
      }
    }

    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const totalSessions = sessions.length;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1
        style={{
          fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
          fontSize: "2rem",
          fontWeight: 600,
          color: "#F5F0E8",
        }}
      >
        Dashboard
      </h1>
      {error && (
        <div
          className="p-4 rounded-lg text-sm"
          style={{ color: "#F87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Active Sessions" value={activeSessions.length} />
        <StatCard label="Total Sessions" value={totalSessions} />
      </div>
      <div>
        <Link href="/sessions/new">
          <button
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "#C9A84C", color: "#09090F" }}
          >
            + New Session
          </button>
        </Link>
      </div>
      <div>
        <h2
          className="text-base font-semibold mb-3"
          style={{
            color: "#6B6B7A",
            fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Recent Sessions
        </h2>
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ background: "#111118", border: "1px solid #1E1E2A" }}
        >
          {isLoading ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: "#3A3A4A" }}>
              Loading sessions...
            </div>
          ) : sessions.length > 0 ? (
            sessions.slice(0, 5).map((session) => (
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
            <div className="px-5 py-6 text-sm" style={{ color: "#3A3A4A" }}>
              No sessions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
