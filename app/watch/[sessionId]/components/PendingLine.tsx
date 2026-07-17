"use client";

import { memo } from "react";

/**
 * The forming sentence (a partial from the sentence assembler / live layer).
 *
 * Words are spans keyed by index: existing spans never remount (their mount
 * animation already ran), newly appended words mount fresh and animate in —
 * "new words only" falls out of React's mount semantics, no state or refs.
 * The parent keys this component by utterance_id so each new sentence starts
 * a fresh cascade. Settles when the final replaces it.
 */
function PendingLine({ text, fontSizeClass }: { text: string; fontSizeClass: string }) {
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <p className={`${fontSizeClass} font-semibold leading-snug`} style={{ color: "#B8B2A4" }}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            animation: "wordIn 0.28s ease both",
            animationDelay: `${(i % 8) * 45}ms`,
          }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: "0.55em",
          marginLeft: "2px",
          color: "#C9A84C",
          animation: "cursorBlink 0.9s steps(1) infinite",
        }}
      >
        ▍
      </span>
      <style>{`
        @keyframes wordIn {
          from {
            opacity: 0;
            transform: translateY(0.35em);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes cursorBlink {
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </p>
  );
}

export default memo(PendingLine);
