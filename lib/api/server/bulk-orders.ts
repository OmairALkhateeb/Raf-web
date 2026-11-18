import 'server-only';

import type {
  AccountBulkOrderRequest,
  AccountBulkOrderRequestsMeta,
} from '@/types';
import type {
  AccountClientError,
  BulkOrderCreateFields,
} from '@/types/api/account';
import type { LaravelAuthTokensDto } from '@/types/api/auth';
import {
  bulkOrderValidationMessage,
  parseBulkOrderCreateFields,
  parseLaravelBulkOrderRequest,
  parseLaravelBulkOrderRequestsPage,
} from '@/lib/mappers/bulk-orders';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type BulkOrderOpSuccess<T> = {
  ok: true;
  data: T;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type BulkOrderOpFailure = {
  ok: false;
  error: AccountClientError & { fields?: BulkOrderCreateFields };
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type BulkOrderOpResult<T> =
  | BulkOrderOpSuccess<T>
  | BulkOrderOpFailure;

function unavailable(): BulkOrderOpFailure {
  return {
    ok: false,
    error: { ok: false, code: 'unavailable' },
    remember: true,
  };
}

function withCookies<T>(
  result: BulkOrderOpResult<T>,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): BulkOrderOpResult<T> {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

function mapOwnershipOrValidation(
  data: unknown,
  remember: boolean,
): BulkOrderOpFailure {
  const fields = parseBulkOrderCreateFields(data);
  const message = bulkOrderValidationMessage(data);
  const ownership =
    Boolean(fields.bulk_order_request) ||
    (message?.toLowerCase().includes('does not belong') ?? false);
  return {
    ok: false,
    error: {
      ok: false,
      code: ownership ? 'forbidden' : 'validation',
      error: message,
      fields,
    },
    remember,
  };
}

export type BulkOrderCreateInput = {
  productId: number;
  variantId: number | null;
  quantity: number;
  note: string | null;
};

export async function listLaravelBulkOrders(
  page = 1,
): Promise<
  BulkOrderOpResult<{
    requests: AccountBulkOrderRequest[];
    meta: AccountBulkOrderRequestsMeta;
  }>
> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(
      `/customer/bulk-order-requests?per_page=20&page=${safePage}`,
      {
        method: 'GET',
        accessToken,
      },
    ),
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

  const mapped = parseLaravelBulkOrderRequestsPage(result.data);
  if (!mapped) {
    console.error('Laravel bulk-order-requests page could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}

export async function createLaravelBulkOrder(
  input: BulkOrderCreateInput,
): Promise<BulkOrderOpResult<AccountBulkOrderRequest>> {
  const body: Record<string, unknown> = {
    product_id: input.productId,
    quantity: input.quantity,
    note: input.note,
  };
  if (input.variantId !== null) {
    body.variant_id = input.variantId;
  }

  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/bulk-order-requests', {
      method: 'POST',
      accessToken,
      body,
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
  if (result.status === 422) {
    return withCookies(
      mapOwnershipOrValidation(result.data, attempt.remember),
      attempt,
    );
  }
  if (result.status !== 201) {
    return withCookies(unavailable(), attempt);
  }

  const mapped = parseLaravelBulkOrderRequest(result.data);
  if (!mapped) {
    console.error('Laravel bulk-order create payload could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}

export async function acceptLaravelBulkOrder(
  id: number,
): Promise<BulkOrderOpResult<AccountBulkOrderRequest>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/bulk-order-requests/${id}/accept`, {
      method: 'POST',
      accessToken,
      body: {},
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
        error: { ok: false, code: 'not_found' },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status === 422) {
    return withCookies(
      mapOwnershipOrValidation(result.data, attempt.remember),
      attempt,
    );
  }
  if (result.status !== 200) {
    return withCookies(unavailable(), attempt);
  }

  const mapped = parseLaravelBulkOrderRequest(result.data);
  if (!mapped) {
    console.error('Laravel bulk-order accept payload could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}

export async function cancelLaravelBulkOrder(
  id: number,
): Promise<BulkOrderOpResult<true>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/bulk-order-requests/${id}`, {
      method: 'DELETE',
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
      mapOwnershipOrValidation(result.data, attempt.remember),
      attempt,
    );
  }
  if (result.status !== 200) {
    return withCookies(unavailable(), attempt);
  }

  return withCookies({ ok: true, data: true, remember: attempt.remember }, attempt);
}
