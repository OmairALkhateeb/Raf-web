import 'server-only';

import type {
  AccountReturnReasons,
  AccountReturnRequest,
  AccountReturnsMeta,
} from '@/types';
import type {
  AccountClientError,
  ReturnCreateFields,
} from '@/types/api/account';
import type { LaravelAuthTokensDto } from '@/types/api/auth';
import {
  parseLaravelReturnReasons,
  parseLaravelReturnRequest,
  parseLaravelReturnsPage,
  parseReturnCreateFields,
  returnValidationMessage,
} from '@/lib/mappers/returns';
import type { ReturnCreateInput } from '@/lib/account/returns';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type ReturnOpSuccess<T> = {
  ok: true;
  data: T;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type ReturnOpFailure = {
  ok: false;
  error: AccountClientError & { fields?: ReturnCreateFields };
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type ReturnOpResult<T> = ReturnOpSuccess<T> | ReturnOpFailure;

function unavailable(): ReturnOpFailure {
  return {
    ok: false,
    error: { ok: false, code: 'unavailable' },
    remember: true,
  };
}

function withCookies<T>(
  result: ReturnOpResult<T>,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): ReturnOpResult<T> {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

export async function listLaravelReturns(): Promise<
  ReturnOpResult<{ returns: AccountReturnRequest[]; meta: AccountReturnsMeta }>
> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/returns?per_page=20&page=1', {
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

  const mapped = parseLaravelReturnsPage(result.data);
  if (!mapped) {
    console.error('Laravel returns page could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}

export async function getLaravelReturnReasons(): Promise<
  ReturnOpResult<AccountReturnReasons>
> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/returns/reasons', {
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

  const mapped = parseLaravelReturnReasons(result.data);
  if (!mapped) {
    console.error('Laravel return reasons could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}

export async function createLaravelReturn(
  input: ReturnCreateInput,
): Promise<ReturnOpResult<AccountReturnRequest>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/returns', {
      method: 'POST',
      accessToken,
      body: {
        order_item_id: input.orderItemId,
        quantity: input.quantity,
        reason: input.reason,
        note: input.note,
        ...(input.refundAccount
          ? {
              refund_iban: input.refundAccount.iban,
              refund_account_name: input.refundAccount.accountName,
            }
          : {}),
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
  if (result.status === 422) {
    const fields = parseReturnCreateFields(result.data);
    return withCookies(
      {
        ok: false,
        error: {
          ok: false,
          code: 'validation',
          error: returnValidationMessage(result.data),
          fields,
        },
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
          error: returnValidationMessage(result.data),
        },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status !== 201) {
    return withCookies(unavailable(), attempt);
  }

  const mapped = parseLaravelReturnRequest(result.data);
  if (!mapped) {
    // Create succeeded but nested relations may be absent; synthesize minimal row
    // from known input so the client can refresh the list.
    console.error('Laravel return create payload could not be fully mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}

export async function cancelLaravelReturn(
  id: number,
): Promise<ReturnOpResult<true>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/returns/${id}`, {
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
    const fields = parseReturnCreateFields(result.data);
    const message = returnValidationMessage(result.data);
    const ownership =
      Boolean(fields.return_request) ||
      (message?.toLowerCase().includes('does not belong') ?? false);
    return withCookies(
      {
        ok: false,
        error: {
          ok: false,
          code: ownership ? 'forbidden' : 'validation',
          error: message,
          fields,
        },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status !== 200) {
    return withCookies(unavailable(), attempt);
  }

  return withCookies({ ok: true, data: true, remember: attempt.remember }, attempt);
}
