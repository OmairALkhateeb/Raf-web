import { isSupportedCountry } from 'libphonenumber-js/min';
import { TRACKING_PARAM_KEYS, pickTrackingParams } from '@/lib/catalog/params';

export { pickTrackingParams };

export const BRAND_DIRECTORY_PER_PAGE = 20;

export const BRAND_DIRECTORY_SORTS = [
  'name',
  '-name',
  'products_count',
  '-products_count',
] as const;

export type BrandDirectorySort = (typeof BRAND_DIRECTORY_SORTS)[number];

const BRAND_DIRECTORY_PARAM_KEYS = ['name', 'country', 'sort', 'page'] as const;
const BRAND_DIRECTORY_KEY_SET = new Set<string>(BRAND_DIRECTORY_PARAM_KEYS);
const BRAND_DIRECTORY_SORT_SET = new Set<string>(BRAND_DIRECTORY_SORTS);

const BRAND_STORE_PARAM_KEYS = ['page'] as const;
const BRAND_STORE_KEY_SET = new Set<string>(BRAND_STORE_PARAM_KEYS);
const TRACKING_KEY_SET = new Set<string>(TRACKING_PARAM_KEYS);

export type BrandStoreParseResult = { ok: true; page: number } | { ok: false };

type SearchParams = Record<string, string | string[] | undefined>;

function scalar(value: string | string[] | undefined): string | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return 'invalid';
  return value;
}

function parsePage(raw: string): number | 'invalid' {
  if (!/^[1-9]\d*$/.test(raw)) return 'invalid';
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : 'invalid';
}

/**
 * Validate Next.js `searchParams` for `/brands/[slug]`.
 * Allowlist: `page` plus the catalog tracking keys. Unsupported keys fail closed.
 *
 * Page rules match the catalog parser: missing or empty `page` → 1;
 * `page=0`, negative, decimal, array, or non-numeric → invalid.
 * Tracking arrays use `pickTrackingParams` (first value), not this parser's
 * fail-closed array rule.
 */
export function parseBrandStoreSearchParams(params: SearchParams): BrandStoreParseResult {
  for (const key of Object.keys(params)) {
    if (BRAND_STORE_KEY_SET.has(key) || TRACKING_KEY_SET.has(key)) continue;
    return { ok: false };
  }

  const pageValue = scalar(params.page);
  if (pageValue === 'invalid') return { ok: false };

  let page = 1;
  if (pageValue !== undefined && pageValue !== '') {
    const n = parsePage(pageValue);
    if (n === 'invalid') return { ok: false };
    page = n;
  }

  return { ok: true, page };
}

export interface BrandDirectoryQuery {
  name?: string;
  country?: string;
  sort?: BrandDirectorySort;
  page: number;
}

export const DEFAULT_BRAND_DIRECTORY_QUERY: BrandDirectoryQuery = {
  page: 1,
};

export type BrandDirectoryParseResult =
  | { ok: true; query: BrandDirectoryQuery }
  | { ok: false };

function parseDirectoryCountry(raw: string): string | 'invalid' {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return 'invalid';
  return isSupportedCountry(code) ? code : 'invalid';
}

/**
 * Validate Next.js `searchParams` for `/brands`.
 * Allowlist: `name`, `country`, `sort`, `page`, plus catalog tracking keys.
 * Unsupported keys, invalid page, invalid country, and unsupported sort fail closed.
 */
export function parseBrandDirectorySearchParams(
  params: SearchParams,
): BrandDirectoryParseResult {
  for (const key of Object.keys(params)) {
    if (BRAND_DIRECTORY_KEY_SET.has(key) || TRACKING_KEY_SET.has(key)) continue;
    return { ok: false };
  }

  const read = (key: (typeof BRAND_DIRECTORY_PARAM_KEYS)[number]) =>
    scalar(params[key]);

  for (const key of BRAND_DIRECTORY_PARAM_KEYS) {
    if (read(key) === 'invalid') return { ok: false };
  }

  const name = (read('name') as string | undefined)?.trim() || undefined;

  const countryRaw = read('country') as string | undefined;
  let country: string | undefined;
  if (countryRaw !== undefined && countryRaw !== '') {
    const parsedCountry = parseDirectoryCountry(countryRaw);
    if (parsedCountry === 'invalid') return { ok: false };
    country = parsedCountry;
  }

  const sortRaw = (read('sort') as string | undefined)?.trim();
  let sort: BrandDirectorySort | undefined;
  if (sortRaw) {
    if (!BRAND_DIRECTORY_SORT_SET.has(sortRaw)) return { ok: false };
    sort = sortRaw as BrandDirectorySort;
  }

  const pageRaw = read('page') as string | undefined;
  let page = 1;
  if (pageRaw !== undefined && pageRaw !== '') {
    const n = parsePage(pageRaw);
    if (n === 'invalid') return { ok: false };
    page = n;
  }

  return { ok: true, query: { name, country, sort, page } };
}

export type BrandDirectoryHrefOverrides = Partial<BrandDirectoryQuery>;

export function brandDirectoryHref(
  query: BrandDirectoryQuery,
  tracking?: URLSearchParams,
  overrides: BrandDirectoryHrefOverrides = {},
): string {
  const merged: BrandDirectoryQuery = {
    ...query,
    ...overrides,
  };

  const sp = new URLSearchParams();
  if (merged.name) sp.set('name', merged.name);
  if (merged.country) sp.set('country', merged.country);
  if (merged.sort) sp.set('sort', merged.sort);
  const page = merged.page ?? 1;
  if (page > 1) sp.set('page', String(page));

  tracking?.forEach((value, key) => {
    if (!sp.has(key)) sp.set(key, value);
  });

  const qs = sp.toString();
  return qs ? `/brands?${qs}` : '/brands';
}

/** Filters/sort change: drop page. Pagination: keep page. */
export function brandDirectoryHrefResetPage(
  query: BrandDirectoryQuery,
  tracking: URLSearchParams | undefined,
  overrides: BrandDirectoryHrefOverrides,
): string {
  return brandDirectoryHref(query, tracking, { ...overrides, page: 1 });
}

export function toBrandDirectoryLaravelQuery(query: BrandDirectoryQuery): string {
  const sp = new URLSearchParams();
  if (query.name) sp.set('filter[name]', query.name);
  if (query.country) sp.set('filter[country]', query.country);
  if (query.sort) sp.set('sort', query.sort);
  sp.set('page', String(query.page));
  sp.set('per_page', String(BRAND_DIRECTORY_PER_PAGE));
  return sp.toString();
}

export function hasActiveBrandDirectoryFilters(
  query: BrandDirectoryQuery,
): boolean {
  return Boolean(query.name || query.country || query.sort);
}

export function brandStoreHref(
  slug: string,
  page: number,
  tracking?: URLSearchParams,
): string {
  const sp = new URLSearchParams();
  if (page > 1) sp.set('page', String(page));
  tracking?.forEach((value, key) => {
    if (!sp.has(key)) sp.set(key, value);
  });
  const qs = sp.toString();
  return qs ? `/brands/${encodeURIComponent(slug)}?${qs}` : `/brands/${encodeURIComponent(slug)}`;
}
