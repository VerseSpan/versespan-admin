"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, getChurchId } from "@/lib/api";
import { getLangName } from "@/lib/languages";

interface SongSection {
  id: string;
  section_number: number;
  section_name: string;
  texts: Record<string, string>;
}

interface Song {
  id: string;
  titles: Record<string, string>;
  is_active: boolean;
  sections: SongSection[];
}

export default function SongDetailPage() {
  const params = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [churchLanguages, setChurchLanguages] = useState<string[]>(["es", "en"]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit states
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [editedIsActive, setEditedIsActive] = useState(true);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editedSectionName, setEditedSectionName] = useState("");
  const [editedSectionTexts, setEditedSectionTexts] = useState<Record<string, string>>({});

  // New section state
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionTexts, setNewSectionTexts] = useState<Record<string, string>>({});

  const loadSong = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getSong(params.id) as Song;
      setSong(data);
      setEditedTitles(data.titles || {});
      setEditedIsActive(data.is_active);
    } catch (err) {
      console.error("Failed to load song:", err);
      setError(err instanceof Error ? err.message : "Failed to load song");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSong();
    api.getChurchLanguages(getChurchId()).then(setChurchLanguages).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleSaveSongInfo = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await api.updateSong(params.id, { titles: editedTitles, is_active: editedIsActive });
      await loadSong();
    } catch (err) {
      console.error("Failed to update song:", err);
      setError(err instanceof Error ? err.message : "Failed to update song");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSection = (section: SongSection) => {
    setEditingSectionId(section.id);
    setEditedSectionName(section.section_name);
    setEditedSectionTexts(section.texts || {});
  };

  const handleSaveSection = async () => {
    if (!editingSectionId || isSavingSection) return;
    try {
      setIsSavingSection(true);
      setError(null);
      await api.updateSongSection(params.id, editingSectionId, {
        section_name: editedSectionName,
        texts: editedSectionTexts,
      });
      setEditingSectionId(null);
      await loadSong();
    } catch (err) {
      console.error("Failed to update section:", err);
      setError(err instanceof Error ? err.message : "Failed to update section");
    } finally {
      setIsSavingSection(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingSectionId(null);
    setEditedSectionName("");
    setEditedSectionTexts({});
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Are you sure you want to delete this section?")) return;
    try {
      setError(null);
      await api.deleteSongSection(params.id, sectionId);
      await loadSong();
    } catch (err) {
      console.error("Failed to delete section:", err);
      setError(err instanceof Error ? err.message : "Failed to delete section");
    }
  };

  const handleAddNewSection = async () => {
    const hasText = Object.values(newSectionTexts).some(t => t.trim());
    if (!hasText) {
      setError("At least one language text is required");
      return;
    }
    try {
      setError(null);
      const nextSectionNumber = song?.sections.length
        ? Math.max(...song.sections.map((s: SongSection) => s.section_number)) + 1
        : 1;
      await api.addSongSection(params.id, {
        section_number: nextSectionNumber,
        section_name: newSectionName || `Section ${nextSectionNumber}`,
        texts: newSectionTexts,
      });
      setNewSectionName("");
      setNewSectionTexts({});
      setShowNewSection(false);
      await loadSong();
    } catch (err) {
      console.error("Failed to add section:", err);
      setError(err instanceof Error ? err.message : "Failed to add section");
    }
  };

  const handleReorderSection = async (sectionId: string, direction: "up" | "down") => {
    if (!song) return;
    const currentSection = song.sections.find((s: SongSection) => s.id === sectionId);
    if (!currentSection) return;
    const currentIndex = song.sections.findIndex((s: SongSection) => s.id === sectionId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= song.sections.length) return;
    const targetSection = song.sections[targetIndex];
    try {
      setError(null);
      await api.updateSongSection(params.id, currentSection.id, { section_number: targetSection.section_number });
      await api.updateSongSection(params.id, targetSection.id, { section_number: currentSection.section_number });
      await loadSong();
    } catch (err) {
      console.error("Failed to reorder sections:", err);
      setError(err instanceof Error ? err.message : "Failed to reorder sections");
    }
  };

  const langGridStyle = { gridTemplateColumns: `repeat(${churchLanguages.length}, 1fr)` };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center py-12 text-gray-500">Loading song...</div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center py-12 text-red-600">Song not found</div>
        <div className="text-center">
          <Link href="/songs" className="text-blue-600 hover:underline">
            &larr; Back to Songs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/songs" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Songs
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Song Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Song Information</h2>
        <div className="space-y-4">
          <div className="grid gap-4" style={langGridStyle}>
            {churchLanguages.map(lang => (
              <div key={lang}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {getLangName(lang)} Title
                </label>
                <input
                  type="text"
                  value={editedTitles[lang] || ""}
                  onChange={(e) => setEditedTitles(prev => ({ ...prev, [lang]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-active"
              checked={editedIsActive}
              onChange={(e) => setEditedIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="is-active" className="text-sm font-medium text-gray-700">
              Active (available for live sessions)
            </label>
          </div>
          <div>
            <button
              onClick={handleSaveSongInfo}
              disabled={isSaving}
              className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition font-semibold disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Song Sections */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sections ({song.sections.length})</h2>
          <button
            onClick={() => setShowNewSection(true)}
            className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition font-semibold text-sm"
          >
            + Add Section
          </button>
        </div>

        {/* New Section Form */}
        {showNewSection && (
          <div className="px-6 py-4 bg-blue-50 border-b">
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Section Name (e.g., Verse 1, Chorus)
              </label>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="e.g., Verse 1"
              />
            </div>
            <div className="grid gap-4 mb-3" style={langGridStyle}>
              {churchLanguages.map(lang => (
                <div key={lang}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {getLangName(lang)} Lyrics
                  </label>
                  <textarea
                    value={newSectionTexts[lang] || ""}
                    onChange={(e) => setNewSectionTexts(prev => ({ ...prev, [lang]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-sm"
                    rows={4}
                    placeholder={`Enter ${getLangName(lang)} lyrics`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddNewSection}
                className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition font-semibold text-sm"
              >
                Add Section
              </button>
              <button
                onClick={() => {
                  setShowNewSection(false);
                  setNewSectionName("");
                  setNewSectionTexts({});
                }}
                className="bg-gray-400 text-white px-4 py-2 rounded shadow hover:bg-gray-500 transition font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="divide-y">
          {song.sections.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              No sections yet. Add your first section to get started.
            </div>
          ) : (
            song.sections
              .sort((a: SongSection, b: SongSection) => a.section_number - b.section_number)
              .map((section: SongSection, index: number) => (
                <div key={section.id} className="px-6 py-4 hover:bg-gray-50">
                  {editingSectionId === section.id ? (
                    <div>
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Section Name</label>
                        <input
                          type="text"
                          value={editedSectionName}
                          onChange={(e) => setEditedSectionName(e.target.value)}
                          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div className="grid gap-4 mb-3" style={langGridStyle}>
                        {churchLanguages.map(lang => (
                          <div key={lang}>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              {getLangName(lang)} Lyrics
                            </label>
                            <textarea
                              value={editedSectionTexts[lang] || ""}
                              onChange={(e) => setEditedSectionTexts(prev => ({ ...prev, [lang]: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-sm"
                              rows={4}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveSection}
                          disabled={isSavingSection}
                          className="text-green-600 hover:text-green-800 font-semibold text-sm disabled:opacity-50"
                        >
                          {isSavingSection ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold text-gray-500 uppercase">
                          {section.section_name}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReorderSection(section.id, "up")}
                            disabled={index === 0}
                            className="text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleReorderSection(section.id, "down")}
                            disabled={index === song.sections.length - 1}
                            className="text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleEditSection(section)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-sm ml-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSection(section.id)}
                            className="text-red-600 hover:text-red-800 font-semibold text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-4" style={langGridStyle}>
                        {churchLanguages.map(lang => (
                          <div key={lang}>
                            <div className="text-xs text-gray-500 mb-1">{getLangName(lang)}</div>
                            <div className="text-sm text-gray-900 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded min-h-[2rem]">
                              {section.texts[lang] || <span className="text-gray-400 italic">No text</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
