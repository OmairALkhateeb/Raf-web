import { CATALOG_PER_PAGE } from '@/lib/catalog/params';

export type SearchParseResult =
  | { ok: true; q: string; page: number }
  | { ok: false; reason: 'invalid' };

type SearchParams = Record<string, string | string[] | undefined>;

const SEARCH_KEYS = new Set(['q', 'page']);
const TRACKING_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
]);

function scalar(
  value: string | string[] | undefined,
): string | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return 'invalid';
  return value;
}

/**
 * Laravel accepts missing/empty `q` (returns a catalog listing).
 * Storefront keeps `q` as the URL param for `/search`.
 */
export function parseSearchPageParams(params: SearchParams): SearchParseResult {
  for (const key of Object.keys(params)) {
    if (SEARCH_KEYS.has(key) || TRACKING_KEYS.has(key)) continue;
    return { ok: false, reason: 'invalid' };
  }

  const qRaw = scalar(params.q);
  if (qRaw === 'invalid') return { ok: false, reason: 'invalid' };
  const q = (qRaw ?? '').trim();

  const pageRaw = scalar(params.page);
  if (pageRaw === 'invalid') return { ok: false, reason: 'invalid' };
  let page = 1;
  if (pageRaw !== undefined && pageRaw !== '') {
    if (!/^[1-9]\d*$/.test(pageRaw)) return { ok: false, reason: 'invalid' };
    page = Number(pageRaw);
    if (!Number.isSafeInteger(page)) return { ok: false, reason: 'invalid' };
  }

  return { ok: true, q, page };
}

export function searchPageHref(q: string, page = 1): string {
  const sp = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) sp.set('q', trimmed);
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `/search?${qs}` : '/search';
}

/** Build Laravel `/public/search` query string. */
export function toPublicSearchQueryString(q: string, page: number): string {
  const sp = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) sp.set('q', trimmed);
  sp.set('per_page', String(CATALOG_PER_PAGE));
  sp.set('page', String(page > 0 ? page : 1));
  sp.set('sort', 'newest');
  return sp.toString();
}
