'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import { Language } from '@/types';
import { translations, type Dictionary } from '@/utils/translations';
import {
  isLanguage,
  languageDirection,
  readLanguageCookie,
  writeLanguageCookie,
} from '@/lib/i18n/language';

type Translations = Dictionary;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isRTL: boolean;
}

const LANGUAGE_KEY = 'raf-language';

const languageListeners = new Set<() => void>();

let currentLanguage: Language | undefined;

/**
 * `?lang=ar` / `?lang=en` (links from search results and the sitemap): the
 * server already rendered that language, so it wins over a saved choice.
 */
function readUrlLanguage(): Language | null {
  try {
    const value = new URLSearchParams(window.location.search).get('lang');
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function readStoredLanguage(fallback: Language): Language {
  const fromUrl = readUrlLanguage();
  if (fromUrl) {
    try {
      localStorage.setItem(LANGUAGE_KEY, fromUrl);
    } catch {
      // The cookie (set by the server for `?lang=`) still carries it.
    }
    return fromUrl;
  }
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage blocked (private mode): use what the server rendered.
  }
  return fallback;
}

function subscribeLanguage(onStoreChange: () => void) {
  languageListeners.add(onStoreChange);
  return () => {
    languageListeners.delete(onStoreChange);
  };
}

function applyDocumentLanguage(lang: Language) {
  document.documentElement.dir = languageDirection(lang);
  document.documentElement.lang = lang;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * `initialLanguage` comes from the `raf-language` cookie read by the root
 * layout, so the server renders the right language and hydration matches.
 * localStorage stays the client's source of truth; the cookie follows it.
 */
export const LanguageProvider = ({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: Language;
}) => {
  const router = useRouter();

  const getSnapshot = useCallback((): Language => {
    if (currentLanguage === undefined) {
      currentLanguage = readStoredLanguage(initialLanguage);
    }
    return currentLanguage;
  }, [initialLanguage]);
  const getServerSnapshot = useCallback(
    (): Language => initialLanguage,
    [initialLanguage],
  );

  const language = useSyncExternalStore(
    subscribeLanguage,
    getSnapshot,
    getServerSnapshot,
  );

  useLayoutEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  // Visitors from before the cookie existed (or with an old cookie): align the
  // cookie with what they see, and re-render the server parts once.
  useEffect(() => {
    if (readLanguageCookie() !== language) {
      writeLanguageCookie(language);
      router.refresh();
    }
  }, [language, router]);

  const setLanguage = useCallback(
    (lang: Language) => {
      currentLanguage = lang;
      try {
        localStorage.setItem(LANGUAGE_KEY, lang);
      } catch {
        // The cookie below still carries the choice.
      }
      writeLanguageCookie(lang);
      applyDocumentLanguage(lang);
      languageListeners.forEach((listener) => listener());
      // Server components (titles, CMS pages, html lang) read the cookie. On a
      // `?lang=` address, go to the new language's address instead: the server
      // follows `?lang=` over the cookie, so a refresh would stay in the old one.
      const url = new URL(window.location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', lang);
        router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
      } else {
        router.refresh();
      }
    },
    [router],
  );

  const t: Translations = translations[language];
  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
