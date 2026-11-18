import 'server-only';

import { cookies } from 'next/headers';
import type { User } from '@/types';
import type { LaravelAuthTokensDto, LaravelUserDto } from '@/types/api/auth';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REMEMBER_COOKIE,
} from './auth-cookies';
import { getServerLanguage } from '@/lib/i18n/server';
import { authDeviceName, laravelAuthFetch } from './auth-http';
import { laravelErrorCode } from './error-code';
import {
  firstValidationMessage,
  isCustomerUser,
  parseLaravelTokens,
  parseLaravelUser,
  toUser,
} from '@/lib/mappers/auth';
import {
  joinSafeAuthErrorMessages,
  RATE_LIMITED_MESSAGE,
} from '@/lib/auth/error-body';

export const UNAVAILABLE_MESSAGE = 'The service is temporarily unavailable. Please try again.';
export const CUSTOMER_ONLY_MESSAGE = 'This storefront is for customer accounts only.';

export type CookieJar = {
  accessToken?: string;
  refreshToken?: string;
  remember: boolean;
};

export async function readAuthCookieJar(): Promise<CookieJar> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value?.trim();
  const refresh = jar.get(REFRESH_COOKIE)?.value?.trim();
  const rememberRaw = jar.get(REMEMBER_COOKIE)?.value;
  return {
    accessToken: access || undefined,
    refreshToken: refresh || undefined,
    remember: rememberRaw !== '0',
  };
}

export type EstablishAuthResult =
  | { ok: true; user: User; tokens: LaravelAuthTokensDto }
  | { ok: false; status: number; error: string; clear: boolean };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function customerFromPayload(payload: unknown): LaravelUserDto {
  const user = parseLaravelUser(payload);
  if (!isCustomerUser(user)) {
    throw new Error('not_customer');
  }
  return user;
}

export async function loginCustomer(
  email: string,
  password: string,
): Promise<EstablishAuthResult> {
  const result = await laravelAuthFetch('/auth/login', {
    method: 'POST',
    body: { email, password, device_name: authDeviceName() },
  });

  if (result.unreachable) {
    return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE, clear: false };
  }

  if (result.status === 429) {
    return { ok: false, status: 429, error: RATE_LIMITED_MESSAGE, clear: false };
  }

  // The code first (same in every language); `lib/auth/messages.ts`
  // translates these canonical texts.
  const code = laravelErrorCode(result.data);
  if (code === 'invalid_credentials' || code === 'account_inactive') {
    return {
      ok: false,
      status: result.status === 403 ? 403 : 422,
      error: code === 'invalid_credentials' ? 'Invalid credentials.' : 'This account is not active.',
      clear: false,
    };
  }

  if (result.status === 422) {
    return {
      ok: false,
      status: 422,
      error: firstValidationMessage(result.data) ?? 'Invalid credentials.',
      clear: false,
    };
  }

  if (result.status < 200 || result.status >= 300) {
    return { ok: false, status: result.status >= 500 ? 503 : result.status, error: UNAVAILABLE_MESSAGE, clear: false };
  }

  const record = asRecord(result.data);
  if (record?.requires_2fa === true) {
    return { ok: false, status: 403, error: CUSTOMER_ONLY_MESSAGE, clear: false };
  }

  try {
    const userDto = customerFromPayload(record?.user ?? result.data);
    const tokens = parseLaravelTokens(record?.tokens);
    return { ok: true, user: toUser(userDto), tokens };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_customer') {
      await revokeLaravelSession(parseTokensSafely(record?.tokens));
      return { ok: false, status: 403, error: CUSTOMER_ONLY_MESSAGE, clear: false };
    }
    console.error('Laravel login payload could not be mapped');
    return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE, clear: false };
  }
}

export async function registerCustomer(input: {
  name: string;
  email: string;
  phone: string | null;
  password: string;
  passwordConfirmation: string;
}): Promise<EstablishAuthResult> {
  const result = await laravelAuthFetch('/auth/register/customer', {
    method: 'POST',
    // Field messages ("e-mail already taken") are shown as they come.
    acceptLanguage: await getServerLanguage(),
    body: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
      device_name: authDeviceName(),
    },
  });

  if (result.unreachable) {
    return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE, clear: false };
  }

  if (result.status !== 201) {
    if (result.status === 429) {
      return { ok: false, status: 429, error: RATE_LIMITED_MESSAGE, clear: false };
    }
    if (result.status >= 500) {
      return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE, clear: false };
    }
    const error = joinSafeAuthErrorMessages(result.data);
    if (error) {
      return { ok: false, status: result.status, error, clear: false };
    }
    return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE, clear: false };
  }

  const record = asRecord(result.data);
  try {
    const userDto = customerFromPayload(record?.user ?? result.data);
    const tokens = parseLaravelTokens(record?.tokens);
    return { ok: true, user: toUser(userDto), tokens };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_customer') {
      await revokeLaravelSession(parseTokensSafely(record?.tokens));
      return { ok: false, status: 403, error: CUSTOMER_ONLY_MESSAGE, clear: false };
    }
    console.error('Laravel register payload could not be mapped');
    return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE, clear: false };
  }
}

function parseTokensSafely(raw: unknown): LaravelAuthTokensDto | undefined {
  try {
    return parseLaravelTokens(raw);
  } catch (error) {
    console.error(
      'Could not parse tokens for session revoke',
      error instanceof Error ? error.name : 'unknown',
    );
    return undefined;
  }
}

/** Rotate the Laravel refresh token once. The previous refresh token is invalid after this. */
export type RefreshTokensResult =
  | { ok: true; tokens: LaravelAuthTokensDto }
  /**
   * `temporary`: the backend was unreachable, throttled (429) or failed (5xx).
   * The refresh token may still be valid, so callers must not sign the
   * customer out; they answer "unavailable" instead.
   */
  | { ok: false; temporary: boolean };

/**
 * Laravel refresh tokens are single-use: the first refresh revokes the token.
 * When several requests carry the same expired access token (a page loading
 * data in parallel, a poll landing on a click), only one refresh may reach
 * Laravel; the others wait for it and get the same new pair. A success stays
 * shared for a short while, so a request that left the browser with the old
 * cookie still gets the new tokens instead of a 401 that signs the customer out.
 *
 * Per server process (kept on `globalThis` so every route shares it). Several
 * server instances need the backend to accept a just-rotated token briefly
 * (backend note 45).
 */
const REFRESH_SHARE_MS = 30_000;

type SharedRefresh = { promise: Promise<RefreshTokensResult>; startedAt: number };

const sharedRefreshes: Map<string, SharedRefresh> = ((
  globalThis as { __rafSharedRefreshes?: Map<string, SharedRefresh> }
).__rafSharedRefreshes ??= new Map());

export function refreshAuthTokensDetailed(
  refreshToken: string,
): Promise<RefreshTokensResult> {
  const now = Date.now();
  for (const [token, entry] of sharedRefreshes) {
    if (now - entry.startedAt > REFRESH_SHARE_MS) sharedRefreshes.delete(token);
  }

  const shared = sharedRefreshes.get(refreshToken);
  if (shared) return shared.promise;

  const promise = requestTokenRefresh(refreshToken).then((result) => {
    // Only a success is kept for latecomers; after a failure the next
    // request may try again (e.g. the backend was briefly down).
    if (!result.ok) sharedRefreshes.delete(refreshToken);
    return result;
  });
  sharedRefreshes.set(refreshToken, { promise, startedAt: now });
  return promise;
}

async function requestTokenRefresh(
  refreshToken: string,
): Promise<RefreshTokensResult> {
  const result = await laravelAuthFetch('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken, device_name: authDeviceName() },
  });

  if (result.unreachable || result.status === 429 || result.status >= 500) {
    return { ok: false, temporary: true };
  }
  if (result.status < 200 || result.status >= 300) {
    return { ok: false, temporary: false };
  }

  const record = asRecord(result.data);
  try {
    return { ok: true, tokens: parseLaravelTokens(record?.tokens ?? result.data) };
  } catch (error) {
    console.error(
      'Laravel refresh payload could not be mapped',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, temporary: false };
  }
}

export async function refreshAuthTokens(refreshToken: string): Promise<LaravelAuthTokensDto | undefined> {
  const result = await refreshAuthTokensDetailed(refreshToken);
  return result.ok ? result.tokens : undefined;
}

async function fetchCustomerProfile(accessToken: string): Promise<
  | { ok: true; user: User }
  | { ok: false; status: number; unreachable: boolean }
> {
  const result = await laravelAuthFetch('/customer/profile', {
    method: 'GET',
    accessToken,
  });

  if (result.unreachable) {
    return { ok: false, status: 0, unreachable: true };
  }

  if (result.status < 200 || result.status >= 300) {
    return { ok: false, status: result.status, unreachable: false };
  }

  try {
    const userDto = customerFromPayload(result.data);
    return { ok: true, user: toUser(userDto) };
  } catch (error) {
    if (error instanceof Error && error.message === 'not_customer') {
      return { ok: false, status: 403, unreachable: false };
    }
    console.error('Laravel profile payload could not be mapped');
    return { ok: false, status: 503, unreachable: false };
  }
}

export type SessionResolveResult =
  | { status: 'authenticated'; user: User; tokens?: LaravelAuthTokensDto; remember: boolean }
  | { status: 'unauthenticated'; clear: boolean }
  /** `tokens`: a refresh already replaced the old ones; keep these. */
  | { status: 'unavailable'; tokens?: LaravelAuthTokensDto; remember?: boolean };

/**
 * The backend is busy or down, not saying "signed out": a timeout, a 5xx,
 * or 429 (every API route allows 60 requests a minute per customer).
 */
function isTemporaryProfileFailure(profile: { unreachable: boolean; status: number }): boolean {
  return profile.unreachable || profile.status >= 500 || profile.status === 429;
}

/**
 * Load the current customer from Laravel, refreshing the access token once on 401.
 * Never retries refresh after a second failure (no refresh loops).
 */
export async function resolveCustomerSession(jar: CookieJar): Promise<SessionResolveResult> {
  if (!jar.accessToken && !jar.refreshToken) {
    return { status: 'unauthenticated', clear: false };
  }

  if (jar.accessToken) {
    const profile = await fetchCustomerProfile(jar.accessToken);
    if (profile.ok) {
      return { status: 'authenticated', user: profile.user, remember: jar.remember };
    }
    if (isTemporaryProfileFailure(profile)) {
      return { status: 'unavailable' };
    }
    // 403 (not a customer account) and anything else unexpected end the session.
    if (profile.status !== 401) {
      return { status: 'unauthenticated', clear: true };
    }
  }

  if (!jar.refreshToken) {
    return { status: 'unauthenticated', clear: true };
  }

  const refreshed = await refreshAuthTokensDetailed(jar.refreshToken);
  if (!refreshed.ok) {
    return refreshed.temporary
      ? { status: 'unavailable' }
      : { status: 'unauthenticated', clear: true };
  }
  const rotated = refreshed.tokens;

  const profile = await fetchCustomerProfile(rotated.access_token);
  if (profile.ok) {
    return {
      status: 'authenticated',
      user: profile.user,
      tokens: rotated,
      remember: jar.remember,
    };
  }
  // The old refresh token is spent: dropping the new pair would sign the
  // customer out just because the backend was busy for a moment.
  if (isTemporaryProfileFailure(profile)) {
    return { status: 'unavailable', tokens: rotated, remember: jar.remember };
  }

  return { status: 'unauthenticated', clear: true };
}

export async function logoutLaravel(
  jar: CookieJar,
  deviceToken: string | null = null,
): Promise<void> {
  let access = jar.accessToken;
  let refresh = jar.refreshToken;

  if (!access && refresh) {
    const rotated = await refreshAuthTokens(refresh);
    if (rotated) {
      access = rotated.access_token;
      refresh = rotated.refresh_token;
    }
  }

  if (!access) return;

  const result = await laravelAuthFetch('/auth/logout', {
    method: 'POST',
    accessToken: access,
    body: {
      ...(refresh ? { refresh_token: refresh } : {}),
      // This browser's push token: the backend removes it with the session.
      ...(deviceToken ? { device_token: deviceToken } : {}),
    },
  });

  if (result.unreachable) {
    console.error('Laravel logout did not complete');
    return;
  }
  if (result.status >= 500) {
    console.error('Laravel logout did not complete', result.status);
  }
}

async function revokeLaravelSession(tokens: LaravelAuthTokensDto | undefined): Promise<void> {
  if (!tokens) return;
  await logoutLaravel({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    remember: false,
  });
}
