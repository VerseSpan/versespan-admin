"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getChurchId } from "@/lib/api";
import { getLangName } from "@/lib/languages";

interface SourceItem {
  id: string;
  name: string;
}

interface Presentation {
  name: string;
  uuid: string;
}

interface Section {
  section_number: number;
  section_name: string;
  texts: Record<string, string>;
}

type Source = "libraries" | "playlists";

export default function ImportFromProPresenterPage() {
  const router = useRouter();
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [churchLanguages, setChurchLanguages] = useState<string[]>(["es", "en"]);
  const [sourceLang, setSourceLang] = useState("es");
  const [targetLang, setTargetLang] = useState("en");
  const [source, setSource] = useState<Source>("libraries");
  const [libraries, setLibraries] = useState<SourceItem[]>([]);
  const [playlists, setPlaylists] = useState<SourceItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [selectedPres, setSelectedPres] = useState<Presentation | null>(null);
  const [title, setTitle] = useState("");
  const [titleTarget, setTitleTarget] = useState("");
  const [sections, setSections] = useState<Section[]>([
    { section_number: 1, section_name: "Verse 1", texts: { es: "" } },
  ]);
  const [fetchingLyrics, setFetchingLyrics] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"browse" | "edit">("browse");

  useEffect(() => {
    api.proPresenterStatus()
      .then((s) => {
        const status = s as { feature_enabled: boolean; bridge_connected: boolean };
        setFeatureEnabled(status.feature_enabled);
        setBridgeConnected(status.bridge_connected);
        if (!status.feature_enabled) router.replace("/songs");
        if (status.bridge_connected) loadLibraries();
      })
      .catch(() => router.replace("/songs"));

    api.getChurchLanguages(getChurchId())
      .then((langs) => {
        setChurchLanguages(langs);
        const src = langs[0] || "es";
        const tgt = langs[1] || "en";
        setSourceLang(src);
        setTargetLang(tgt);
        setSections([{ section_number: 1, section_name: "Verse 1", texts: { [src]: "" } }]);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLibraries() {
    try {
      const data = await api.proPresenterLibraries() as { libraries: SourceItem[] };
      setLibraries(data.libraries || []);
      if (data.libraries?.length === 1) {
        setSelectedId(data.libraries[0].id);
        loadPresentations("libraries", data.libraries[0].id);
      }
    } catch {}
  }

  async function loadPlaylists() {
    try {
      const data = await api.proPresenterPlaylists() as { playlists: SourceItem[] };
      setPlaylists(data.playlists || []);
    } catch {}
  }

  async function loadPresentations(src: Source, id: string) {
    setSelectedId(id);
    setPresentations([]);
    setSelectedPres(null);
    try {
      if (src === "libraries") {
        const data = await api.proPresenterLibrary(id) as { presentations: Presentation[] };
        setPresentations(data.presentations || []);
      } else {
        const data = await api.proPresenterPlaylist(id) as { presentations: Presentation[] };
        setPresentations(data.presentations || []);
      }
    } catch {}
  }

  function switchSource(s: Source) {
    setSource(s);
    setSelectedId("");
    setPresentations([]);
    setSelectedPres(null);
    if (s === "playlists" && playlists.length === 0) {
      loadPlaylists();
    } else if (s === "libraries" && libraries.length === 1) {
      loadPresentations("libraries", libraries[0].id);
    } else if (s === "playlists" && playlists.length === 1) {
      loadPresentations("playlists", playlists[0].id);
    }
  }

  async function selectPresentation(pres: Presentation) {
    setSelectedPres(pres);
    setTitle(pres.name);
    setStep("edit");
  }

  async function fetchLyrics() {
    if (!selectedPres) return;
    setFetchingLyrics(true);
    try {
      const data = await api.proPresenterPresentation(selectedPres.uuid) as { slide_text: string[] };
      const texts: string[] = data.slide_text || [];
      if (texts.length > 0) {
        setSections(texts.map((t, i) => ({
          section_number: i + 1,
          section_name: `Slide ${i + 1}`,
          texts: { [sourceLang]: t },
        })));
      }
    } catch {
      setError("Could not fetch lyrics — paste manually below.");
    } finally {
      setFetchingLyrics(false);
    }
  }

  async function translateLyrics() {
    const toTranslate = sections.filter(s => s.texts[sourceLang]?.trim());
    if (toTranslate.length === 0) return;
    setTranslating(true);
    setError(null);
    try {
      const res = await api.translateLyrics(toTranslate.map(s => s.texts[sourceLang]), sourceLang, targetLang);
      setSections(prev => {
        let idx = 0;
        return prev.map(s => {
          if (!s.texts[sourceLang]?.trim()) return s;
          const translated = res.translations[idx++] || "";
          return { ...s, texts: { ...s.texts, [targetLang]: translated } };
        });
      });
    } catch {
      setError("Translation failed — paste target lyrics manually.");
    } finally {
      setTranslating(false);
    }
  }

  function updateSectionField(i: number, field: "section_number" | "section_name", value: string | number) {
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function updateSectionText(i: number, lang: string, value: string) {
    setSections(prev => prev.map((s, idx) =>
      idx === i ? { ...s, texts: { ...s.texts, [lang]: value } } : s
    ));
  }

  function addSection() {
    setSections(prev => [
      ...prev,
      { section_number: prev.length + 1, section_name: `Section ${prev.length + 1}`, texts: { [sourceLang]: "" } },
    ]);
  }

  function removeSection(i: number) {
    setSections(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, section_number: idx + 1 })));
  }

  async function handleImport() {
    if (!title.trim()) { setError("Title is required"); return; }
    if (sections.every(s => !s.texts[sourceLang]?.trim())) { setError("At least one section needs source lyrics"); return; }
    setImporting(true);
    setError(null);
    try {
      const titles: Record<string, string> = { [sourceLang]: title.trim() };
      if (titleTarget.trim()) titles[targetLang] = titleTarget.trim();

      await api.importSongWithSections({
        church_id: getChurchId(),
        titles,
        sections: sections.filter(s => s.texts[sourceLang]?.trim()).map(s => ({
          section_number: s.section_number,
          section_name: s.section_name,
          texts: Object.fromEntries(Object.entries(s.texts).filter(([, v]) => v.trim())),
        })),
      });
      api.rebuildSongIndex().catch(() => {});
      router.push("/songs");
    } catch (err: unknown) {
      setError((err as Error).message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  // ── Loading / feature check ──────────────────────────────────────────────
  if (featureEnabled === null) {
    return <div className="flex items-center justify-center h-48 text-gray-500">Loading...</div>;
  }

  if (!bridgeConnected) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
        <div className="text-5xl">🔴</div>
        <h2 className="text-xl font-bold text-gray-900">Bridge Not Connected</h2>
        <p className="text-gray-600">
          Start the ProPresenter Bridge app on your ProPresenter computer, then come back.
        </p>
        <a href="/settings" className="inline-block mt-2 text-blue-600 underline text-sm">
          Go to Settings to download the bridge app
        </a>
      </div>
    );
  }

  // ── Browse step ──────────────────────────────────────────────────────────
  const sourceItems = source === "libraries" ? libraries : playlists;
  const emptyHint = selectedId
    ? `No presentations found in this ${source === "libraries" ? "library" : "playlist"}.`
    : `Select a ${source === "libraries" ? "library" : "playlist"} to browse presentations.`;

  if (step === "browse") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Import from ProPresenter</h1>
          <button onClick={() => router.push("/songs")} className="text-gray-500 hover:text-gray-700 text-sm">
            Cancel
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(["libraries", "playlists"] as Source[]).map((s) => (
            <button
              key={s}
              onClick={() => switchSource(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                source === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s === "libraries" ? "Libraries" : "Playlists"}
            </button>
          ))}
        </div>

        {sourceItems.length > 1 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {source === "libraries" ? "Library" : "Playlist"}
            </label>
            <select
              className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={selectedId}
              onChange={e => loadPresentations(source, e.target.value)}
            >
              <option value="">Select a {source === "libraries" ? "library" : "playlist"}...</option>
              {sourceItems.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {presentations.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">{emptyHint}</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Presentation</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {presentations.map(p => (
                  <tr key={p.uuid} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => selectPresentation(p)}
                        className="text-purple-600 hover:text-purple-800 font-semibold text-sm"
                      >
                        Select
                      </button>
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

  // ── Edit / import step ───────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Import Song</h1>
        <div className="flex gap-3">
          <button onClick={() => setStep("browse")} className="text-gray-500 hover:text-gray-700 text-sm">Back</button>
          <button onClick={() => router.push("/songs")} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-5">
        {/* Titles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {getLangName(sourceLang)} Title (source)
            </label>
            <input
              className="border rounded px-3 py-2 text-gray-900 w-full"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`Title in ${getLangName(sourceLang)}`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {getLangName(targetLang)} Title (optional)
            </label>
            <input
              className="border rounded px-3 py-2 text-gray-900 w-full"
              value={titleTarget}
              onChange={e => setTitleTarget(e.target.value)}
              placeholder={`Title in ${getLangName(targetLang)}`}
            />
          </div>
        </div>

        {/* Fetch + Translate buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={fetchLyrics}
            disabled={fetchingLyrics || translating}
            className="px-4 py-1.5 rounded bg-purple-100 text-purple-800 hover:bg-purple-200 font-semibold text-sm disabled:opacity-50 transition"
          >
            {fetchingLyrics ? "Fetching..." : "Fetch from Active Slide"}
          </button>
          <button
            type="button"
            onClick={translateLyrics}
            disabled={translating || fetchingLyrics || sections.every(s => !s.texts[sourceLang]?.trim())}
            className="px-4 py-1.5 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 font-semibold text-sm disabled:opacity-50 transition"
          >
            {translating ? "Translating..." : `Translate to ${getLangName(targetLang)}`}
          </button>
          <span className="text-xs text-gray-400">
            Navigate to the song in ProPresenter first, then Fetch · or paste manually
          </span>
        </div>

        {/* Language direction selector */}
        {churchLanguages.length > 2 && (
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Source language</label>
              <select
                className="border rounded px-2 py-1 text-sm text-gray-900"
                value={sourceLang}
                onChange={e => {
                  setSourceLang(e.target.value);
                  if (targetLang === e.target.value) {
                    setTargetLang(churchLanguages.find(l => l !== e.target.value) || "en");
                  }
                }}
              >
                {churchLanguages.map(l => <option key={l} value={l}>{getLangName(l)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Target language</label>
              <select
                className="border rounded px-2 py-1 text-sm text-gray-900"
                value={targetLang}
                onChange={e => {
                  setTargetLang(e.target.value);
                  if (sourceLang === e.target.value) {
                    setSourceLang(churchLanguages.find(l => l !== e.target.value) || "es");
                  }
                }}
              >
                {churchLanguages.map(l => <option key={l} value={l}>{getLangName(l)}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Sections</h3>
            <button
              type="button"
              onClick={addSection}
              className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
            >
              + Add Section
            </button>
          </div>

          {sections.map((s, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  className="border rounded px-2 py-1 text-sm text-gray-900 w-40"
                  value={s.section_name}
                  onChange={e => updateSectionField(i, "section_name", e.target.value)}
                  placeholder="Section name"
                />
                <span className="text-xs text-gray-400">#{s.section_number}</span>
                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  className="ml-auto text-red-400 hover:text-red-600 text-sm"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {getLangName(sourceLang)} (source)
                  </label>
                  <textarea
                    className="border rounded px-3 py-2 text-sm text-gray-900 w-full h-28 resize-none"
                    value={s.texts[sourceLang] || ""}
                    onChange={e => updateSectionText(i, sourceLang, e.target.value)}
                    placeholder={`Lyrics in ${getLangName(sourceLang)}...`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {getLangName(targetLang)} (translation)
                  </label>
                  <textarea
                    className="border rounded px-3 py-2 text-sm text-gray-900 w-full h-28 resize-none"
                    value={s.texts[targetLang] || ""}
                    onChange={e => updateSectionText(i, targetLang, e.target.value)}
                    placeholder={`Lyrics in ${getLangName(targetLang)}...`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button
            type="button"
            onClick={() => router.push("/songs")}
            className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50 font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="px-6 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 font-semibold text-sm disabled:opacity-50 transition"
          >
            {importing ? "Importing..." : "Import Song"}
          </button>
        </div>
      </div>
    </div>
  );
}
