"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Ec2State {
  state: string;
  publicIp: string | null;
  instanceId: string;
}

interface Health {
  models_ready?: boolean;
  active_sessions?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const token = () => (typeof window !== "undefined" ? localStorage.getItem("authToken") : null);
const TRANSITIONAL = new Set(["pending", "stopping", "shutting-down"]);

async function call(path: string, method: "GET" | "POST" = "GET"): Promise<Ec2State> {
  const t = token();
  const res = await fetch(path, { method, headers: t ? { Authorization: `Bearer ${t}` } : {} });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

const LABEL: Record<string, string> = {
  running: "Running",
  stopped: "Stopped",
  pending: "Starting…",
  stopping: "Stopping…",
  "shutting-down": "Stopping…",
  unknown: "Unknown",
};
const COLOR: Record<string, string> = {
  running: "#3FB950",
  stopped: "#6B6B7A",
  pending: "#C9A84C",
  stopping: "#C9A84C",
  "shutting-down": "#C9A84C",
  unknown: "#6B6B7A",
};

export default function ControlPage() {
  const [ec2, setEc2] = useState<Ec2State | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await call("/api/ec2/status");
      setEc2(s);
      setError(null);
      if (s.state === "running") {
        try {
          const h = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
          setHealth(h.ok ? await h.json() : null);
        } catch {
          setHealth(null); // running but not answering yet (models still loading)
        }
      } else {
        setHealth(null);
      }
      // poll fast while transitioning, slow when settled
      const next = TRANSITIONAL.has(s.state) ? 5000 : 20000;
      timer.current = setTimeout(refresh, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load status");
      timer.current = setTimeout(refresh, 15000);
    }
  }, []);

  useEffect(() => {
    if (!token()) {
      setError("Not signed in");
      return;
    }
    refresh();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  const act = async (action: "start" | "stop") => {
    setBusy(true);
    setError(null);
    try {
      const s = await call(`/api/ec2/${action}`, "POST");
      setEc2(s);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refresh, 3000); // quick re-poll to catch the transition
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setBusy(false);
    }
  };

  const state = ec2?.state ?? "unknown";
  const transitioning = TRANSITIONAL.has(state) || busy;

  return (
    <main
      style={{ background: "var(--vs-bg)", color: "var(--vs-text)", minHeight: "100vh" }}
      className="px-4 py-6 sm:px-6"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">System Control</h1>
          <Link href="/sessions" className="text-sm" style={{ color: "var(--vs-muted)" }}>
            ← Sessions
          </Link>
        </div>

        {error === "Not signed in" ? (
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)" }}
          >
            <p className="mb-3" style={{ color: "var(--vs-muted)" }}>
              Please sign in to control the server.
            </p>
            <Link href="/login" className="font-medium" style={{ color: "var(--vs-gold)" }}>
              Go to login →
            </Link>
          </div>
        ) : (
          <>
            <section
              className="rounded-2xl p-5"
              style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)" }}
            >
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    background: COLOR[state] || COLOR.unknown,
                    boxShadow: state === "running" ? `0 0 8px ${COLOR.running}` : "none",
                    animation: TRANSITIONAL.has(state) ? "pulse 1.2s ease-in-out infinite" : "none",
                  }}
                />
                <div>
                  <div className="text-lg font-semibold">Backend server</div>
                  <div className="text-sm" style={{ color: "var(--vs-muted)" }}>
                    {LABEL[state] || state}
                    {ec2?.publicIp && state === "running" ? ` · ${ec2.publicIp}` : ""}
                  </div>
                </div>
              </div>

              {state === "running" && (
                <div
                  className="mb-4 grid grid-cols-2 gap-3 rounded-xl p-3 text-sm"
                  style={{ background: "var(--vs-bg)", border: "1px solid var(--vs-border)" }}
                >
                  <div>
                    <div style={{ color: "var(--vs-muted)" }}>Models</div>
                    <div className="font-medium">
                      {health == null ? "Loading…" : health.models_ready ? "Ready ✓" : "Not ready"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--vs-muted)" }}>Active sessions</div>
                    <div className="font-medium">{health?.active_sessions ?? "—"}</div>
                  </div>
                </div>
              )}

              {state === "stopped" && (
                <button
                  onClick={() => act("start")}
                  disabled={transitioning}
                  className="w-full rounded-xl py-3 font-semibold transition disabled:opacity-50"
                  style={{ background: "var(--vs-gold)", color: "#000" }}
                >
                  {busy ? "Starting…" : "Start server"}
                </button>
              )}
              {state === "running" && (
                <button
                  onClick={() => act("stop")}
                  disabled={transitioning}
                  className="w-full rounded-xl py-3 font-semibold transition disabled:opacity-50"
                  style={{ background: "transparent", color: "#F85149", border: "1px solid #F85149" }}
                >
                  {busy ? "Stopping…" : "Stop server"}
                </button>
              )}
              {TRANSITIONAL.has(state) && (
                <div className="text-center text-sm" style={{ color: "var(--vs-muted)" }}>
                  {state === "pending" ? "Booting + loading models (~3–4 min)…" : "Shutting down…"}
                </div>
              )}
            </section>

            {error && error !== "Not signed in" && (
              <p className="mt-4 text-center text-sm" style={{ color: "#F85149" }}>
                {error}
              </p>
            )}
            <p className="mt-6 text-center text-xs" style={{ color: "var(--vs-subtle)" }}>
              Auto-refreshing · start before a service, stop after
            </p>
          </>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
    </main>
  );
}
