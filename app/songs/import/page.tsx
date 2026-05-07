"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getChurchId } from "@/lib/api";
import { getLangName } from "@/lib/languages";

interface ParsedSection {
  sectionNumber: number;
  sectionName: string;
  texts: Record<string, string>;
}

export default function ImportSongsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [churchLanguages, setChurchLanguages] = useState<string[]>(["es", "en"]);

  const [langTitles, setLangTitles] = useState<Record<string, string>>({});
  const [langLyrics, setLangLyrics] = useState<Record<string, string>>({});
  const [parsedSections, setParsedSections] = useState<ParsedSection[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    api.getChurchLanguages(getChurchId()).then(setChurchLanguages).catch(() => {});
  }, []);

  const parseSections = (lyrics: Record<string, string>): ParsedSection[] => {
    const splitByLang: Record<string, string[]> = {};
    let maxSections = 0;
    for (const [lang, text] of Object.entries(lyrics)) {
      if (!text.trim()) continue;
      const parts = text.split(/\n\s*\n/).filter(s => s.trim() !== "");
      splitByLang[lang] = parts;
      maxSections = Math.max(maxSections, parts.length);
    }
    const parsed: ParsedSection[] = [];
    for (let i = 0; i < maxSections; i++) {
      const texts: Record<string, string> = {};
      for (const lang of Object.keys(splitByLang)) {
        texts[lang] = splitByLang[lang][i]?.trim() || "";
      }
      parsed.push({ sectionNumber: i + 1, sectionName: `Section ${i + 1}`, texts });
    }
    return parsed;
  };

  const handlePreview = () => {
    const hasContent = Object.values(langLyrics).some(t => t.trim());
    if (!hasContent) {
      setError("Please enter lyrics in at least one language to preview");
      return;
    }
    const parsed = parseSections(langLyrics);
    if (parsed.length === 0) {
      setError("Could not parse any sections.");
      return;
    }
    setParsedSections(parsed);
    setShowPreview(true);
    setError(null);
  };

  const handleImport = async () => {
    const primaryLang = churchLanguages[0];
    if (!langTitles[primaryLang]?.trim()) {
      setError(`Please enter a ${getLangName(primaryLang)} title`);
      return;
    }
    if (parsedSections.length === 0) {
      setError("Please preview the lyrics first");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const titles: Record<string, string> = {};
      for (const [lang, t] of Object.entries(langTitles)) {
        if (t.trim()) titles[lang] = t.trim();
      }

      await api.importSongWithSections({
        church_id: getChurchId(),
        titles,
        sections: parsedSections.map(section => ({
          section_number: section.sectionNumber,
          section_name: section.sectionName,
          texts: section.texts,
        })),
      });

      api.rebuildSongIndex().catch(() => {});
      router.push("/songs");
    } catch (err) {
      console.error("Failed to import song:", err);
      setError(err instanceof Error ? err.message : "Failed to import song");
    } finally {
      setIsLoading(false);
    }
  };

  const gridStyle = { gridTemplateColumns: `repeat(${churchLanguages.length}, 1fr)` };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/songs" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            &larr; Back to Songs
          </Link>
          <h1 className="text-2xl font-bold">Import Song</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800">
              <strong>Instructions:</strong> Enter titles and lyrics for each language.
              Separate verses/choruses with blank lines — each section will be paired automatically.
            </div>

            <div className="grid gap-4" style={gridStyle}>
              {churchLanguages.map(lang => (
                <div key={lang}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getLangName(lang)} Title
                  </label>
                  <input
                    type="text"
                    value={langTitles[lang] || ""}
                    onChange={(e) => setLangTitles(prev => ({ ...prev, [lang]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder={`Title in ${getLangName(lang)}`}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4" style={gridStyle}>
              {churchLanguages.map(lang => (
                <div key={lang}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getLangName(lang)} Lyrics
                  </label>
                  <textarea
                    value={langLyrics[lang] || ""}
                    onChange={(e) => {
                      setLangLyrics(prev => ({ ...prev, [lang]: e.target.value }));
                      setShowPreview(false);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900"
                    rows={12}
                    placeholder={`Paste ${getLangName(lang)} lyrics here...`}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                disabled={isLoading}
                className="bg-gray-600 text-white px-6 py-2 rounded shadow hover:bg-gray-700 transition font-semibold disabled:opacity-50"
              >
                Preview
              </button>
              {showPreview && (
                <button
                  onClick={handleImport}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 transition font-semibold disabled:opacity-50"
                >
                  {isLoading ? "Importing..." : `Import ${parsedSections.length} Sections`}
                </button>
              )}
            </div>

            {showPreview && parsedSections.length > 0 && (
              <div className="mt-6 border border-gray-200 rounded overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-sm text-gray-700">Preview ({parsedSections.length} sections)</h3>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-4 p-4">
                  {parsedSections.map((section) => (
                    <div key={section.sectionNumber} className="border border-gray-200 rounded p-4 bg-gray-50">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-3">
                        {section.sectionName}
                      </div>
                      <div className="grid gap-4" style={gridStyle}>
                        {churchLanguages.map(lang => (
                          <div key={lang}>
                            <div className="text-xs text-gray-500 mb-1 font-semibold">{getLangName(lang)}</div>
                            <div className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                              {section.texts[lang] || <span className="text-gray-400 italic">—</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
