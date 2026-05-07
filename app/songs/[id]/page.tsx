"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface SongSection {
  id: string;
  section_number: number;
  section_name: string;
  text_source: string;
  text_target: string;
}

interface Song {
  id: string;
  title: string;
  title_target: string;
  is_active: boolean;
  sections: SongSection[];
}

export default function SongDetailPage() {
  const params = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit states
  const [editedTitle, setEditedTitle] = useState("");
  const [editedTitleTarget, setEditedTitleTarget] = useState("");
  const [editedIsActive, setEditedIsActive] = useState(true);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editedSectionName, setEditedSectionName] = useState("");
  const [editedSectionSource, setEditedSectionSource] = useState("");
  const [editedSectionTarget, setEditedSectionTarget] = useState("");

  // New section state
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionSource, setNewSectionSource] = useState("");
  const [newSectionTarget, setNewSectionTarget] = useState("");

  const loadSong = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getSong(params.id) as Song;
      setSong(data);
      setEditedTitle(data.title);
      setEditedTitleTarget(data.title_target);
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
  }, [params.id]);

  const handleSaveSongInfo = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await api.updateSong(params.id, {
        title: editedTitle,
        title_target: editedTitleTarget,
        is_active: editedIsActive,
      });
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
    setEditedSectionSource(section.text_source);
    setEditedSectionTarget(section.text_target);
  };

  const handleSaveSection = async () => {
    if (!editingSectionId || isSavingSection) return;

    try {
      setIsSavingSection(true);
      setError(null);
      await api.updateSongSection(params.id, editingSectionId, {
        section_name: editedSectionName,
        text_source: editedSectionSource,
        text_target: editedSectionTarget,
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
    setEditedSectionSource("");
    setEditedSectionTarget("");
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
    if (!newSectionSource.trim() || !newSectionTarget.trim()) {
      setError("Both Spanish and English text are required");
      return;
    }

    try {
      setError(null);
      const nextSectionNumber = song?.sections.length ? Math.max(...song.sections.map((s: SongSection) => s.section_number)) + 1 : 1;
      await api.addSongSection(params.id, {
        section_number: nextSectionNumber,
        section_name: newSectionName || `Section ${nextSectionNumber}`,
        text_source: newSectionSource,
        text_target: newSectionTarget,
      });
      setNewSectionName("");
      setNewSectionSource("");
      setNewSectionTarget("");
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
      // Swap section numbers
      await api.updateSongSection(params.id, currentSection.id, {
        section_number: targetSection.section_number,
      });
      await api.updateSongSection(params.id, targetSection.id, {
        section_number: currentSection.section_number,
      });
      await loadSong();
    } catch (err) {
      console.error("Failed to reorder sections:", err);
      setError(err instanceof Error ? err.message : "Failed to reorder sections");
    }
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/songs" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Songs
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Song Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Song Information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Spanish Title
              </label>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                English Title
              </label>
              <input
                type="text"
                value={editedTitleTarget}
                onChange={(e) => setEditedTitleTarget(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
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
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Spanish Lyrics
                </label>
                <textarea
                  value={newSectionSource}
                  onChange={(e) => setNewSectionSource(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-sm"
                  rows={4}
                  placeholder="Enter Spanish lyrics for this section"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  English Lyrics
                </label>
                <textarea
                  value={newSectionTarget}
                  onChange={(e) => setNewSectionTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-sm"
                  rows={4}
                  placeholder="Enter English lyrics for this section"
                />
              </div>
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
                  setNewSectionSource("");
                  setNewSectionTarget("");
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
                    // Edit mode
                    <div>
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Section Name
                        </label>
                        <input
                          type="text"
                          value={editedSectionName}
                          onChange={(e) => setEditedSectionName(e.target.value)}
                          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Spanish Lyrics
                          </label>
                          <textarea
                            value={editedSectionSource}
                            onChange={(e) => setEditedSectionSource(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-sm"
                            rows={4}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            English Lyrics
                          </label>
                          <textarea
                            value={editedSectionTarget}
                            onChange={(e) => setEditedSectionTarget(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-sm"
                            rows={4}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveSection}
                          disabled={isSavingSection}
                          className="text-green-600 hover:text-green-800 font-semibold text-sm disabled:opacity-50"
                        >
                          {isSavingSection ? 'Saving...' : 'Save'}
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
                    // View mode
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Spanish</div>
                          <div className="text-sm text-gray-900 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                            {section.text_source}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">English</div>
                          <div className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                            {section.text_target}
                          </div>
                        </div>
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
