import React from "react";

interface SessionRowProps {
  name: string;
  startedAt: string;
  status: string;
  connectedUsers: number;
}

export function SessionRow({ name, startedAt, status, connectedUsers }: SessionRowProps) {
  const date = new Date(startedAt);
  const formatted = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const isLive = status !== "ended";

  return (
    <div className="flex justify-between items-center px-5 py-4">
      <div className="flex flex-col gap-1">
        <div
          className="text-sm font-semibold"
          style={{ color: "#F5F0E8", fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
        >
          {name}
        </div>
        <div className="text-xs" style={{ color: "#3A3A4A" }}>
          {formatted}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: "#3A3A4A" }}>
          {connectedUsers} viewers
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style={
            isLive
              ? {
                  color: "#4ADE80",
                  background: "rgba(74,222,128,0.08)",
                  border: "1px solid rgba(74,222,128,0.2)",
                }
              : {
                  color: "#3A3A4A",
                  background: "rgba(58,58,74,0.2)",
                  border: "1px solid #1E1E2A",
                }
          }
        >
          {isLive ? "Live" : "Ended"}
        </span>
      </div>
    </div>
  );
}
