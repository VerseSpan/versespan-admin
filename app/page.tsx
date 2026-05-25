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
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Active Sessions" value={activeSessions.length} color="bg-blue-600" />
        <StatCard label="Total Sessions" value={totalSessions} color="bg-blue-500" />
      </div>
      <div>
        <Link href="/sessions/new">
          <button className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition font-semibold">
            + New Session
          </button>
        </Link>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2">Recent Sessions</h2>
        <div className="bg-white rounded shadow divide-y">
          {isLoading ? (
            <div className="px-4 py-6 text-gray-500 text-center">Loading sessions...</div>
          ) : sessions.length > 0 ? (
            sessions.slice(0, 5).map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="block hover:bg-gray-50 transition"
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
            <div className="px-4 py-3 text-gray-400">No sessions found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
