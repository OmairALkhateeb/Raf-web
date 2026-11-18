import 'server-only';

import type { AccountReview, AccountReviewsMeta } from '@/types';
import type {
  AccountClientError,
  ReviewCreateFields,
} from '@/types/api/account';
import type { LaravelAuthTokensDto } from '@/types/api/auth';
import {
  parseLaravelReview,
  parseLaravelReviewsPage,
  parseReviewCreateFields,
  reviewValidationMessage,
} from '@/lib/mappers/reviews';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type ReviewOpSuccess<T> = {
  ok: true;
  data: T;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type ReviewOpFailure = {
  ok: false;
  error: AccountClientError & { fields?: ReviewCreateFields };
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type ReviewOpResult<T> = ReviewOpSuccess<T> | ReviewOpFailure;

function unavailable(): ReviewOpFailure {
  return {
    ok: false,
    error: { ok: false, code: 'unavailable' },
    remember: true,
  };
}

function withCookies<T>(
  result: ReviewOpResult<T>,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): ReviewOpResult<T> {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

export type ReviewUpdateInput = {
  rating: number;
  comment: string | null;
};

/** 404 (not yours / gone), 422 (validation) and 401 shared by update and delete. */
function reviewWriteFailure<T>(
  result: { status: number; data: unknown },
  attempt: { rotatedTokens?: LaravelAuthTokensDto; remember: boolean; clearAuth: boolean },
): ReviewOpResult<T> | null {
  if (result.status === 401) {
    return withCookies<T>(
      { ok: false, error: { ok: false, code: 'unauthenticated' }, remember: attempt.remember },
      attempt,
    );
  }
  if (result.status === 404) {
    return withCookies<T>(
      { ok: false, error: { ok: false, code: 'not_found' }, remember: attempt.remember },
      attempt,
    );
  }
  if (result.status === 422) {
    return withCookies<T>(
      {
        ok: false,
        error: {
          ok: false,
          code: 'validation',
          error: reviewValidationMessage(result.data),
          fields: parseReviewCreateFields(result.data),
        },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  return null;
}

/** PATCH /customer/reviews/{id}: the review goes back to `pending` (#24). */
export async function updateLaravelReview(
  id: number,
  input: ReviewUpdateInput,
): Promise<ReviewOpResult<AccountReview>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/reviews/${id}`, {
      method: 'PATCH',
      accessToken,
      body: { rating: input.rating, comment: input.comment },
    }),
  );
  const { result } = attempt;
  if (result.unreachable) return withCookies(unavailable(), attempt);
  const failure = reviewWriteFailure<AccountReview>(result, attempt);
  if (failure) return failure;
  if (result.status < 200 || result.status >= 300) return withCookies(unavailable(), attempt);

  const mapped = parseLaravelReview(result.data);
  if (!mapped) {
    console.error('Laravel review update payload could not be mapped');
    return withCookies(unavailable(), attempt);
  }
  return withCookies({ ok: true, data: mapped, remember: attempt.remember }, attempt);
}

/** DELETE /customer/reviews/{id}: gone for good; the item can be reviewed again (#24). */
export async function deleteLaravelReview(id: number): Promise<ReviewOpResult<true>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/reviews/${id}`, { method: 'DELETE', accessToken }),
  );
  const { result } = attempt;
  if (result.unreachable) return withCookies(unavailable(), attempt);
  const failure = reviewWriteFailure<true>(result, attempt);
  if (failure) return failure;
  if (result.status < 200 || result.status >= 300) return withCookies(unavailable(), attempt);
  return withCookies({ ok: true, data: true, remember: attempt.remember }, attempt);
}

export type ReviewCreateInput = {
  orderItemId: number;
  rating: number;
  comment: string | null;
};

export async function listLaravelReviews(): Promise<
  ReviewOpResult<{ reviews: AccountReview[]; meta: AccountReviewsMeta }>
> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/reviews?per_page=20&page=1', {
      method: 'GET',
      accessToken,
    }),
  );
  const { result } = attempt;

  if (result.unreachable) return withCookies(unavailable(), attempt);
  if (result.status === 401) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unauthenticated' },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status !== 200) {
    return withCookies(unavailable(), attempt);
  }

  const mapped = parseLaravelReviewsPage(result.data);
  if (!mapped) {
    console.error('Laravel reviews page could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}

export async function createLaravelReview(
  input: ReviewCreateInput,
): Promise<ReviewOpResult<AccountReview>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/reviews', {
      method: 'POST',
      accessToken,
      body: {
        order_item_id: input.orderItemId,
        rating: input.rating,
        comment: input.comment,
      },
    }),
  );
  const { result } = attempt;

  if (result.unreachable) return withCookies(unavailable(), attempt);
  if (result.status === 401) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unauthenticated' },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status === 404) {
    return withCookies(
      {
        ok: false,
        error: {
          ok: false,
          code: 'not_found',
          error: reviewValidationMessage(result.data),
        },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status === 422) {
    const fields = parseReviewCreateFields(result.data);
    return withCookies(
      {
        ok: false,
        error: {
          ok: false,
          code: 'validation',
          error: reviewValidationMessage(result.data),
          fields,
        },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status !== 201) {
    return withCookies(unavailable(), attempt);
  }

  const mapped = parseLaravelReview(result.data);
  if (!mapped) {
    console.error('Laravel review create payload could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}
