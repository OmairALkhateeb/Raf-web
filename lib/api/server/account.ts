import 'server-only';

import type { AccountOrder, AccountOrderDetail, AccountOrdersMeta, Address } from '@/types';
import type { AccountClientError } from '@/types/api/account';
import type { LaravelAuthTokensDto } from '@/types/api/auth';
import type {
  AddressPatchInput,
  AddressWriteInput,
} from '@/lib/account/validate';
import { firstValidationMessage } from '@/lib/mappers/auth';
import {
  parseLaravelAddressList,
  parseLaravelAddressResource,
  parseLaravelOrderDetail,
  parseLaravelOrdersPage,
} from '@/lib/mappers/account';
import { GATEWAY_REQUEST_TIMEOUT_MS, laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type AccountOpSuccess<T> = {
  ok: true;
  data: T;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type AccountOpFailure = {
  ok: false;
  error: AccountClientError;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type AccountOpResult<T> = AccountOpSuccess<T> | AccountOpFailure;

function unavailable(): AccountOpFailure {
  return {
    ok: false,
    error: { ok: false, code: 'unavailable' },
    remember: true,
  };
}

function withCookies<T>(
  result: AccountOpResult<T>,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): AccountOpResult<T> {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

export function interpretCustomerResult<T>(
  attempt: Awaited<ReturnType<typeof withCustomerAuth>>,
  map: (data: unknown, status: number) => T | undefined,
  success: (status: number) => boolean,
): AccountOpResult<T> {
  return interpret(attempt, map, success);
}

function interpret<T>(
  attempt: Awaited<ReturnType<typeof withCustomerAuth>>,
  map: (data: unknown, status: number) => T | undefined,
  success: (status: number) => boolean,
): AccountOpResult<T> {
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
            'Please check the address details and try again.',
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
      'Laravel customer payload could not be mapped',
      result.status,
    );
    return withCookies(unavailable(), attempt);
  }

  return withCookies({ ok: true, data, remember: attempt.remember }, attempt);
}

function toLaravelCreateBody(
  input: AddressWriteInput,
): Record<string, unknown> {
  return {
    label: input.label,
    name: input.fullName,
    phone: input.phone,
    country: input.country,
    city: input.city,
    area: input.area,
    address_line1: input.street,
    address_line2: input.addressLine2,
    postal_code: input.postalCode,
    is_default: input.isDefault,
    latitude: input.location?.latitude ?? null,
    longitude: input.location?.longitude ?? null,
  };
}

function toLaravelPatchBody(input: AddressPatchInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.label !== undefined) body.label = input.label;
  if (input.fullName !== undefined) body.name = input.fullName;
  if (input.phone !== undefined) body.phone = input.phone;
  if (input.country !== undefined) body.country = input.country;
  if (input.city !== undefined) body.city = input.city;
  if (input.area !== undefined) body.area = input.area;
  if (input.street !== undefined) body.address_line1 = input.street;
  if (input.addressLine2 !== undefined) body.address_line2 = input.addressLine2;
  if (input.postalCode !== undefined) body.postal_code = input.postalCode;
  if (input.isDefault !== undefined) body.is_default = input.isDefault;
  if (input.location !== undefined) {
    body.latitude = input.location?.latitude ?? null;
    body.longitude = input.location?.longitude ?? null;
  }
  return body;
}

export async function listLaravelAddresses(): Promise<
  AccountOpResult<Address[]>
> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/addresses', { method: 'GET', accessToken }),
  );
  return interpret(
    attempt,
    (data) => parseLaravelAddressList(data),
    (status) => status === 200,
  );
}

export async function createLaravelAddress(
  input: AddressWriteInput,
): Promise<AccountOpResult<Address>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/addresses', {
      method: 'POST',
      accessToken,
      body: toLaravelCreateBody(input),
    }),
  );
  return interpret(
    attempt,
    (data) => parseLaravelAddressResource(data),
    (status) => status === 201,
  );
}

export async function updateLaravelAddress(
  id: number,
  input: AddressPatchInput,
): Promise<AccountOpResult<Address>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/addresses/${id}`, {
      method: 'PATCH',
      accessToken,
      body: toLaravelPatchBody(input),
    }),
  );
  return interpret(
    attempt,
    (data) => parseLaravelAddressResource(data),
    (status) => status === 200,
  );
}

export async function deleteLaravelAddress(
  id: number,
): Promise<AccountOpResult<true>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/addresses/${id}`, {
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

export async function listLaravelOrders(): Promise<
  AccountOpResult<{ orders: AccountOrder[]; meta: AccountOrdersMeta }>
> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/orders?per_page=20&page=1', {
      method: 'GET',
      accessToken,
    }),
  );
  return interpret(
    attempt,
    (data) => parseLaravelOrdersPage(data),
    (status) => status === 200,
  );
}

export async function getLaravelOrder(
  id: number,
): Promise<AccountOpResult<AccountOrderDetail>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/orders/${id}`, {
      method: 'GET',
      accessToken,
      // An unpaid order is re-checked with Thawani on read (guide §5.4).
      timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS,
    }),
  );
  return interpret(
    attempt,
    (data) => parseLaravelOrderDetail(data),
    (status) => status === 200,
  );
}
