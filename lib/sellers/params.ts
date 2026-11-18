import { CATALOG_SORTS, type CatalogSort } from '@/lib/catalog/params';

/** What the seller store page shows, read from its URL: `?category=<id>&q=…&sort=…&page=…`. */
export interface SellerStoreQuery {
  /** A category tab; only ids from the store's own `categories` are kept. */
  categoryId?: number;
  q?: string;
  sort: CatalogSort;
  page: number;
}

export const SELLER_SEARCH_MAX = 100;
const MAX_PAGE = 10_000;

type RawParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads the URL leniently: a bad page, sort or search falls back to its
 * default, and a category the store doesn't sell in falls back to "All".
 */
export function parseSellerStoreParams(raw: RawParams, categoryIds: number[]): SellerStoreQuery {
  const pageText = first(raw.page)?.trim() ?? '';
  const pageNumber = /^\d+$/.test(pageText) ? Number(pageText) : 1;
  const page = pageNumber >= 1 && pageNumber <= MAX_PAGE ? pageNumber : 1;

  const sortText = first(raw.sort);
  const sort = (CATALOG_SORTS as readonly string[]).includes(sortText ?? '')
    ? (sortText as CatalogSort)
    : 'newest';

  const q = first(raw.q)?.trim().slice(0, SELLER_SEARCH_MAX) || undefined;

  const categoryText = first(raw.category)?.trim() ?? '';
  const categoryNumber = /^\d+$/.test(categoryText) ? Number(categoryText) : NaN;
  const categoryId = categoryIds.includes(categoryNumber) ? categoryNumber : undefined;

  return { categoryId, q, sort, page };
}

/** The store page's address for a view; defaults (All, no search, newest, page 1) are left out. */
export function sellerStoreHref(slug: string, query: Partial<SellerStoreQuery> = {}): string {
  const sp = new URLSearchParams();
  if (query.categoryId !== undefined) sp.set('category', String(query.categoryId));
  if (query.q) sp.set('q', query.q);
  if (query.sort && query.sort !== 'newest') sp.set('sort', query.sort);
  if (query.page && query.page > 1) sp.set('page', String(query.page));
  const qs = sp.toString();
  return `/sellers/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`;
}
