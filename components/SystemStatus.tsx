"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PodStatus {
  id: string;
  desiredStatus: "RUNNING" | "EXITED" | "TERMINATED";
  lastStatusChange: string;
  runtime?: {
    uptimeInSeconds: number;
    gpus?: { id: string; gpuUtilPercent: number; memoryUtilPercent: number }[];
  };
}

interface HealthStatus {
  status: "healthy" | "starting";
  models_ready: boolean;
  models: {
    asr_es: boolean;
    asr_en: boolean;
    mt_es_en: boolean;
    mt_en_es: boolean;
    xlm_roberta: boolean;
    song_lookup: boolean;
    scripture_lookup: boolean;
  };
  gpu?: {
    name: string;
    vram_gb: number;
    device: string;
    compute_type: string;
  };
  active_sessions: number;
}

const MODEL_LABELS: Record<string, string> = {
  asr_es: "Speech Recognition (ES)",
  asr_en: "Speech Recognition (EN)",
  mt_es_en: "Translation ES→EN",
  mt_en_es: "Translation EN→ES",
  xlm_roberta: "Content Classifier",
  song_lookup: "Song Index",
  scripture_lookup: "Scripture Index",
};

export function SystemStatus() {
  const [pod, setPod] = useState<PodStatus | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [podLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [healthError, setHealthError] = useState(false);
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchPodStatus() {
    try {
      const res = await fetch("/api/runpod", { cache: "no-store" });
      const data = await res.json();
      if (data.pod) setPod(data.pod);
    } catch {
      // silently ignore
    }
  }

  async function fetchHealth() {
    try {
      const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
      const data = await res.json();
      setHealth(data);
      setHealthError(false);
    } catch {
      setHealth(null);
      setHealthError(true);
    }
  }

  useEffect(() => {
    fetchPodStatus();
    const podInterval = setInterval(fetchPodStatus, 5000);
    return () => clearInterval(podInterval);
  }, []);

  useEffect(() => {
    if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);

    if (pod?.desiredStatus === "RUNNING") {
      fetchHealth();
      healthIntervalRef.current = setInterval(fetchHealth, 3000);
    } else {
      setHealth(null);
      setHealthError(false);
    }

    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
    };
  }, [pod?.desiredStatus]);

  async function handleAction(action: "start" | "stop" | "deploy") {
    setActionLoading(true);
    try {
      await fetch("/api/runpod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setTimeout(fetchPodStatus, 2000);
    } finally {
      setActionLoading(false);
    }
  }

  const isRunning = pod?.desiredStatus === "RUNNING";
  const isStopped = pod?.desiredStatus === "EXITED";
  const modelsReady = health?.models_ready === true;
  const modelList = health?.models ? Object.entries(health.models) : [];
  const loadedCount = modelList.filter(([, v]) => v).length;

  if (podLoading) {
    return <div className="text-sm text-gray-400">Loading system status...</div>;
  }

  return (
    <div className="bg-white rounded shadow p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">GPU Backend</h2>
        <div className="flex items-center gap-2">
          {pod ? (
            <>
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  isRunning && modelsReady
                    ? "bg-green-500"
                    : isRunning
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-gray-400"
                }`}
              />
              <span className="text-sm font-medium text-gray-700">
                {isRunning && modelsReady
                  ? "Ready"
                  : isRunning
                  ? "Starting up..."
                  : "Stopped"}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">Checking...</span>
          )}
        </div>
      </div>

      {/* GPU info */}
      {health?.gpu && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 flex gap-4">
          <span className="font-medium text-gray-700">{health.gpu.name}</span>
          <span>{health.gpu.vram_gb}GB VRAM</span>
          <span className="uppercase">{health.gpu.compute_type}</span>
        </div>
      )}

      {/* Model loading progress */}
      {isRunning && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Models
            </span>
            {!healthError && health && (
              <span className="text-xs text-gray-400">
                {loadedCount}/{modelList.length} loaded
              </span>
            )}
          </div>
          {healthError ? (
            <p className="text-xs text-gray-400">Waiting for backend to come online...</p>
          ) : health ? (
            <div className="grid grid-cols-1 gap-1">
              {modelList.map(([key, loaded]) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      loaded ? "bg-green-500" : "bg-gray-300 animate-pulse"
                    }`}
                  />
                  <span className={`text-xs ${loaded ? "text-gray-700" : "text-gray-400"}`}>
                    {MODEL_LABELS[key] ?? key}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Connecting to backend...</p>
          )}
        </div>
      )}

      {/* Uptime */}
      {isRunning && pod?.runtime?.uptimeInSeconds != null && (
        <p className="text-xs text-gray-400">
          Uptime: {Math.floor(pod.runtime.uptimeInSeconds / 60)}m{" "}
          {pod.runtime.uptimeInSeconds % 60}s
        </p>
      )}

      {/* Start / Stop / Deploy */}
      <div className="flex gap-2 pt-1">
        <button
          disabled={isRunning || actionLoading || !isStopped}
          onClick={() => handleAction("start")}
          className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {actionLoading && !isRunning ? "Starting..." : "Start"}
        </button>
        <button
          disabled={!isRunning || actionLoading}
          onClick={() => handleAction("stop")}
          className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {actionLoading && isRunning ? "Stopping..." : "Stop"}
        </button>
        <button
          disabled={actionLoading}
          onClick={() => handleAction("deploy")}
          className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Pull latest image and restart"
        >
          {actionLoading ? "Deploying..." : "Deploy latest"}
        </button>
      </div>
    </div>
  );
}
