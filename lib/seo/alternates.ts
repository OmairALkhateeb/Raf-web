import type { Language } from '@/types';

/** Set by `proxy.ts`: the requested path and query, for canonical URLs. */
export const PATH_HEADER = 'x-raf-path';

/**
 * The URL parameter that picks the language (`?lang=ar`), so each language has
 * its own address that search engines can index. English has no parameter.
 */
export const LANGUAGE_PARAM = 'lang';

/**
 * Query keys that change what a page lists. Everything else (sort, price,
 * rating, stock, brand filters) points its canonical at the plain page.
 */
const INDEXED_QUERY: Record<string, readonly string[]> = {
  '/products': ['category', 'page'],
  '/bundles': ['page'],
};

function withQuery(pathname: string, query: URLSearchParams): string {
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/** `/x` → `/x?lang=ar` (keeps other parameters). */
export function languagePath(path: string, language: Language): string {
  const url = new URL(path, 'http://store.local');
  url.searchParams.delete(LANGUAGE_PARAM);
  if (language === 'ar') url.searchParams.set(LANGUAGE_PARAM, 'ar');
  return withQuery(url.pathname, url.searchParams);
}

/**
 * Canonical and hreflang paths for the requested URL (relative; the root
 * layout's `metadataBase` makes them absolute).
 */
export function buildAlternates(requestPath: string, language: Language) {
  const url = new URL(requestPath || '/', 'http://store.local');
  const kept = new URLSearchParams();
  for (const key of INDEXED_QUERY[url.pathname] ?? []) {
    const value = url.searchParams.get(key);
    // Page 1 is the plain page.
    if (value && !(key === 'page' && value === '1')) kept.set(key, value);
  }
  const en = withQuery(url.pathname, kept);
  const ar = languagePath(en, 'ar');
  return {
    canonical: language === 'ar' ? ar : en,
    languages: { en, ar, 'x-default': en },
  };
}
