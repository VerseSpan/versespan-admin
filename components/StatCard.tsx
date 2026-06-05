import React from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  color?: string;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col"
      style={{
        background: "#111118",
        border: "1px solid #1E1E2A",
        borderTop: "2px solid #C9A84C",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
          fontSize: "3rem",
          fontWeight: 600,
          color: "#F5F0E8",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        className="mt-2 text-xs font-semibold uppercase tracking-widest"
        style={{ color: "#6B6B7A", fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
      >
        {label}
      </div>
    </div>
  );
}
