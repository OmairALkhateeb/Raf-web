import 'server-only';

import { cache } from 'react';
import type { PublicMerchantDto, PublicMerchantResponse } from '@/types/api/merchant';
import type { PublicProductDto } from '@/types/api/product';
import type { LaravelPaginated } from '@/types/api/pagination';
import { CATALOG_PER_PAGE, type CatalogSort } from '@/lib/catalog/params';
import { ApiError, apiGet, isTransportFailure } from './http';
import type { CatalogProductPage } from './catalog';

export type MerchantDetailFetchResult =
  | { status: 'ok'; data: PublicMerchantDto }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/** Short: the vendor can change the logo/description at any time. */
const MERCHANT_DETAIL_REVALIDATE_SECONDS = 60;

/**
 * GET /api/public/merchants/{slug} (`{slug}` may also be the numeric id).
 * 404 for unknown, pending, suspended or rejected merchants.
 *
 * Wrapped in React `cache()` so `generateMetadata` and the page share one
 * Laravel hit.
 */
async function loadMerchantDetail(slug: string): Promise<MerchantDetailFetchResult> {
  try {
    const payload = await apiGet<PublicMerchantResponse>(
      `/public/merchants/${encodeURIComponent(slug)}`,
      { revalidate: MERCHANT_DETAIL_REVALIDATE_SECONDS, tags: ['merchants'] },
    );
    if (!payload?.data) return { status: 'unavailable' };
    return { status: 'ok', data: payload.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: 'not-found' };
    }
    if (!isTransportFailure(error)) throw error;
    console.error('[merchant] failed to load /api/public/merchants/{slug}', error);
    return { status: 'unavailable' };
  }
}

export const fetchMerchantDetail = cache(loadMerchantDetail);

export interface MerchantProductsQuery {
  page: number;
  /** Search inside this store. */
  q?: string;
  /** A category tab; the backend includes its sub-categories. */
  categoryId?: number;
  sort?: CatalogSort;
}

/**
 * GET /api/public/merchants/{slug}/products — uncached. Same filters and
 * sorts as /public/products, scoped to the merchant. Call only after the
 * detail fetch succeeded.
 */
export async function fetchMerchantProducts(
  slug: string,
  query: MerchantProductsQuery,
): Promise<CatalogProductPage | null> {
  const params = new URLSearchParams();
  params.set('per_page', String(CATALOG_PER_PAGE));
  params.set('page', String(query.page));
  if (query.q) params.set('q', query.q);
  if (query.categoryId !== undefined) params.set('category_id', String(query.categoryId));
  if (query.sort) params.set('sort', query.sort);
  const path = `/public/merchants/${encodeURIComponent(slug)}/products?${params.toString()}`;

  try {
    const payload = await apiGet<LaravelPaginated<PublicProductDto>>(path, { cache: 'no-store' });
    return {
      data: Array.isArray(payload?.data) ? payload.data : [],
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
    console.error('[merchant] failed to load /api/public/merchants/{slug}/products', error);
    return null;
  }
}
