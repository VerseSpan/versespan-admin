"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

type State = "loading" | "redirecting" | "no-session" | "error";

export default function JoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [churchName, setChurchName] = useState<string>("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function resolve() {
      try {
        const result = await api.getActiveSessionBySlug(slug);
        if (cancelled) return;
        if (result) {
          setChurchName(result.church_name);
          setState("redirecting");
          router.replace(`/watch/${result.session_id}`);
        } else {
          setState("no-session");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [slug, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#09090F" }}
    >
      <div className="text-center px-6">
        {state === "loading" && (
          <>
            <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-sm">Connecting...</p>
          </>
        )}

        {state === "redirecting" && (
          <>
            <div className="w-10 h-10 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold mb-1">
              {churchName ? `Joining ${churchName}` : "Joining service..."}
            </p>
            <p className="text-white/50 text-sm">Redirecting you now</p>
          </>
        )}

        {state === "no-session" && (
          <>
            <p
              className="text-4xl mb-4"
              style={{
                fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
                color: "#C9A84C",
                fontWeight: 600,
              }}
            >
              Versespan
            </p>
            <p className="text-white text-lg font-semibold mb-2">
              Service hasn&apos;t started yet
            </p>
            <p className="text-white/50 text-sm mb-6">
              The live translation will be available once the service begins.
            </p>
            <button
              onClick={() => {
                setState("loading");
                api.getActiveSessionBySlug(slug).then((result) => {
                  if (result) {
                    setState("redirecting");
                    router.replace(`/watch/${result.session_id}`);
                  } else {
                    setState("no-session");
                  }
                }).catch(() => setState("error"));
              }}
              className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition"
            >
              Check again
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <p className="text-white text-lg font-semibold mb-2">Something went wrong</p>
            <p className="text-white/50 text-sm mb-6">
              Unable to connect. Please try again or ask for help.
            </p>
            <button
              onClick={() => {
                setState("loading");
                api.getActiveSessionBySlug(slug).then((result) => {
                  if (result) {
                    setState("redirecting");
                    router.replace(`/watch/${result.session_id}`);
                  } else {
                    setState("no-session");
                  }
                }).catch(() => setState("error"));
              }}
              className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
