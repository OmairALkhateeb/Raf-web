import 'server-only';

import { cache } from 'react';
import type { CmsPageKey, CmsPageView, FaqItemView } from '@/types/api/cms';
import { isSafeCmsPageKey } from '@/lib/cms/pageKey';
import { parseCmsPageDto, toCmsPageView, toFaqItems } from '@/lib/mappers/cms';
import { ApiError, apiGet, isTransportFailure } from './http';

export type CmsPageFetchResult =
  | { status: 'ok'; page: CmsPageView }
  | { status: 'not-found' }
  | { status: 'unavailable' };

export type FaqFetchResult =
  | { status: 'ok'; items: FaqItemView[] }
  | { status: 'unavailable' };

const CMS_REVALIDATE_SECONDS = 120;
const FAQ_REVALIDATE_SECONDS = 120;

/**
 * GET /api/public/pages/{key}
 *
 * Wrapped in React `cache()` so `generateMetadata` and the page share one
 * Laravel hit. `apiGet` passes a timeout signal, which opts the fetch out of
 * Next.js request memoization.
 */
async function loadCmsPage(key: string): Promise<CmsPageFetchResult> {
  try {
    const payload = await apiGet<unknown>(
      `/public/pages/${encodeURIComponent(key)}`,
      { revalidate: CMS_REVALIDATE_SECONDS, tags: ['cms-page', `cms-page:${key}`] },
    );

    const dto = parseCmsPageDto(payload);
    if (!dto) {
      console.error('[cms] invalid page payload for', key);
      return { status: 'unavailable' };
    }

    if (!dto.is_published || dto.key !== key) {
      return { status: 'not-found' };
    }

    return { status: 'ok', page: toCmsPageView(dto) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: 'not-found' };
    }
    if (!isTransportFailure(error)) throw error;
    console.error('[cms] failed to load /api/public/pages/{key}', key, error);
    return { status: 'unavailable' };
  }
}

const loadCachedCmsPage = cache(loadCmsPage);

/** Fixed storefront CMS routes (`/about`, `/privacy`, …). */
export function fetchCmsPage(key: CmsPageKey): Promise<CmsPageFetchResult> {
  return loadCachedCmsPage(key);
}

/**
 * Dynamic `/{key}` and `/pages/{key}`. Unsafe keys return not-found and never
 * reach Laravel. Shares `loadCachedCmsPage` with `fetchCmsPage`.
 */
export function fetchDynamicCmsPage(key: string): Promise<CmsPageFetchResult> {
  if (!isSafeCmsPageKey(key)) {
    return Promise.resolve({ status: 'not-found' });
  }
  return loadCachedCmsPage(key);
}

/**
 * GET /api/public/faqs
 *
 * Active FAQs only, already sorted by `sort_order`.
 */
async function loadFaqs(): Promise<FaqFetchResult> {
  try {
    const payload = await apiGet<unknown>('/public/faqs', {
      revalidate: FAQ_REVALIDATE_SECONDS,
      tags: ['faqs'],
    });

    const items = toFaqItems(payload);
    if (items === null) {
      console.error('[cms] invalid FAQ payload');
      return { status: 'unavailable' };
    }

    return { status: 'ok', items };
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[cms] failed to load /api/public/faqs', error);
    return { status: 'unavailable' };
  }
}

export const fetchFaqs = cache(loadFaqs);
