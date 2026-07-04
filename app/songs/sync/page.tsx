"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Playlist {
  id: string;
  name: string;
}

interface PreviewItem {
  name: string;
  uuid: string;
  action: "add" | "skip";
  reason: string | null;
  detected_lang: string | null;
  slides: string[];
  // user overrides
  user_skip?: boolean;
  user_lang?: string;
  user_name?: string;
}

interface SyncResultItem {
  name: string;
  action: string;
  reason?: string;
  song_id?: number;
  slides?: number;
  translated?: boolean;
}

const LANG_OPTIONS = [
  { value: "es", label: "Spanish" },
  { value: "en", label: "English" },
  { value: "pt", label: "Portuguese" },
];

export default function SyncPage() {
  const router = useRouter();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState("");

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [translateTo, setTranslateTo] = useState("en");

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ songs_created: number; songs_skipped: number; items: SyncResultItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.proPresenterPlaylists()
      .then((data) => {
        const d = data as { playlists: Playlist[] };
        setPlaylists(d.playlists || []);
      })
      .catch(() => setPlaylists([]))
      .finally(() => setPlaylistsLoading(false));
  }, []);

  const handlePreview = async () => {
    if (!selectedPlaylist || isPreviewing) return;
    setIsPreviewing(true);
    setItems(null);
    setSyncResult(null);
    setError(null);
    try {
      const data = await api.previewPropresenterSync(selectedPlaylist) as { items: PreviewItem[] };
      const enriched = data.items.map((item) => ({
        ...item,
        user_skip: item.action === "skip",
        user_lang: item.detected_lang ?? "es",
        user_name: item.name,
      }));
      setItems(enriched);
      // Default translate_to: pick the opposite of the most common detected source lang
      const addItems = enriched.filter((i) => i.action === "add");
      const primaryLang = addItems[0]?.detected_lang ?? "es";
      setTranslateTo(primaryLang === "es" ? "en" : "es");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  };

  const updateItem = (uuid: string, patch: Partial<PreviewItem>) => {
    setItems((prev) => prev?.map((i) => (i.uuid === uuid ? { ...i, ...patch } : i)) ?? null);
  };

  const toAddCount = items?.filter((i) => i.action === "add" && !i.user_skip).length ?? 0;

  const handleSync = async () => {
    if (!items || isSyncing) return;
    setIsSyncing(true);
    setError(null);
    try {
      const payload = {
        playlist_id: selectedPlaylist,
        translate_to: translateTo,
        items: items
          .filter((i) => i.action === "add")
          .map((i) => ({
            uuid: i.uuid,
            name: i.user_name ?? i.name,
            detected_lang: i.user_lang ?? i.detected_lang ?? "es",
            skip: i.user_skip ?? false,
          })),
      };
      const result = await api.syncPropresenterPlaylist(payload) as typeof syncResult;
      setSyncResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/songs" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Songs
        </Link>
        <h1 className="text-2xl font-bold">Sync from ProPresenter</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step 1: Pick playlist */}
      <div className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-semibold text-black">1. Select a playlist</h2>
        {playlistsLoading ? (
          <p className="text-sm text-gray-500">Loading playlists…</p>
        ) : playlists.length === 0 ? (
          <p className="text-sm text-gray-500">No playlists found. Make sure the bridge app is running.</p>
        ) : (
          <div className="flex items-center gap-3">
            <select
              value={selectedPlaylist}
              onChange={(e) => { setSelectedPlaylist(e.target.value); setItems(null); setSyncResult(null); }}
              className="border rounded px-3 py-2 text-sm text-gray-900 flex-1 max-w-sm"
            >
              <option value="">— Select a playlist —</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handlePreview}
              disabled={!selectedPlaylist || isPreviewing}
              className="bg-purple-600 text-white px-4 py-2 rounded font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPreviewing ? "Loading…" : "Preview"}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Review table */}
      {items && !syncResult && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-black">2. Review & confirm</h2>
            <div className="flex items-center gap-2 text-sm text-black">
              <span>Translate to:</span>
              <select
                value={translateTo}
                onChange={(e) => setTranslateTo(e.target.value)}
                className="border rounded px-2 py-1 text-sm text-gray-900"
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Source lang</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Slides</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const isSkipped = item.action === "skip" || item.user_skip;
                return (
                  <tr key={item.uuid} className={isSkipped ? "opacity-40" : ""}>
                    <td className="px-4 py-3 text-gray-900">
                      {item.action === "add" && !item.user_skip ? (
                        <input
                          value={item.user_name ?? item.name}
                          onChange={(e) => updateItem(item.uuid, { user_name: e.target.value })}
                          className="border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-purple-500 w-full text-gray-900"
                        />
                      ) : (
                        <span>{item.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.action === "add" ? (
                        <select
                          value={item.user_lang ?? item.detected_lang ?? "es"}
                          onChange={(e) => updateItem(item.uuid, { user_lang: e.target.value })}
                          disabled={item.user_skip}
                          className="border rounded px-2 py-1 text-xs text-gray-900 disabled:opacity-50"
                        >
                          {LANG_OPTIONS.map((l) => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {item.slides.length > 0 ? item.slides.length : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.action === "add" ? (
                        <button
                          onClick={() => updateItem(item.uuid, { user_skip: !item.user_skip })}
                          className={`px-3 py-1 rounded text-xs font-semibold border transition ${
                            item.user_skip
                              ? "border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600"
                              : "border-purple-500 text-purple-700 hover:bg-purple-50"
                          }`}
                        >
                          {item.user_skip ? "Add" : "Skip"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {item.reason === "already_exists" ? "Already exists" : item.reason === "not_a_song" ? "Not a song" : item.reason?.replace(/_/g, " ")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSync}
              disabled={toAddCount === 0 || isSyncing}
              className="bg-purple-600 text-white px-5 py-2 rounded font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? "Syncing…" : `Sync ${toAddCount} song${toAddCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {syncResult && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-black">Done</h2>
          <p className="text-sm text-black">
            {syncResult.songs_created} song{syncResult.songs_created !== 1 ? "s" : ""} created,{" "}
            {syncResult.songs_skipped} skipped.
          </p>
          <ul className="text-sm space-y-1">
            {syncResult.items.map((item, i) => (
              <li key={i} className={`flex items-center gap-2 ${item.action === "created" ? "text-green-700" : "text-gray-400"}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.action === "created" ? "bg-green-500" : "bg-gray-300"}`} />
                <span>{item.name}</span>
                {item.action === "created" && (
                  <span className="text-gray-400 text-xs">
                    ({item.slides} slide{item.slides !== 1 ? "s" : ""}
                    {item.translated ? ", translated" : ""})
                  </span>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={() => router.push("/songs")}
            className="bg-purple-600 text-white px-4 py-2 rounded font-semibold hover:bg-purple-700 text-sm"
          >
            Back to Songs
          </button>
        </div>
      )}
    </div>
  );
}
