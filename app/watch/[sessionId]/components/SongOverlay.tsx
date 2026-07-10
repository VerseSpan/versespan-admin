"use client";

import { memo } from "react";
import type { SongSection } from "@/hooks/useWatchSocket";
import type { I18NStrings } from "../types";

interface Props {
  songTitles: Record<string, string>;
  sections: SongSection[];
  sourceLang: string;
  targetLang: string;
  fontSizeClass: string;
  sourceSizeClass: string;
  t: I18NStrings;
}

export default memo(function SongOverlay({
  songTitles,
  sections,
  sourceLang,
  targetLang,
  fontSizeClass,
  sourceSizeClass,
  t,
}: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#C9A84C" }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>{t.nowPlaying}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "#4ADE80" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ADE80" }} />
          {t.live}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mb-6">
          <p
            className={fontSizeClass}
            style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", fontWeight: 600, color: "#F5F0E8" }}
          >
            {songTitles[targetLang] || songTitles[sourceLang] || Object.values(songTitles)[0] || ""}
          </p>
          {songTitles[sourceLang] && songTitles[targetLang] && songTitles[sourceLang] !== songTitles[targetLang] && (
            <p className="text-sm mt-1" style={{ color: "#C9A84C" }}>{songTitles[sourceLang]}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          {[...sections]
            .sort((a, b) => a.section_number - b.section_number)
            .map((section) => (
              <div key={section.section_number} className="min-w-[200px]">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#6B6B7A" }}>
                  {section.section_name}
                </p>
                <div className="rounded-xl p-3" style={{ background: "#111118", border: "1px solid #1E1E2A" }}>
                  <p className={`${fontSizeClass} leading-relaxed whitespace-pre-wrap`} style={{ color: "#F5F0E8" }}>
                    {section.texts[targetLang] || section.texts[sourceLang] || Object.values(section.texts)[0] || ""}
                  </p>
                  {section.texts[targetLang] && section.texts[sourceLang] && section.texts[targetLang] !== section.texts[sourceLang] && (
                    <p className={`${sourceSizeClass} mt-2 italic whitespace-pre-wrap`} style={{ color: "#C9A84C" }}>
                      {section.texts[sourceLang]}
                    </p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
});
