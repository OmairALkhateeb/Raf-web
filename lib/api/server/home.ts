import 'server-only';

import type { HomeResponseDto } from '@/types/api/home';
import { apiGet, isTransportFailure } from './http';

const HOME_REVALIDATE_SECONDS = 60;
const HOME_CACHE_TAG = 'home';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * GET /api/public/home
 *
 * Returns `null` when the backend is unreachable or answers with an error, so
 * the storefront can degrade instead of returning a 500. Unexpected errors —
 * including a missing API_BASE_URL — are deliberately left to propagate.
 */
export async function fetchHomeData(): Promise<HomeResponseDto | null> {
  let payload: HomeResponseDto;

  try {
    payload = await apiGet<HomeResponseDto>('/public/home', {
      revalidate: HOME_REVALIDATE_SECONDS,
      tags: [HOME_CACHE_TAG],
    });
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[home] failed to load /api/public/home', error);
    return null;
  }

  return {
    hero_banners: asArray(payload?.hero_banners),
    featured_categories: asArray(payload?.featured_categories),
    featured_brands: asArray(payload?.featured_brands),
    bestsellers: asArray(payload?.bestsellers),
    pinned_products: asArray(payload?.pinned_products),
    new_arrivals: asArray(payload?.new_arrivals),
    bundles: asArray(payload?.bundles),
  };
}
