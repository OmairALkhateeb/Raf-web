import 'server-only';

import type { LaravelAuthTokensDto } from '@/types/api/auth';
import type {
  WishlistClientError,
  WishlistItemJson,
} from '@/types/api/wishlist';
import type { AddWishlistInput } from '@/lib/wishlist/validate';
import { firstValidationMessage } from '@/lib/mappers/auth';
import {
  parseLaravelWishlistList,
  parseLaravelWishlistResource,
} from '@/lib/mappers/wishlist';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type WishlistOpSuccess<T> = {
  ok: true;
  data: T;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type WishlistOpFailure = {
  ok: false;
  error: WishlistClientError;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type WishlistOpResult<T> = WishlistOpSuccess<T> | WishlistOpFailure;

function unavailable(): WishlistOpFailure {
  return {
    ok: false,
    error: { ok: false, code: 'unavailable' },
    remember: true,
  };
}

function withCookies<T>(
  result: WishlistOpResult<T>,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): WishlistOpResult<T> {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

function interpret<T>(
  attempt: Awaited<ReturnType<typeof withCustomerAuth>>,
  map: (data: unknown, status: number) => T | undefined,
  success: (status: number) => boolean,
): WishlistOpResult<T> {
  const { result } = attempt;

  if (result.unreachable) {
    return withCookies(unavailable(), attempt);
  }

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

  if (result.status === 403) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'forbidden' },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status === 404) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'not_found' },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status === 422) {
    return withCookies(
      {
        ok: false,
        error: {
          ok: false,
          code: 'validation',
          error:
            firstValidationMessage(result.data) ??
            'This product cannot be saved to the wishlist.',
        },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status >= 500 || !success(result.status)) {
    return withCookies(unavailable(), attempt);
  }

  const data = map(result.data, result.status);
  if (data === undefined) {
    console.error(
      'Laravel wishlist payload could not be mapped',
      result.status,
    );
    return withCookies(unavailable(), attempt);
  }

  return withCookies({ ok: true, data, remember: attempt.remember }, attempt);
}

export async function listLaravelWishlist(): Promise<
  WishlistOpResult<WishlistItemJson[]>
> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/wishlist', { method: 'GET', accessToken }),
  );
  return interpret(
    attempt,
    (data) => parseLaravelWishlistList(data),
    (status) => status === 200,
  );
}

export async function addLaravelWishlistItem(
  input: AddWishlistInput,
): Promise<WishlistOpResult<WishlistItemJson>> {
  const body: Record<string, unknown> = {
    product_id: input.productId,
    variant_id: input.variantId ?? null,
  };
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/wishlist', {
      method: 'POST',
      accessToken,
      body,
    }),
  );
  return interpret(
    attempt,
    (data) => parseLaravelWishlistResource(data),
    (status) => status === 200 || status === 201,
  );
}

export async function removeLaravelWishlistItem(
  id: number,
): Promise<WishlistOpResult<true>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/wishlist/${id}`, {
      method: 'DELETE',
      accessToken,
    }),
  );
  return interpret(
    attempt,
    () => true,
    (status) => status === 200,
  );
}
