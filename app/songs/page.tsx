"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getChurchId } from "@/lib/api";
import { getLangName } from "@/lib/languages";

interface PPStatus {
  feature_enabled: boolean;
  bridge_connected: boolean;
}

interface Song {
  id: string;
  titles: Record<string, string>;
  section_count: number;
  is_active: boolean;
}

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ppStatus, setPpStatus] = useState<PPStatus | null>(null);
  const [churchLanguages, setChurchLanguages] = useState<string[]>(["es", "en"]);

  useEffect(() => {
    api.proPresenterStatus()
      .then((s) => setPpStatus(s as PPStatus))
      .catch(() => {});
    api.getChurchLanguages(getChurchId()).then(setChurchLanguages).catch(() => {});
  }, []);

  const loadSongs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getSongs(getChurchId()) as Song[];
      setSongs(data);
    } catch (err) {
      console.error("Failed to load songs:", err);
      setError(err instanceof Error ? err.message : "Failed to load songs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSongs();
  }, []);

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await api.deleteSong(id);
      setSongs(songs.filter(s => s.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete song:", err);
      setError(err instanceof Error ? err.message : "Failed to delete song");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Song Library</h1>
        <div className="flex gap-3">
          {ppStatus?.feature_enabled && (
            <Link href="/songs/import/propresenter">
              <button
                className={`px-4 py-2 rounded shadow font-semibold transition text-white ${
                  ppStatus.bridge_connected
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-purple-400 cursor-not-allowed"
                }`}
                title={ppStatus.bridge_connected ? "Import from ProPresenter" : "Start the bridge app first"}
              >
                Import from ProPresenter
              </button>
            </Link>
          )}
          <Link href="/songs/import">
            <button className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition font-semibold">
              + Import Songs
            </button>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Songs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-gray-500">Loading songs...</div>
        ) : songs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <p className="mb-4">No songs found.</p>
            <Link href="/songs/import">
              <button className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 font-semibold">
                Import Your First Song
              </button>
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{getLangName(churchLanguages[0] || "es")} Title</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{getLangName(churchLanguages[1] || "en")} Title</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Sections</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {songs.map((song) => (
                <tr key={song.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm text-gray-900">{song.titles[churchLanguages[0]] || Object.values(song.titles)[0] || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{song.titles[churchLanguages[1]] || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-center">{song.section_count}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                      song.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {song.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link href={`/songs/${song.id}`}>
                      <button className="text-blue-600 hover:text-blue-800 font-semibold text-sm">
                        Edit
                      </button>
                    </Link>
                    {deleteConfirm === song.id ? (
                      <span className="inline-flex gap-2">
                        <button
                          onClick={() => handleDelete(song.id)}
                          disabled={isDeleting}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm disabled:opacity-50"
                        >
                          {isDeleting ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(song.id)}
                        className="text-red-600 hover:text-red-800 font-semibold text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
