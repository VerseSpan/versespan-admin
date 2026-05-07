// Canonical language list — must stay in sync with api/languages.py

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

export const SUPPORTED_LANGUAGE_CODES = Object.keys(SUPPORTED_LANGUAGES) as string[];

export function getLangName(code: string): string {
  return SUPPORTED_LANGUAGES[code] || code;
}

/** Default languages when a church hasn't configured anything yet */
export const DEFAULT_LANGUAGES: string[] = ["es", "en"];
