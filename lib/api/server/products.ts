import 'server-only';

import { cache } from 'react';
import type {
  PublicProductDetailDto,
  PublicProductDetailResponse,
  PublicProductDto,
  PublicProductListResponse,
  PublicProductReviewDto,
} from '@/types/api/product';
import { ApiError, apiGet, isTransportFailure } from './http';

export type ProductDetailFetchResult =
  | { status: 'ok'; data: PublicProductDetailDto }
  | { status: 'not-found' }
  | { status: 'unavailable' };

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * GET /api/public/products/{slug}
 *
 * Wrapped in React `cache()` so `generateMetadata` and the page share one
 * Laravel hit. `apiGet` passes a timeout signal, which opts the fetch out of
 * Next.js request memoization; this wrapper is what prevents a double
 * `views_count` increment.
 */
async function loadProductDetail(slug: string): Promise<ProductDetailFetchResult> {
  try {
    const payload = await apiGet<PublicProductDetailResponse>(
      // Rendering never counts a view (#22); the browser does, once (ProductViewBeacon).
      `/public/products/${encodeURIComponent(slug)}?count_view=0`,
      { cache: 'no-store' },
    );
    if (!payload?.data) return { status: 'unavailable' };
    return { status: 'ok', data: payload.data };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: 'not-found' };
    }
    if (!isTransportFailure(error)) throw error;
    console.error('[product] failed to load /api/public/products/{slug}', error);
    return { status: 'unavailable' };
  }
}

export const fetchProductDetail = cache(loadProductDetail);

export type ProductReviewsPage = {
  reviews: PublicProductReviewDto[];
  currentPage: number;
  lastPage: number;
  total: number;
};

/**
 * GET /api/public/products/{slug}/reviews — approved reviews, newest first.
 * `null` when the backend failed; 404 (inactive product) → empty page.
 */
export async function fetchProductReviews(
  slug: string,
  page: number,
  perPage: number,
): Promise<ProductReviewsPage | null> {
  try {
    const payload = await apiGet<{
      data?: unknown;
      meta?: { current_page?: number; last_page?: number; total?: number };
    }>(
      `/public/products/${encodeURIComponent(slug)}/reviews?per_page=${perPage}&page=${page}`,
      { revalidate: 60, tags: ['reviews'] },
    );
    return {
      reviews: asArray<PublicProductReviewDto>(payload?.data),
      currentPage: Number(payload?.meta?.current_page) || page,
      lastPage: Number(payload?.meta?.last_page) || page,
      total: Number(payload?.meta?.total) || 0,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { reviews: [], currentPage: page, lastPage: page, total: 0 };
    }
    if (!isTransportFailure(error)) throw error;
    console.error('[product] failed to load product reviews', error);
    return null;
  }
}

export interface PublicProductQuestion {
  id: number;
  question: string;
  answer: string;
  answeredAt: string | null;
}

export interface ProductQuestionsPage {
  questions: PublicProductQuestion[];
  currentPage: number;
  lastPage: number;
}

/**
 * GET /api/public/products/{slug}/questions (#31): answered questions only,
 * without the asker's name. `null` when the backend failed; 404 → empty.
 */
export async function fetchProductQuestions(
  slug: string,
  page: number,
  perPage: number,
): Promise<ProductQuestionsPage | null> {
  try {
    const payload = await apiGet<{
      data?: unknown;
      meta?: { current_page?: number; last_page?: number };
    }>(
      `/public/products/${encodeURIComponent(slug)}/questions?per_page=${perPage}&page=${page}`,
      { revalidate: 60, tags: ['product-questions'] },
    );
    const questions: PublicProductQuestion[] = [];
    for (const row of Array.isArray(payload?.data) ? payload.data : []) {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
      const id = typeof record?.id === 'number' ? record.id : null;
      const question = typeof record?.question === 'string' ? record.question.trim() : '';
      const answer = typeof record?.answer === 'string' ? record.answer.trim() : '';
      if (id === null || !question || !answer) continue;
      questions.push({
        id,
        question,
        answer,
        answeredAt: typeof record?.answered_at === 'string' ? record.answered_at : null,
      });
    }
    return {
      questions,
      currentPage: Number(payload?.meta?.current_page) || page,
      lastPage: Number(payload?.meta?.last_page) || page,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { questions: [], currentPage: page, lastPage: page };
    }
    if (!isTransportFailure(error)) throw error;
    console.error('[product] failed to load product questions', error);
    return null;
  }
}

async function fetchProductList(
  path: string,
  label: string,
): Promise<PublicProductDto[] | null> {
  try {
    const payload = await apiGet<PublicProductListResponse>(path, { cache: 'no-store' });
    return asArray<PublicProductDto>(payload?.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    if (!isTransportFailure(error)) throw error;
    console.error(`[product] failed to load ${label}`, error);
    return null;
  }
}

/** GET /api/public/products/{slug}/related — `null` on transport failure. */
export function fetchRelatedProducts(slug: string): Promise<PublicProductDto[] | null> {
  return fetchProductList(
    `/public/products/${encodeURIComponent(slug)}/related`,
    '/api/public/products/{slug}/related',
  );
}

/** GET /api/public/products/{slug}/same-brand — `null` on transport failure. */
export function fetchSameBrandProducts(slug: string): Promise<PublicProductDto[] | null> {
  return fetchProductList(
    `/public/products/${encodeURIComponent(slug)}/same-brand`,
    '/api/public/products/{slug}/same-brand',
  );
}
