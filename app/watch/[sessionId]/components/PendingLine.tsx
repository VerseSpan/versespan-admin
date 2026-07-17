"use client";

import { memo, useRef } from "react";

/**
 * The forming sentence (a partial from the sentence assembler / live layer).
 *
 * Words already shown stay put; newly arrived words slide up + fade in with a
 * small stagger, terminated by a blinking gold cursor — reads as live typing
 * without character-level reflow jitter. Settles when the final replaces it.
 */
function PendingLine({ text, fontSizeClass }: { text: string; fontSizeClass: string }) {
  const words = text.split(/\s+/).filter(Boolean);

  // Words rendered on the previous pass don't re-animate; only the new tail does.
  const prevCountRef = useRef(0);
  const firstNewIndex = words.length < prevCountRef.current ? 0 : prevCountRef.current;
  prevCountRef.current = words.length;

  return (
    <p className={`${fontSizeClass} font-semibold leading-snug`} style={{ color: "#B8B2A4" }}>
      {words.map((word, i) => (
        <span
          key={`${i}-${word}`}
          style={
            i >= firstNewIndex
              ? {
                  display: "inline-block",
                  animation: "wordIn 0.28s ease both",
                  animationDelay: `${(i - firstNewIndex) * 55}ms`,
                }
              : { display: "inline-block" }
          }
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
