export const CATALOG_PER_PAGE = 20;

export const CATALOG_SORTS = ['newest', 'price_asc', 'price_desc', 'bestselling', 'rating'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const CATALOG_PARAM_KEYS = [
  'category',
  'brand',
  'search',
  'min_price',
  'max_price',
  'min_rating',
  'in_stock',
  'on_sale',
  'ids',
  'sort',
  'page',
] as const;

export const TRACKING_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
] as const;

/** `attr_<code>=v1,v2` → Laravel `attributes[<code>]=v1,v2` (category pages only). */
const ATTRIBUTE_PARAM = /^attr_([a-z0-9_]{1,64})$/;
const ATTRIBUTE_MAX_VALUES = 20;
const ATTRIBUTE_MAX_VALUE_LENGTH = 100;

/** Selected values per attribute code (`code → values`). */
export type CatalogAttributeQuery = Record<string, string[]>;

const CATALOG_KEY_SET = new Set<string>(CATALOG_PARAM_KEYS);
const TRACKING_KEY_SET = new Set<string>(TRACKING_PARAM_KEYS);
const SORT_SET = new Set<string>(CATALOG_SORTS);

export interface CatalogQuery {
  category?: string;
  /** One brand slug, or several separated by commas (`a,b`): OR (frontend guide B17). */
  brand?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock: boolean;
  /** Only products whose sale is running now (`on_sale=1`, frontend guide B16). */
  onSale: boolean;
  /** An offer's products (`ids=1,2,3`, from a banner). */
  ids?: number[];
  sort: CatalogSort;
  page: number;
  /** Category attribute filters; needs `category`. */
  attributes?: CatalogAttributeQuery;
}

export const DEFAULT_CATALOG_QUERY: CatalogQuery = {
  inStock: false,
  onSale: false,
  sort: 'newest',
  page: 1,
};

export type CatalogParseResult =
  | { ok: true; query: CatalogQuery }
  | { ok: false };

type SearchParams = Record<string, string | string[] | undefined>;

function scalar(value: string | string[] | undefined): string | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return 'invalid';
  return value;
}

function parseNonNegativeNumber(raw: string): number | 'invalid' {
  if (!/^\d+(\.\d+)?$/.test(raw)) return 'invalid';
  const n = Number(raw);
  return Number.isFinite(n) ? n : 'invalid';
}

const BRAND_SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/i;
const MAX_BRANDS = 10;
const MAX_IDS = 50;

/** The selected brand slugs (`brand=a,b`). */
export function brandSlugs(brand: string | undefined): string[] {
  return (brand ?? '').split(',').map((slug) => slug.trim()).filter(Boolean);
}

function parsePage(raw: string): number | 'invalid' {
  if (!/^[1-9]\d*$/.test(raw)) return 'invalid';
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : 'invalid';
}

/**
 * Validate Next.js `searchParams` against the catalog allowlist.
 * Unsupported filter-like keys fail closed (invalid), they are never ignored.
 */
export function parseCatalogSearchParams(params: SearchParams): CatalogParseResult {
  const attributes: CatalogAttributeQuery = {};
  for (const key of Object.keys(params)) {
    if (CATALOG_KEY_SET.has(key) || TRACKING_KEY_SET.has(key)) continue;
    const code = ATTRIBUTE_PARAM.exec(key)?.[1];
    if (!code) return { ok: false };
    const raw = scalar(params[key]);
    if (raw === 'invalid') return { ok: false };
    const values = [
      ...new Set(
        (raw ?? '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    if (
      values.length > ATTRIBUTE_MAX_VALUES ||
      values.some((v) => v.length > ATTRIBUTE_MAX_VALUE_LENGTH)
    ) {
      return { ok: false };
    }
    if (values.length > 0) attributes[code] = values;
  }

  const read = (key: (typeof CATALOG_PARAM_KEYS)[number]) => {
    const value = scalar(params[key]);
    return value;
  };

  for (const key of CATALOG_PARAM_KEYS) {
    if (read(key) === 'invalid') return { ok: false };
  }

  const category = (read('category') as string | undefined)?.trim() || undefined;
  const brandList = [...new Set(brandSlugs(read('brand') as string | undefined))];
  if (brandList.length > MAX_BRANDS || brandList.some((slug) => !BRAND_SLUG.test(slug))) {
    return { ok: false };
  }
  const brand = brandList.length ? brandList.join(',') : undefined;

  const idsRaw = (read('ids') as string | undefined)?.trim();
  let ids: number[] | undefined;
  if (idsRaw) {
    const parts = [...new Set(idsRaw.split(',').map((part) => part.trim()).filter(Boolean))];
    if (parts.length > MAX_IDS || parts.some((part) => !/^[1-9]\d{0,9}$/.test(part))) return { ok: false };
    ids = parts.map(Number);
  }

  const search = (read('search') as string | undefined)?.trim() || undefined;

  const minPriceRaw = read('min_price') as string | undefined;
  const maxPriceRaw = read('max_price') as string | undefined;
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  if (minPriceRaw !== undefined && minPriceRaw !== '') {
    const n = parseNonNegativeNumber(minPriceRaw);
    if (n === 'invalid') return { ok: false };
    minPrice = n;
  }
  if (maxPriceRaw !== undefined && maxPriceRaw !== '') {
    const n = parseNonNegativeNumber(maxPriceRaw);
    if (n === 'invalid') return { ok: false };
    maxPrice = n;
  }
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) return { ok: false };

  const minRatingRaw = read('min_rating') as string | undefined;
  let minRating: number | undefined;
  if (minRatingRaw !== undefined && minRatingRaw !== '') {
    const n = parseNonNegativeNumber(minRatingRaw);
    if (n === 'invalid' || n > 5) return { ok: false };
    minRating = n;
  }

  const inStockRaw = read('in_stock') as string | undefined;
  const inStock = inStockRaw === '1';
  const onSale = (read('on_sale') as string | undefined) === '1';

  const sortRaw = (read('sort') as string | undefined)?.trim();
  let sort: CatalogSort = 'newest';
  if (sortRaw) {
    if (!SORT_SET.has(sortRaw)) return { ok: false };
    sort = sortRaw as CatalogSort;
  }

  const pageRaw = read('page') as string | undefined;
  let page = 1;
  if (pageRaw !== undefined && pageRaw !== '') {
    const n = parsePage(pageRaw);
    if (n === 'invalid') return { ok: false };
    page = n;
  }

  const hasAttributes = Object.keys(attributes).length > 0;
  // Attribute codes belong to a category.
  if (hasAttributes && !category) return { ok: false };

  return {
    ok: true,
    query: {
      category,
      brand,
      search,
      minPrice,
      maxPrice,
      minRating,
      inStock,
      onSale,
      ...(ids ? { ids } : {}),
      sort,
      page,
      ...(hasAttributes ? { attributes } : {}),
    },
  };
}

export function pickTrackingParams(params: SearchParams): URLSearchParams {
  const tracking = new URLSearchParams();
  for (const key of TRACKING_PARAM_KEYS) {
    const value = params[key];
    const scalarValue = Array.isArray(value) ? value[0] : value;
    if (scalarValue) tracking.set(key, scalarValue);
  }
  return tracking;
}

export type CatalogHrefOverrides = Omit<Partial<CatalogQuery>, 'category'> & {
  category?: string | null;
};

export function catalogHref(
  query: CatalogQuery,
  tracking?: URLSearchParams,
  overrides: CatalogHrefOverrides = {},
): string {
  const merged: CatalogQuery = {
    ...query,
    ...overrides,
    category: overrides.category === null ? undefined : (overrides.category ?? query.category),
  };
  // Another category has other attributes: drop the old selection.
  if (!('attributes' in overrides) && merged.category !== query.category) {
    merged.attributes = undefined;
  }

  const sp = new URLSearchParams();
  if (merged.category) sp.set('category', merged.category);
  if (merged.brand) sp.set('brand', merged.brand);
  if (merged.search) sp.set('search', merged.search);
  if (merged.minPrice !== undefined) sp.set('min_price', String(merged.minPrice));
  if (merged.maxPrice !== undefined) sp.set('max_price', String(merged.maxPrice));
  if (merged.minRating !== undefined) sp.set('min_rating', String(merged.minRating));
  if (merged.inStock) sp.set('in_stock', '1');
  if (merged.onSale) sp.set('on_sale', '1');
  if (merged.ids?.length) sp.set('ids', merged.ids.join(','));
  for (const [code, values] of sortedAttributes(merged.attributes)) {
    sp.set(`attr_${code}`, values.join(','));
  }
  if (merged.sort !== 'newest') sp.set('sort', merged.sort);
  if (merged.page > 1) sp.set('page', String(merged.page));

  tracking?.forEach((value, key) => {
    if (!sp.has(key)) sp.set(key, value);
  });

  const qs = sp.toString();
  return qs ? `/products?${qs}` : '/products';
}

/** Filters/sort/search change: drop page. Pagination: keep page. */
export function catalogHrefResetPage(
  query: CatalogQuery,
  tracking: URLSearchParams | undefined,
  overrides: CatalogHrefOverrides,
): string {
  return catalogHref(query, tracking, { ...overrides, page: 1 });
}

export function toLaravelQueryString(
  query: CatalogQuery,
  ids: { categoryId?: number; brandIds?: number[] },
): string {
  const sp = new URLSearchParams();
  if (query.search) sp.set('q', query.search);
  if (ids.categoryId !== undefined) sp.set('category_id', String(ids.categoryId));
  if (ids.brandIds?.length) sp.set('brand_id', ids.brandIds.join(','));
  if (query.onSale) sp.set('on_sale', '1');
  if (query.ids?.length) sp.set('ids', query.ids.join(','));
  if (query.minPrice !== undefined) sp.set('min_price', String(query.minPrice));
  if (query.maxPrice !== undefined) sp.set('max_price', String(query.maxPrice));
  if (query.minRating !== undefined) sp.set('min_rating', String(query.minRating));
  if (query.inStock) sp.set('in_stock', '1');
  for (const [code, values] of sortedAttributes(query.attributes)) {
    sp.set(`attributes[${code}]`, values.join(','));
  }
  sp.set('sort', query.sort);
  sp.set('per_page', String(CATALOG_PER_PAGE));
  sp.set('page', String(query.page));
  return sp.toString();
}

function sortedAttributes(attributes: CatalogAttributeQuery | undefined): [string, string[]][] {
  return Object.entries(attributes ?? {})
    .filter(([, values]) => values.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

/** Toggle one value of one attribute; `undefined` when nothing is left selected. */
export function toggleAttributeValue(
  attributes: CatalogAttributeQuery | undefined,
  code: string,
  value: string,
): CatalogAttributeQuery | undefined {
  const next: CatalogAttributeQuery = { ...(attributes ?? {}) };
  const values = next[code] ?? [];
  const updated = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  if (updated.length > 0) next[code] = updated;
  else delete next[code];
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Every code must be a filterable attribute of the category, and every value
 * one of its options (Laravel answers 422 for unknown codes).
 */
export function attributeQueryMatches(
  attributes: CatalogAttributeQuery | undefined,
  filters: readonly { code: string; options: readonly string[] }[],
): boolean {
  return Object.entries(attributes ?? {}).every(([code, values]) => {
    const filter = filters.find((f) => f.code === code);
    return Boolean(filter) && values.every((v) => filter!.options.includes(v));
  });
}

export function clearFiltersQuery(query: CatalogQuery): CatalogQuery {
  return {
    category: query.category,
    // An offer listing stays an offer listing.
    ...(query.ids ? { ids: query.ids } : {}),
    inStock: false,
    onSale: false,
    sort: 'newest',
    page: 1,
  };
}
