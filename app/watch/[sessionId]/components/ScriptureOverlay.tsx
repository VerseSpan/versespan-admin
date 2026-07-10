"use client";

import { memo } from "react";
import type { I18NStrings } from "../types";

interface Props {
  targetText: string;
  sourceText: string;
  verseRef: string | null;
  fontSizeClass: string;
  sourceSizeClass: string;
  t: I18NStrings;
}

export default memo(function ScriptureOverlay({
  targetText,
  sourceText,
  verseRef,
  fontSizeClass,
  sourceSizeClass,
  t,
}: Props) {
  return (
    <div
      className="flex-shrink-0 max-h-[45vh] overflow-y-auto"
      style={{ background: "#0D0D17", borderTop: "1px solid #1E1E2A" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 sticky top-0"
        style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C9A84C" }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>{t.scripture}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "#4ADE80" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ADE80" }} />
          {t.live}
        </span>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">
        {verseRef && (
          <p className="text-sm font-semibold tracking-wide" style={{ color: "#C9A84C" }}>{verseRef}</p>
        )}
        <p
          className={`${fontSizeClass} leading-relaxed`}
          style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", color: "#F5F0E8" }}
        >
          {targetText}
        </p>
        {sourceText && sourceText !== targetText && (
          <p className={`${sourceSizeClass} italic`} style={{ color: "#3A3A4A" }}>{sourceText}</p>
        )}
      </div>
    </div>
  );
});
