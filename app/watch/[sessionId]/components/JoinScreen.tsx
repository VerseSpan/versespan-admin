"use client";

import type { I18NStrings } from "../types";

interface Props {
  targetLang: string;
  lastText: string | null;
  unlockAudio: (text: string) => void | Promise<void>;
  t: I18NStrings;
}

export default function JoinScreen({ targetLang, lastText, unlockAudio, t }: Props) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8"
      style={{ background: "#09090F" }}
    >
      <div className="flex flex-col items-center gap-8 text-center max-w-xs w-full">
        <div>
          <div
            style={{
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
              fontSize: "2.75rem",
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
              fontSize: "0.6rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
            }}
          >
            Live Translation
          </div>
        </div>

        <div
          style={{
            background: "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.2)",
            borderRadius: "999px",
            padding: "5px 18px",
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#C9A84C",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
          }}
        >
          {targetLang === "es" ? "Español" : "English"}
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => unlockAudio(lastText ?? "")}
            className="w-full py-4 rounded-xl font-semibold text-base transition-all active:scale-95"
            style={{
              background: "#C9A84C",
              color: "#09090F",
              fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
            }}
          >
            {t.tapToEnable}
          </button>
          <p
            style={{
              color: "#3A3A4A",
              fontSize: "0.75rem",
              fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
            }}
          >
            {t.tapToEnableSub}
          </p>
        </div>
      </div>
    </div>
  );
}
