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
  const from = searchParams.get('from') || '/';

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
      // Hard redirect ensures the auth cookie is sent with the next request
      // before the middleware checks it
      window.location.href = from.startsWith('/') && !from.startsWith('/login') ? from : '/';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded shadow p-8 w-full max-w-sm space-y-6"
    >
      <div className="text-center mb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Versespan</h1>
        <div className="text-gray-500 text-sm">Admin Dashboard</div>
      </div>
      <div>
        <label className="block text-base font-bold mb-1 text-gray-900">Email</label>
        <input
          type="email"
          className="w-full border rounded px-3 py-2 text-gray-900"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <div>
        <label className="block text-base font-bold mb-1 text-gray-900">Password</label>
        <input
          type="password"
          className="w-full border rounded px-3 py-2 text-gray-900"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
