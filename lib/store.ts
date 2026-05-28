import { create } from 'zustand';

// Backend response format (snake_case)
interface BackendSession {
  id: string;
  church_id: number;
  name: string;
  status: 'active' | 'ended';
  qr_code_data: string;
  started_at: string;
  ended_at?: string | null;
  source_language?: string;
  target_language?: string;
  connected_users?: number;
}

// Song section format
export interface SongSection {
  id?: number;
  section_number: number;
  section_name: string;
  texts: Record<string, string>;
}

// Translation message format
export interface TranslationMessage {
  type: 'translation' | 'status' | 'error' | 'pong' | 'song_started' | 'song_ended' | 'viewer_count' | 'connected_users' | 'presenting' | 'presenting_cleared' | 'server_restart';
  content_type?: 'speech' | 'scripture' | 'song';
  source_text?: string;
  target_text?: string;
  confidence?: number;
  timestamp?: string;
  message?: string;
  session_id?: string;
  active_clients?: number;
  count?: number;
  error?: string;
  severity?: 'warning' | 'error';
  // Song-specific fields
  song_id?: string;
  song_titles?: Record<string, string>;
  source_lang?: string;
  target_lang?: string;
  sections?: SongSection[];
  reason?: string;
}

// Active song data
export interface ActiveSong {
  song_id: string;
  song_titles: Record<string, string>;
  source_lang: string;
  target_lang: string;
  sections: SongSection[];
}

// Frontend format (camelCase)
interface Session {
  id: string;
  name: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt?: string;
  connectedUsers: number;
  translationCount: number;
  deviceId?: string; // Frontend-only field for audio device
  qrCodeData?: string; // From backend
  translations?: TranslationMessage[]; // Store translations for this session
  activeSong?: ActiveSong; // Current song being displayed
}

// Helper to map backend response to frontend format
export function mapBackendSession(backendSession: BackendSession, deviceId?: string): Session {
  return {
    id: backendSession.id,
    name: backendSession.name,
    status: backendSession.status,
    startedAt: backendSession.started_at,
    endedAt: backendSession.ended_at || undefined,
    connectedUsers: backendSession.connected_users ?? 0,
    translationCount: 0, // Not provided by backend yet
    sourceLanguage: backendSession.source_language || 'es',
    targetLanguage: backendSession.target_language || 'en',
    qrCodeData: backendSession.qr_code_data,
    deviceId,
  };
}

// Export types for use in components
export type { Session, BackendSession };

interface Song {
  id: string;
  titleEs: string;
  titleEn: string;
  lyricsEs: string;
  lyricsEn: string;
}

interface Store {
  // Sessions
  sessions: Session[];
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  setSessions: (sessions: Session[]) => void;
  addTranslation: (sessionId: string, translation: TranslationMessage) => void;
  setTranslations: (sessionId: string, translations: TranslationMessage[]) => void;
  setActiveSong: (sessionId: string, song: ActiveSong | null) => void;

  // Songs
  songs: Song[];
  addSong: (song: Song) => void;
  deleteSong: (id: string) => void;
}

export const useStore = create<Store>((set: (partial: Partial<Store> | ((state: Store) => Partial<Store>)) => void) => ({
  sessions: [],

  addSession: (session: Session) =>
    set((state: Store) => ({ sessions: [session, ...state.sessions] })),

  updateSession: (id: string, updates: Partial<Session>) =>
    set((state: Store) => ({
      sessions: state.sessions.map((s: Session) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  setSessions: (sessions: Session[]) =>
    set({ sessions }),

  addTranslation: (sessionId: string, translation: TranslationMessage) =>
    set((state: Store) => ({
      sessions: state.sessions.map((s: Session) =>
        s.id === sessionId
          ? {
              ...s,
              translations: [translation, ...(s.translations || [])].slice(0, 100), // Keep last 100
              translationCount: (s.translationCount || 0) + 1,
            }
          : s
      ),
    })),

  setTranslations: (sessionId: string, translations: TranslationMessage[]) =>
    set((state: Store) => ({
      sessions: state.sessions.map((s: Session) =>
        s.id === sessionId
          ? { ...s, translations, translationCount: translations.length }
          : s
      ),
    })),

  setActiveSong: (sessionId: string, song: ActiveSong | null) =>
    set((state: Store) => ({
      sessions: state.sessions.map((s: Session) =>
        s.id === sessionId
          ? { ...s, activeSong: song || undefined }
          : s
      ),
    })),

  songs: [],

  addSong: (song: Song) =>
    set((state: Store) => ({ songs: [...state.songs, song] })),

  deleteSong: (id: string) =>
    set((state: Store) => ({ songs: state.songs.filter((s: Song) => s.id !== id) })),
}));
