"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await api.login(email, password);
      window.location.href = from.startsWith("/") && !from.startsWith("/login") ? from : "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-5"
      style={{
        background: "#111118",
        border: "1px solid #1E1E2A",
        borderTop: "2px solid #C9A84C",
        borderRadius: "16px",
        padding: "40px 36px",
      }}
    >
      {/* Wordmark */}
      <div className="text-center mb-6">
        <div
          style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            fontSize: "2.25rem",
            fontWeight: 600,
            color: "#C9A84C",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Versespan
        </div>
        <div
          className="mt-2"
          style={{
            color: "#3A3A4A",
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 600,
            fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
          }}
        >
          Admin Dashboard
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div>
          <label
            className="block mb-1.5"
            style={{
              color: "#6B6B7A",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
            }}
          >
            Email
          </label>
          <input
            type="email"
            className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all"
            style={{
              background: "#09090F",
              border: "1px solid #1E1E2A",
              color: "#F5F0E8",
              fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#1E1E2A"; }}
          />
        </div>
        <div>
          <label
            className="block mb-1.5"
            style={{
              color: "#6B6B7A",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
            }}
          >
            Password
          </label>
          <input
            type="password"
            className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all"
            style={{
              background: "#09090F",
              border: "1px solid #1E1E2A",
              color: "#F5F0E8",
              fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#1E1E2A"; }}
          />
        </div>
      </div>

      {error && (
        <div
          className="text-sm px-3 py-2 rounded-lg"
          style={{
            color: "#F87171",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.2)",
            fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 rounded-lg text-sm font-semibold transition-all"
        style={{
          background: isLoading ? "#1E1E2A" : "#C9A84C",
          color: isLoading ? "#3A3A4A" : "#09090F",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
        }}
      >
        {isLoading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#09090F" }}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
