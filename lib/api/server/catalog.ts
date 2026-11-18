import 'server-only';

import { cache } from 'react';
import type { CategoryDetailResponse, CategoryDto } from '@/types/api/category';
import type { PublicBrandDto } from '@/types/api/brand';
import type { PublicProductDto } from '@/types/api/product';
import type { LaravelCollection, LaravelPaginated } from '@/types/api/pagination';
import { ApiError, apiGet, isTransportFailure } from './http';

const LOOKUP_REVALIDATE_SECONDS = 300;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * GET /api/public/categories
 * Returns `null` on transport failure. An empty `data` array is success.
 */
export async function fetchCategories(): Promise<CategoryDto[] | null> {
  try {
    const payload = await apiGet<LaravelCollection<CategoryDto>>(
      '/public/categories',
      {
        revalidate: LOOKUP_REVALIDATE_SECONDS,
        tags: ['categories'],
      },
    );
    return asArray<CategoryDto>(payload?.data);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[catalog] failed to load /api/public/categories', error);
    return null;
  }
}

export type CategoryDetailFetchResult =
  | { status: 'ok'; data: CategoryDto }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/**
 * GET /api/public/categories/{slug}
 * Active categories only (`active()` + slug). 404 when missing/inactive.
 */
async function loadCategoryDetail(
  slug: string,
): Promise<CategoryDetailFetchResult> {
  try {
    const payload = await apiGet<CategoryDetailResponse>(
      `/public/categories/${encodeURIComponent(slug)}`,
      { revalidate: LOOKUP_REVALIDATE_SECONDS, tags: ['categories'] },
    );
    if (!payload?.data) return { status: 'unavailable' };
    return { status: 'ok', data: payload.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: 'not-found' };
    }
    if (!isTransportFailure(error)) throw error;
    console.error(
      '[catalog] failed to load /api/public/categories/{slug}',
      error,
    );
    return { status: 'unavailable' };
  }
}

export const fetchCategoryDetail = cache(loadCategoryDetail);

/**
 * GET /api/public/brands?per_page=100
 * Returns `null` on transport failure. An empty `data` array is success.
 *
 * Header and product-catalog brand lookups are capped at 100 approved
 * brands. The `/brands` directory uses `fetchBrandDirectory` instead.
 */
export async function fetchBrands(): Promise<PublicBrandDto[] | null> {
  try {
    const payload = await apiGet<LaravelPaginated<PublicBrandDto>>(
      '/public/brands?per_page=100',
      {
        revalidate: LOOKUP_REVALIDATE_SECONDS,
        tags: ['brands'],
      },
    );
    return asArray<PublicBrandDto>(payload?.data);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[catalog] failed to load /api/public/brands', error);
    return null;
  }
}

export interface CatalogProductPage {
  data: PublicProductDto[];
  meta: LaravelPaginated<PublicProductDto>['meta'];
}

function toProductPage(
  payload: LaravelPaginated<PublicProductDto> | null | undefined,
): CatalogProductPage {
  return {
    data: asArray<PublicProductDto>(payload?.data),
    meta: {
      current_page: payload?.meta?.current_page ?? 1,
      from: payload?.meta?.from ?? null,
      last_page: payload?.meta?.last_page ?? 1,
      links: payload?.meta?.links,
      path: payload?.meta?.path ?? '',
      per_page: payload?.meta?.per_page ?? 20,
      to: payload?.meta?.to ?? null,
      total: payload?.meta?.total ?? 0,
    },
  };
}

/**
 * GET /api/public/products — uncached. `query` is already a Laravel query string
 * (no leading `?` required; include it).
 */
export async function fetchProducts(
  queryString: string,
): Promise<CatalogProductPage | null> {
  const path = queryString
    ? `/public/products?${queryString}`
    : '/public/products';
  try {
    const payload = await apiGet<LaravelPaginated<PublicProductDto>>(path, {
      cache: 'no-store',
    });
    return toProductPage(payload);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[catalog] failed to load /api/public/products', error);
    return null;
  }
}

/**
 * GET /api/public/search — aliases ProductController@index (same as products).
 * Query param `q` triggers FULLTEXT; empty/missing `q` returns a filtered listing.
 * A non-empty `q` causes Laravel to write a SearchLog row.
 */
export async function fetchPublicSearch(
  queryString: string,
): Promise<CatalogProductPage | null> {
  const path = queryString ? `/public/search?${queryString}` : '/public/search';
  try {
    const payload = await apiGet<LaravelPaginated<PublicProductDto>>(path, {
      cache: 'no-store',
    });
    return toProductPage(payload);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[catalog] failed to load /api/public/search', error);
    return null;
  }
}
