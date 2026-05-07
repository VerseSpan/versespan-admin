import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGES,
  getLangName,
} from '@/lib/languages';

describe('languages', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('contains es, en, pt', () => {
      expect(SUPPORTED_LANGUAGES).toHaveProperty('es', 'Spanish');
      expect(SUPPORTED_LANGUAGES).toHaveProperty('en', 'English');
      expect(SUPPORTED_LANGUAGES).toHaveProperty('pt', 'Portuguese');
    });

    it('is a plain object with string values', () => {
      for (const [code, name] of Object.entries(SUPPORTED_LANGUAGES)) {
        expect(typeof code).toBe('string');
        expect(typeof name).toBe('string');
      }
    });
  });

  describe('SUPPORTED_LANGUAGE_CODES', () => {
    it('contains es, en, pt', () => {
      expect(SUPPORTED_LANGUAGE_CODES).toContain('es');
      expect(SUPPORTED_LANGUAGE_CODES).toContain('en');
      expect(SUPPORTED_LANGUAGE_CODES).toContain('pt');
    });

    it('matches keys of SUPPORTED_LANGUAGES', () => {
      expect(SUPPORTED_LANGUAGE_CODES).toEqual(Object.keys(SUPPORTED_LANGUAGES));
    });
  });

  describe('DEFAULT_LANGUAGES', () => {
    it('defaults to es and en', () => {
      expect(DEFAULT_LANGUAGES).toContain('es');
      expect(DEFAULT_LANGUAGES).toContain('en');
    });

    it('has exactly two entries', () => {
      expect(DEFAULT_LANGUAGES).toHaveLength(2);
    });
  });

  describe('getLangName', () => {
    it('returns Spanish for es', () => {
      expect(getLangName('es')).toBe('Spanish');
    });

    it('returns English for en', () => {
      expect(getLangName('en')).toBe('English');
    });

    it('returns Portuguese for pt', () => {
      expect(getLangName('pt')).toBe('Portuguese');
    });

    it('falls back to the code itself for unknown codes', () => {
      expect(getLangName('fr')).toBe('fr');
      expect(getLangName('zh')).toBe('zh');
    });
  });
});
