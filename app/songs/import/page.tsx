"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getChurchId } from "@/lib/api";

interface ParsedSection {
  sectionNumber: number;
  sectionName: string;
  spanish: string;
  english: string;
}

export default function ImportSongsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paired Text state
  const [spanishTitle, setSpanishTitle] = useState("");
  const [englishTitle, setEnglishTitle] = useState("");
  const [spanishLyrics, setSpanishLyrics] = useState("");
  const [englishLyrics, setEnglishLyrics] = useState("");
  const [parsedSections, setParsedSections] = useState<ParsedSection[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const parsePairedText = (spanish: string, english: string): ParsedSection[] => {
    // Split by double newlines to get sections (verses/choruses)
    const spanishSections = spanish.split(/\n\s*\n/).filter(section => section.trim() !== "");
    const englishSections = english.split(/\n\s*\n/).filter(section => section.trim() !== "");
    const parsed: ParsedSection[] = [];

    const maxSections = Math.max(spanishSections.length, englishSections.length);

    for (let i = 0; i < maxSections; i++) {
      const sectionName = `Section ${i + 1}`;
      const spanishText = spanishSections[i]?.trim() || "";
      const englishText = englishSections[i]?.trim() || "";

      parsed.push({
        sectionNumber: i + 1,
        sectionName,
        spanish: spanishText,
        english: englishText,
      });
    }

    return parsed;
  };

  const handlePreviewPairedText = () => {
    if (!spanishLyrics.trim() && !englishLyrics.trim()) {
      setError("Please enter lyrics in at least one language to preview");
      return;
    }
    const parsed = parsePairedText(spanishLyrics, englishLyrics);
    if (parsed.length === 0) {
      setError("Could not parse any sections.");
      return;
    }
    setParsedSections(parsed);
    setShowPreview(true);
    setError(null);
  };

  const handleImportPairedText = async () => {
    if (!spanishTitle.trim()) {
      setError("Please enter a Spanish title");
      return;
    }
    if (!englishTitle.trim()) {
      setError("Please enter an English title");
      return;
    }
    if (parsedSections.length === 0) {
      setError("Please preview the lyrics first");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Send sections as chunks directly to backend
      const sections = parsedSections.map(section => ({
        section_number: section.sectionNumber,
        section_name: section.sectionName,
        text_source: section.spanish,
        text_target: section.english,
      }));

      await api.importSongWithSections({
        church_id: getChurchId(),
        title: spanishTitle,
        title_target: englishTitle,
        sections,
      });

      // Rebuild search index best-effort — don't block navigation on failure
      api.rebuildSongIndex().catch(() => {});

      // Redirect to songs list
      router.push("/songs");
    } catch (err) {
      console.error("Failed to import song:", err);
      setError(err instanceof Error ? err.message : "Failed to import song");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/songs" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            &larr; Back to Songs
          </Link>
          <h1 className="text-2xl font-bold">Import Song</h1>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Import Form */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800">
              <strong>Instructions:</strong> Paste your Spanish lyrics on the left and English lyrics on the right.
              Separate verses/choruses with blank lines. Each section will be paired automatically (Spanish section 1 → English section 1).
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Spanish Title
                </label>
                <input
                  type="text"
                  value={spanishTitle}
                  onChange={(e) => setSpanishTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="e.g., Asombroso Dios"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  English Title
                </label>
                <input
                  type="text"
                  value={englishTitle}
                  onChange={(e) => setEnglishTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="e.g., Amazing God"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Spanish Lyrics
                </label>
                <textarea
                  value={spanishLyrics}
                  onChange={(e) => {
                    setSpanishLyrics(e.target.value);
                    setShowPreview(false);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900"
                  rows={12}
                  placeholder="Eres un Dios asombroso&#10;&#10;Tu amor nunca falla&#10;Me levanta cuando caigo"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  English Lyrics
                </label>
                <textarea
                  value={englishLyrics}
                  onChange={(e) => {
                    setEnglishLyrics(e.target.value);
                    setShowPreview(false);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900"
                  rows={12}
                  placeholder="You are an amazing God&#10;&#10;Your love never fails&#10;It lifts me when I fall"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePreviewPairedText}
                disabled={isLoading}
                className="bg-gray-600 text-white px-6 py-2 rounded shadow hover:bg-gray-700 transition font-semibold disabled:opacity-50"
              >
                Preview
              </button>
              {showPreview && (
                <button
                  onClick={handleImportPairedText}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 transition font-semibold disabled:opacity-50"
                >
                  {isLoading ? "Importing..." : `Import ${parsedSections.length} Sections`}
                </button>
              )}
            </div>

            {/* Preview Sections */}
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1 font-semibold">Spanish</div>
                          <div className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                            {section.spanish}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1 font-semibold">English</div>
                          <div className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
                            {section.english}
                          </div>
                        </div>
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
