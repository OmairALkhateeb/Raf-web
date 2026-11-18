import 'server-only';

import { cache } from 'react';
import type { PublicBrandDetailResponse, PublicBrandDto } from '@/types/api/brand';
import type { PublicProductDto } from '@/types/api/product';
import type { LaravelPaginated } from '@/types/api/pagination';
import {
  BRAND_DIRECTORY_PER_PAGE,
  toBrandDirectoryLaravelQuery,
  type BrandDirectoryQuery,
} from '@/lib/brands/params';
import { CATALOG_PER_PAGE } from '@/lib/catalog/params';
import { ApiError, apiGet, isTransportFailure } from './http';
import type { CatalogProductPage } from './catalog';

export type BrandDetailFetchResult =
  | { status: 'ok'; data: PublicBrandDto }
  | { status: 'not-found' }
  | { status: 'unavailable' };

const BRAND_DETAIL_REVALIDATE_SECONDS = 300;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * GET /api/public/brands/{slug}
 *
 * Wrapped in React `cache()` so `generateMetadata` and the page share one
 * Laravel hit. `apiGet` passes a timeout signal, which opts the fetch out of
 * Next.js request memoization.
 */
async function loadBrandDetail(slug: string): Promise<BrandDetailFetchResult> {
  try {
    const payload = await apiGet<PublicBrandDetailResponse>(
      `/public/brands/${encodeURIComponent(slug)}`,
      { revalidate: BRAND_DETAIL_REVALIDATE_SECONDS, tags: ['brands'] },
    );
    if (!payload?.data) return { status: 'unavailable' };
    return { status: 'ok', data: payload.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: 'not-found' };
    }
    if (!isTransportFailure(error)) throw error;
    console.error('[brand] failed to load /api/public/brands/{slug}', error);
    return { status: 'unavailable' };
  }
}

export const fetchBrandDetail = cache(loadBrandDetail);

export interface BrandDirectoryPage {
  data: PublicBrandDto[];
  meta: LaravelPaginated<PublicBrandDto>['meta'];
}

/**
 * GET /api/public/brands — uncached paginated directory.
 * Call only with a validated `BrandDirectoryQuery`. Does not replace
 * `fetchBrands()` lookups used by the header and product catalog.
 */
export async function fetchBrandDirectory(
  query: BrandDirectoryQuery,
): Promise<BrandDirectoryPage | null> {
  const queryString = toBrandDirectoryLaravelQuery(query);
  const path = `/public/brands?${queryString}`;

  try {
    const payload = await apiGet<LaravelPaginated<PublicBrandDto>>(path, {
      cache: 'no-store',
    });
    return {
      data: asArray<PublicBrandDto>(payload?.data),
      meta: {
        current_page: payload?.meta?.current_page ?? 1,
        from: payload?.meta?.from ?? null,
        last_page: payload?.meta?.last_page ?? 1,
        links: payload?.meta?.links,
        path: payload?.meta?.path ?? '',
        per_page: payload?.meta?.per_page ?? BRAND_DIRECTORY_PER_PAGE,
        to: payload?.meta?.to ?? null,
        total: payload?.meta?.total ?? 0,
      },
    };
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[brand] failed to load /api/public/brands directory', error);
    return null;
  }
}

/**
 * GET /api/public/brands/{slug}/products — uncached.
 * Call only after the brand detail fetch succeeded.
 */
export async function fetchBrandProducts(
  slug: string,
  page: number,
): Promise<CatalogProductPage | null> {
  const params = new URLSearchParams();
  params.set('per_page', String(CATALOG_PER_PAGE));
  params.set('page', String(page));
  const path = `/public/brands/${encodeURIComponent(slug)}/products?${params.toString()}`;

  try {
    const payload = await apiGet<LaravelPaginated<PublicProductDto>>(path, { cache: 'no-store' });
    return {
      data: asArray<PublicProductDto>(payload?.data),
      meta: {
        current_page: payload?.meta?.current_page ?? 1,
        from: payload?.meta?.from ?? null,
        last_page: payload?.meta?.last_page ?? 1,
        links: payload?.meta?.links,
        path: payload?.meta?.path ?? '',
        per_page: payload?.meta?.per_page ?? CATALOG_PER_PAGE,
        to: payload?.meta?.to ?? null,
        total: payload?.meta?.total ?? 0,
      },
    };
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[brand] failed to load /api/public/brands/{slug}/products', error);
    return null;
  }
}
