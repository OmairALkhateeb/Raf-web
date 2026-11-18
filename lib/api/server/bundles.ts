import 'server-only';

import type { BundleView } from '@/types';
import type { PublicBundleDto } from '@/types/api/bundle';
import { toBundle, toBundles } from '@/lib/mappers/bundle';
import { ApiError, apiGet, isTransportFailure } from './http';

const BUNDLES_REVALIDATE_SECONDS = 60;

export type BundlesPage = {
  bundles: BundleView[];
  currentPage: number;
  lastPage: number;
  total: number;
};

/** GET /api/public/bundles — active bundles, newest first. `null` on failure. */
export async function fetchBundlesPage(options: {
  page: number;
  perPage: number;
  giftSetsOnly: boolean;
}): Promise<BundlesPage | null> {
  const query = new URLSearchParams({
    page: String(options.page),
    per_page: String(options.perPage),
  });
  if (options.giftSetsOnly) query.set('is_gift_set', '1');
  try {
    const payload = await apiGet<{
      data?: unknown;
      meta?: { current_page?: number; last_page?: number; total?: number };
    }>(`/public/bundles?${query.toString()}`, {
      revalidate: BUNDLES_REVALIDATE_SECONDS,
      tags: ['bundles'],
    });
    return {
      bundles: toBundles(payload?.data),
      currentPage: Number(payload?.meta?.current_page) || options.page,
      lastPage: Number(payload?.meta?.last_page) || 1,
      total: Number(payload?.meta?.total) || 0,
    };
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[bundles] failed to load /api/public/bundles', error);
    return null;
  }
}

export type BundleFetchResult =
  | { status: 'ok'; bundle: BundleView; raw: PublicBundleDto }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/** GET /api/public/bundles/{slug} — 404 for unknown or inactive bundles. */
export async function fetchBundle(slug: string): Promise<BundleFetchResult> {
  try {
    const payload = await apiGet<{ data?: PublicBundleDto }>(
      `/public/bundles/${encodeURIComponent(slug)}`,
      { revalidate: BUNDLES_REVALIDATE_SECONDS, tags: ['bundles'] },
    );
    const bundle = payload?.data ? toBundle(payload.data) : null;
    if (!bundle || !payload?.data) return { status: 'unavailable' };
    return { status: 'ok', bundle, raw: payload.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { status: 'not-found' };
    if (!isTransportFailure(error)) throw error;
    console.error('[bundles] failed to load /api/public/bundles/{slug}', error);
    return { status: 'unavailable' };
  }
}
