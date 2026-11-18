import 'server-only';
import { laravelErrorCode } from './error-code';

import type { CartSnapshot } from '@/types';
import type { CartClientError, CartErrorReason, CartErrorField } from '@/types/api/cart';
import type { LaravelAuthTokensDto } from '@/types/api/auth';
import { apiBaseUrl } from './env';
import { ApiError, isTransportFailure } from './http';
import { guestTokenFromPayload, toCartSnapshot } from '@/lib/mappers/cart';
import type { AddCartItemInput } from '@/lib/cart/validate';
import { readAuthCookieJar, refreshAuthTokensDetailed } from './auth';

const REQUEST_TIMEOUT_MS = 8000;

const ALLOWLISTED_MESSAGES: Record<string, { field: CartErrorField; reason: CartErrorReason }> = {
  'Requested quantity exceeds available stock.': { field: 'quantity', reason: 'stock' },
  'This product requires a variant to be selected.': { field: 'variant_id', reason: 'variant_required' },
  'This variant is not available.': { field: 'variant_id', reason: 'variant_unavailable' },
  'This product is not available.': { field: 'product_id', reason: 'product_unavailable' },
  'This item does not belong to your cart.': { field: 'item', reason: 'item_mismatch' },
  'This bundle is no longer available.': { field: 'bundle_id', reason: 'bundle_unavailable' },
};

/** Bundle messages that include the bundle's name. */
const ALLOWLISTED_PATTERNS: Array<{
  pattern: RegExp;
  mapped: { field: CartErrorField; reason: CartErrorReason };
}> = [
  {
    pattern: /^Insufficient stock for ".*"\.$/,
    mapped: { field: 'bundle_id', reason: 'bundle_stock' },
  },
  {
    pattern: /^".*" contains a (product|variant) that is no longer available\.$/,
    mapped: { field: 'bundle_id', reason: 'bundle_unavailable' },
  },
  {
    pattern: /quantity field must not be greater than/i,
    mapped: { field: 'quantity', reason: 'quantity_max' },
  },
];

/** The backend's `code` → reason; checked before the English text. */
const CODE_REASONS: Record<string, { field: CartErrorField; reason: CartErrorReason }> = {
  insufficient_stock: { field: 'quantity', reason: 'stock' },
  variant_required: { field: 'variant_id', reason: 'variant_required' },
  variant_unavailable: { field: 'variant_id', reason: 'variant_unavailable' },
  variant_mismatch: { field: 'variant_id', reason: 'variant_unavailable' },
  product_unavailable: { field: 'product_id', reason: 'product_unavailable' },
  cart_item_not_found: { field: 'item', reason: 'item_mismatch' },
  bundle_unavailable: { field: 'bundle_id', reason: 'bundle_unavailable' },
};

function fromCode(body: unknown): { field: CartErrorField; reason: CartErrorReason } | null {
  const code = laravelErrorCode(body);
  const mapped = code ? CODE_REASONS[code] : undefined;
  if (!mapped) return null;
  // Bundle errors arrive on `bundle_id` with the product codes.
  const errors = (body as { errors?: unknown }).errors;
  const onBundle =
    !!errors && typeof errors === 'object' && !Array.isArray(errors) && 'bundle_id' in errors;
  if (onBundle && mapped.reason === 'stock') return { field: 'bundle_id', reason: 'bundle_stock' };
  if (onBundle && mapped.reason === 'product_unavailable') {
    return { field: 'bundle_id', reason: 'bundle_unavailable' };
  }
  return mapped;
}

function allowlisted(message: string): { field: CartErrorField; reason: CartErrorReason } | null {
  const exact = ALLOWLISTED_MESSAGES[message];
  if (exact) return exact;
  return ALLOWLISTED_PATTERNS.find(({ pattern }) => pattern.test(message))?.mapped ?? null;
}

export type LaravelCartResult =
  | {
      ok: true;
      snapshot: CartSnapshot;
      guestToken?: string;
      rotatedTokens?: LaravelAuthTokensDto;
      remember?: boolean;
      clearAuth?: boolean;
      clearGuestToken?: boolean;
    }
  | {
      ok: false;
      error: CartClientError;
      rotatedTokens?: LaravelAuthTokensDto;
      remember?: boolean;
      clearAuth?: boolean;
      clearGuestToken?: boolean;
    };

type CartCredentials = {
  accessToken?: string;
  guestToken?: string;
};

function unavailable(): LaravelCartResult {
  return { ok: false, error: { ok: false, code: 'unavailable' } };
}

function unauthenticated(): LaravelCartResult {
  return { ok: false, error: { ok: false, code: 'unauthenticated' } };
}

function firstAllowlisted(body: unknown): { field: CartErrorField; reason: CartErrorReason } | null {
  if (!body || typeof body !== 'object') return null;
  const byCode = fromCode(body);
  if (byCode) return byCode;
  // No specific code (`validation_failed`): the English text, e.g. bundle
  // sentences and the quantity limit.
  const payload = body as { message?: unknown; errors?: unknown };

  if (payload.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors)) {
    for (const value of Object.values(payload.errors as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      for (const entry of value) {
        if (typeof entry !== 'string') continue;
        const mapped = allowlisted(entry);
        if (mapped) return mapped;
      }
    }
  }

  if (typeof payload.message === 'string') {
    const mapped = allowlisted(payload.message);
    if (mapped) return mapped;
  }

  return null;
}

async function laravelCartFetch(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  creds: CartCredentials,
  body?: unknown,
): Promise<{ json: unknown; guestTokenHeader: string | null }> {
  // English: cart errors and issues are matched by text (ALLOWLISTED_*, mapIssue).
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'en',
  };
  if (creds.accessToken) headers.Authorization = `Bearer ${creds.accessToken}`;
  if (creds.guestToken) headers['X-Guest-Token'] = creds.guestToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${apiBaseUrl()}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    console.error(`Laravel cart ${method} ${path} returned non-JSON`, res.status);
    json = undefined;
  }

  if (!res.ok) {
    console.error(`Laravel cart ${method} ${path} failed`, res.status);
    throw new ApiError(res.status, path, `API ${res.status} ${res.statusText} for ${path}`, json);
  }

  return { json, guestTokenHeader: res.headers.get('X-Guest-Token') };
}

function interpretFailure(error: unknown): LaravelCartResult {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return unauthenticated();
    }
    if (error.status === 404) {
      return { ok: false, error: { ok: false, code: 'not_found' } };
    }
    if (error.status === 422) {
      const mapped = firstAllowlisted(error.body);
      if (mapped) {
        return {
          ok: false,
          error: { ok: false, code: 'validation', field: mapped.field, reason: mapped.reason },
        };
      }
      return unavailable();
    }
    return unavailable();
  }

  if (isTransportFailure(error)) return unavailable();
  if (error instanceof Error && error.message.includes('API_BASE_URL')) return unavailable();
  return unavailable();
}

function toResult(json: unknown, guestTokenHeader: string | null): LaravelCartResult {
  const snapshot = toCartSnapshot(json);
  if (!snapshot) return unavailable();
  return {
    ok: true,
    snapshot,
    guestToken: guestTokenFromPayload(json, guestTokenHeader),
  };
}

async function callCart(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  creds: CartCredentials,
  body?: unknown,
): Promise<LaravelCartResult> {
  try {
    const res = await laravelCartFetch(method, path, creds, body);
    return toResult(res.json, res.guestTokenHeader);
  } catch (error) {
    return interpretFailure(error);
  }
}

function jwtAccessExpired(token: string): boolean {
  try {
    const segment = token.split('.')[1];
    if (!segment) return true;
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return true;
    return payload.exp * 1000 <= Date.now() + 5000;
  } catch {
    return true;
  }
}

/** A throttled or failed refresh keeps the session; only a rejected one signs out. */
function refreshFailure(temporary: boolean, remember: boolean): LaravelCartResult {
  return temporary
    ? unavailable()
    : { ...unauthenticated(), clearAuth: true, remember };
}

function isGuestFallback(result: LaravelCartResult, sentAccess: boolean): boolean {
  return sentAccess && result.ok && Boolean(result.guestToken);
}

async function withAuthRetry(
  guestToken: string | undefined,
  call: (creds: CartCredentials) => Promise<LaravelCartResult>,
  options: { sendGuestWithAuth: boolean; requireAuth: boolean },
): Promise<LaravelCartResult> {
  const jar = await readAuthCookieJar();
  const tryingAuth = Boolean(jar.accessToken || jar.refreshToken);

  if (options.requireAuth && !tryingAuth) {
    return unauthenticated();
  }

  let access = jar.accessToken;
  let rotated: LaravelAuthTokensDto | undefined;
  let refreshed = false;

  if (access && jwtAccessExpired(access)) {
    if (!jar.refreshToken) {
      return { ...unauthenticated(), clearAuth: true, remember: jar.remember };
    }
    const outcome = await refreshAuthTokensDetailed(jar.refreshToken);
    refreshed = true;
    if (!outcome.ok) return refreshFailure(outcome.temporary, jar.remember);
    rotated = outcome.tokens;
    access = rotated.access_token;
  } else if (!access && jar.refreshToken) {
    const outcome = await refreshAuthTokensDetailed(jar.refreshToken);
    refreshed = true;
    if (!outcome.ok) return refreshFailure(outcome.temporary, jar.remember);
    rotated = outcome.tokens;
    access = rotated.access_token;
  }

  const guestForCall = access && !options.sendGuestWithAuth ? undefined : guestToken;
  let result = await call({ accessToken: access, guestToken: guestForCall });

  const authRejected =
    (!result.ok && result.error.code === 'unauthenticated') || isGuestFallback(result, Boolean(access));

  if (authRejected && tryingAuth && !refreshed && jar.refreshToken) {
    const outcome = await refreshAuthTokensDetailed(jar.refreshToken);
    refreshed = true;
    if (!outcome.ok) return refreshFailure(outcome.temporary, jar.remember);
    rotated = outcome.tokens;
    const guestRetry = !options.sendGuestWithAuth ? undefined : guestToken;
    result = await call({ accessToken: rotated.access_token, guestToken: guestRetry });
  }

  if (
    tryingAuth &&
    ((!result.ok && result.error.code === 'unauthenticated') || isGuestFallback(result, Boolean(rotated?.access_token ?? access)))
  ) {
    return { ...unauthenticated(), clearAuth: true, remember: jar.remember };
  }

  if (rotated) {
    return { ...result, rotatedTokens: rotated, remember: jar.remember };
  }
  return result;
}

/**
 * GET /customer/cart. With `addressId` + `shippingMethodId` the totals are
 * computed for that address and method, exactly as checkout will charge.
 */
export async function fetchLaravelCart(
  guestToken?: string,
  quote?: { addressId: number; shippingMethodId: number },
): Promise<LaravelCartResult> {
  const path = quote
    ? `/customer/cart?address_id=${quote.addressId}&shipping_method_id=${quote.shippingMethodId}`
    : '/customer/cart';
  return withAuthRetry(
    guestToken,
    creds => callCart('GET', path, creds),
    { sendGuestWithAuth: false, requireAuth: false },
  );
}

export async function addLaravelCartItem(
  input: AddCartItemInput,
  guestToken?: string,
): Promise<LaravelCartResult> {
  const body: Record<string, number> = {
    product_id: input.productId,
    quantity: input.quantity,
  };
  if (input.variantId !== undefined) body.variant_id = input.variantId;

  return withAuthRetry(
    guestToken,
    creds => callCart('POST', '/customer/cart/items', creds, body),
    { sendGuestWithAuth: false, requireAuth: false },
  );
}

export async function updateLaravelCartItem(
  itemId: number,
  quantity: number,
  guestToken?: string,
): Promise<LaravelCartResult> {
  return withAuthRetry(
    guestToken,
    creds => callCart('PATCH', `/customer/cart/items/${itemId}`, creds, { quantity }),
    { sendGuestWithAuth: false, requireAuth: false },
  );
}

export async function removeLaravelCartItem(
  itemId: number,
  guestToken?: string,
): Promise<LaravelCartResult> {
  return withAuthRetry(
    guestToken,
    creds => callCart('DELETE', `/customer/cart/items/${itemId}`, creds),
    { sendGuestWithAuth: false, requireAuth: false },
  );
}

/** POST /customer/cart/bundles — adding the same bundle again adds to its line. */
export async function addLaravelCartBundle(
  bundleId: number,
  quantity: number,
  guestToken?: string,
): Promise<LaravelCartResult> {
  return withAuthRetry(
    guestToken,
    creds => callCart('POST', '/customer/cart/bundles', creds, { bundle_id: bundleId, quantity }),
    { sendGuestWithAuth: false, requireAuth: false },
  );
}

export async function updateLaravelCartBundle(
  bundleItemId: number,
  quantity: number,
  guestToken?: string,
): Promise<LaravelCartResult> {
  return withAuthRetry(
    guestToken,
    creds => callCart('PATCH', `/customer/cart/bundles/${bundleItemId}`, creds, { quantity }),
    { sendGuestWithAuth: false, requireAuth: false },
  );
}

export async function removeLaravelCartBundle(
  bundleItemId: number,
  guestToken?: string,
): Promise<LaravelCartResult> {
  return withAuthRetry(
    guestToken,
    creds => callCart('DELETE', `/customer/cart/bundles/${bundleItemId}`, creds),
    { sendGuestWithAuth: false, requireAuth: false },
  );
}

/**
 * Merge the guest cart into the authenticated customer cart.
 * No guest token: load the customer cart (safe no-op). Failed merge does not clear the guest cookie.
 */
export async function mergeLaravelCart(guestToken?: string): Promise<LaravelCartResult> {
  if (!guestToken) {
    const result = await withAuthRetry(
      undefined,
      creds => callCart('GET', '/customer/cart', creds),
      { sendGuestWithAuth: false, requireAuth: true },
    );
    return result;
  }

  const result = await withAuthRetry(
    guestToken,
    creds => callCart('POST', '/customer/cart/merge', creds),
    { sendGuestWithAuth: true, requireAuth: true },
  );

  if (result.ok) {
    return { ...result, guestToken: undefined, clearGuestToken: true };
  }
  return result;
}
