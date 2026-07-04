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

interface Playlist {
  id: string;
  name: string;
}

interface SyncResultItem {
  name: string;
  action: "created" | "skipped";
  reason?: string;
  song_id?: number;
  sections?: number;
  detected_lang?: string;
}

interface SyncResult {
  songs_created: number;
  songs_skipped: number;
  items: SyncResultItem[];
}

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ppStatus, setPpStatus] = useState<PPStatus | null>(null);
  const [churchLanguages, setChurchLanguages] = useState<string[]>(["es", "en"]);

  // Sync state
  const [syncOpen, setSyncOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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

  const handleOpenSync = async () => {
    setSyncOpen(true);
    setSyncResult(null);
    setSelectedPlaylist("");
    setPlaylistsLoading(true);
    try {
      const data = await api.proPresenterPlaylists() as { playlists: Playlist[] };
      setPlaylists(data.playlists || []);
    } catch {
      setPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedPlaylist || isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.syncPropresenterPlaylist(selectedPlaylist) as SyncResult;
      setSyncResult(result);
      if (result.songs_created > 0) loadSongs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Song Library</h1>
        <div className="flex gap-3">
          {ppStatus?.feature_enabled && ppStatus.bridge_connected && (
            <button
              onClick={handleOpenSync}
              className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition font-semibold"
            >
              Sync from ProPresenter
            </button>
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

      {/* Sync Panel */}
      {syncOpen && (
        <div className="bg-white rounded-lg shadow p-5 border border-purple-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Sync Songs from ProPresenter Playlist</h2>
            <button onClick={() => { setSyncOpen(false); setSyncResult(null); }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
          {playlistsLoading ? (
            <p className="text-sm text-gray-500">Loading playlists…</p>
          ) : playlists.length === 0 ? (
            <p className="text-sm text-gray-500">No playlists found. Make sure the bridge is running.</p>
          ) : (
            <div className="flex items-center gap-3">
              <select
                value={selectedPlaylist}
                onChange={(e) => setSelectedPlaylist(e.target.value)}
                className="border rounded px-3 py-2 text-sm flex-1 max-w-sm"
              >
                <option value="">— Select a playlist —</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={handleSync}
                disabled={!selectedPlaylist || isSyncing}
                className="bg-purple-600 text-white px-4 py-2 rounded font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? "Syncing…" : "Sync"}
              </button>
            </div>
          )}

          {syncResult && (
            <div className="mt-2 space-y-2">
              <p className="text-sm font-medium text-gray-700">
                {syncResult.songs_created} song{syncResult.songs_created !== 1 ? "s" : ""} created,{" "}
                {syncResult.songs_skipped} skipped
              </p>
              <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                {syncResult.items.map((item, i) => (
                  <li key={i} className={`flex items-center gap-2 ${item.action === "created" ? "text-green-700" : "text-gray-500"}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.action === "created" ? "bg-green-500" : "bg-gray-300"}`} />
                    <span>{item.name}</span>
                    {item.action === "created" && item.sections != null && (
                      <span className="text-gray-400">({item.sections} section{item.sections !== 1 ? "s" : ""}, {item.detected_lang})</span>
                    )}
                    {item.action === "skipped" && item.reason && (
                      <span className="text-gray-400">— {item.reason.replace(/_/g, " ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
