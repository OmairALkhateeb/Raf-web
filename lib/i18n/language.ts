import type { Language } from '@/types';

/**
 * The UI language lives in localStorage (instant on the client) and in this
 * cookie (so server components, metadata and `<html lang dir>` can render the
 * right language on the first request). Same name for both.
 */
export const LANGUAGE_COOKIE = 'raf-language';

export const DEFAULT_LANGUAGE: Language = 'en';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ar';
}

export function parseLanguage(value: string | null | undefined): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function languageDirection(language: Language): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/** Client only: remember the language for server rendering. */
export function writeLanguageCookie(language: Language): void {
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/** Client only: the language the server rendered with, if any. */
export function readLanguageCookie(): Language | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LANGUAGE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1];
  return isLanguage(value) ? value : null;
}

/** Pick the Arabic text in Arabic mode when there is one, else the English. */
export function pickLocalized(
  language: Language,
  en: string,
  ar: string | null | undefined,
): string {
  return language === 'ar' && ar ? ar : en;
}
