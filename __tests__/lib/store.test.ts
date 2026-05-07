import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, mapBackendSession, type BackendSession } from '@/lib/store';

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useStore.setState({
      sessions: [],
      songs: [],
    });
  });

  describe('mapBackendSession', () => {
    it('maps snake_case backend fields to camelCase', () => {
      const backend: BackendSession = {
        id: 'test-1',
        church_id: 1,
        name: 'Sunday Service',
        status: 'active',
        qr_code_data: 'qr-data-123',
        started_at: '2025-01-01T10:00:00Z',
        source_language: 'es',
        target_language: 'en',
      };

      const result = mapBackendSession(backend);

      expect(result.id).toBe('test-1');
      expect(result.name).toBe('Sunday Service');
      expect(result.status).toBe('active');
      expect(result.startedAt).toBe('2025-01-01T10:00:00Z');
      expect(result.qrCodeData).toBe('qr-data-123');
      expect(result.sourceLanguage).toBe('es');
      expect(result.targetLanguage).toBe('en');
      expect(result.connectedUsers).toBe(0);
      expect(result.translationCount).toBe(0);
    });

    it('includes deviceId when provided', () => {
      const backend: BackendSession = {
        id: 'test-1',
        church_id: 1,
        name: 'Test',
        status: 'active',
        qr_code_data: '',
        started_at: '2025-01-01T10:00:00Z',
      };

      const result = mapBackendSession(backend, 'device-abc');
      expect(result.deviceId).toBe('device-abc');
    });

    it('defaults source language to es and target to en', () => {
      const backend: BackendSession = {
        id: 'test-1',
        church_id: 1,
        name: 'Test',
        status: 'active',
        qr_code_data: '',
        started_at: '2025-01-01T10:00:00Z',
      };

      const result = mapBackendSession(backend);
      expect(result.sourceLanguage).toBe('es');
      expect(result.targetLanguage).toBe('en');
    });

    it('converts null ended_at to undefined', () => {
      const backend: BackendSession = {
        id: 'test-1',
        church_id: 1,
        name: 'Test',
        status: 'ended',
        qr_code_data: '',
        started_at: '2025-01-01T10:00:00Z',
        ended_at: null,
      };

      const result = mapBackendSession(backend);
      expect(result.endedAt).toBeUndefined();
    });
  });

  describe('sessions', () => {
    const mockSession = {
      id: 'sess-1',
      name: 'Test Session',
      status: 'active' as const,
      startedAt: '2025-01-01T10:00:00Z',
      connectedUsers: 0,
      translationCount: 0,
    };

    it('starts with empty sessions', () => {
      expect(useStore.getState().sessions).toEqual([]);
    });

    it('addSession prepends to the array', () => {
      const session1 = { ...mockSession, id: 'sess-1' };
      const session2 = { ...mockSession, id: 'sess-2' };

      useStore.getState().addSession(session1);
      useStore.getState().addSession(session2);

      const sessions = useStore.getState().sessions;
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('sess-2');
      expect(sessions[1].id).toBe('sess-1');
    });

    it('updateSession merges partial updates', () => {
      useStore.getState().addSession(mockSession);
      useStore.getState().updateSession('sess-1', { name: 'Updated Name', connectedUsers: 5 });

      const session = useStore.getState().sessions[0];
      expect(session.name).toBe('Updated Name');
      expect(session.connectedUsers).toBe(5);
      expect(session.status).toBe('active');
    });

    it('updateSession does not affect other sessions', () => {
      useStore.getState().addSession({ ...mockSession, id: 'sess-1' });
      useStore.getState().addSession({ ...mockSession, id: 'sess-2', name: 'Other' });

      useStore.getState().updateSession('sess-1', { name: 'Changed' });

      const sessions = useStore.getState().sessions;
      expect(sessions.find((s) => s.id === 'sess-1')?.name).toBe('Changed');
      expect(sessions.find((s) => s.id === 'sess-2')?.name).toBe('Other');
    });

    it('setSessions replaces the entire array', () => {
      useStore.getState().addSession(mockSession);
      const newSessions = [
        { ...mockSession, id: 'new-1' },
        { ...mockSession, id: 'new-2' },
      ];

      useStore.getState().setSessions(newSessions);

      const sessions = useStore.getState().sessions;
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('new-1');
    });
  });

  describe('addTranslation', () => {
    it('prepends translation to session', () => {
      useStore.getState().addSession({
        id: 'sess-1',
        name: 'Test',
        status: 'active',
        startedAt: '2025-01-01T10:00:00Z',
        connectedUsers: 0,
        translationCount: 0,
      });

      useStore.getState().addTranslation('sess-1', {
        type: 'translation',
        source_text: 'Hola',
        target_text: 'Hello',
      });

      const session = useStore.getState().sessions[0];
      expect(session.translations).toHaveLength(1);
      expect(session.translations![0].source_text).toBe('Hola');
    });

    it('caps translations at 100', () => {
      useStore.getState().addSession({
        id: 'sess-1',
        name: 'Test',
        status: 'active',
        startedAt: '2025-01-01T10:00:00Z',
        connectedUsers: 0,
        translationCount: 0,
      });

      // Add 105 translations
      for (let i = 0; i < 105; i++) {
        useStore.getState().addTranslation('sess-1', {
          type: 'translation',
          source_text: `Text ${i}`,
        });
      }

      const session = useStore.getState().sessions[0];
      expect(session.translations).toHaveLength(100);
      // Most recent should be first
      expect(session.translations![0].source_text).toBe('Text 104');
    });
  });

  describe('setActiveSong', () => {
    it('sets active song on a session', () => {
      useStore.getState().addSession({
        id: 'sess-1',
        name: 'Test',
        status: 'active',
        startedAt: '2025-01-01T10:00:00Z',
        connectedUsers: 0,
        translationCount: 0,
      });

      useStore.getState().setActiveSong('sess-1', {
        song_id: 'song-1',
        song_titles: { es: 'Cuán Grande Es Él', en: 'How Great Thou Art' },
        source_lang: 'es',
        target_lang: 'en',
        sections: [
          { section_number: 1, section_name: 'Verse 1', texts: { es: 'Señor mi Dios...', en: 'O Lord my God...' } },
        ],
      });

      const session = useStore.getState().sessions[0];
      expect(session.activeSong?.song_id).toBe('song-1');
      expect(session.activeSong?.sections).toHaveLength(1);
    });

    it('clears active song when passed null', () => {
      useStore.getState().addSession({
        id: 'sess-1',
        name: 'Test',
        status: 'active',
        startedAt: '2025-01-01T10:00:00Z',
        connectedUsers: 0,
        translationCount: 0,
      });

      useStore.getState().setActiveSong('sess-1', {
        song_id: 'song-1',
        song_titles: { es: 'Test', en: 'Test' },
        source_lang: 'es',
        target_lang: 'en',
        sections: [],
      });

      useStore.getState().setActiveSong('sess-1', null);

      const session = useStore.getState().sessions[0];
      expect(session.activeSong).toBeUndefined();
    });
  });

  describe('songs', () => {
    it('starts with empty songs', () => {
      expect(useStore.getState().songs).toEqual([]);
    });

    it('addSong appends to array', () => {
      useStore.getState().addSong({
        id: 'song-1',
        titleEs: 'Test',
        titleEn: 'Test',
        lyricsEs: 'lyrics',
        lyricsEn: 'lyrics',
      });

      expect(useStore.getState().songs).toHaveLength(1);
      expect(useStore.getState().songs[0].id).toBe('song-1');
    });

    it('deleteSong removes by id', () => {
      useStore.getState().addSong({
        id: 'song-1',
        titleEs: 'A',
        titleEn: 'A',
        lyricsEs: '',
        lyricsEn: '',
      });
      useStore.getState().addSong({
        id: 'song-2',
        titleEs: 'B',
        titleEn: 'B',
        lyricsEs: '',
        lyricsEn: '',
      });

      useStore.getState().deleteSong('song-1');

      const songs = useStore.getState().songs;
      expect(songs).toHaveLength(1);
      expect(songs[0].id).toBe('song-2');
    });
  });
});
