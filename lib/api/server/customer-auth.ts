import 'server-only';

import type { LaravelAuthTokensDto } from '@/types/api/auth';
import { apiBaseUrl } from './env';
import { readAuthCookieJar, refreshAuthTokensDetailed } from './auth';
import { getServerLanguage } from '@/lib/i18n/server';

const REQUEST_TIMEOUT_MS = 8000;

/**
 * For calls where the backend itself asks Thawani before answering: checkout
 * (opens a pay page), loading an unpaid order (it re-checks the payment),
 * confirm, retry and cancel. Thawani alone can take several seconds, so the
 * usual 8 s would give up on an answer that is on its way (the order may well
 * have been paid meanwhile).
 */
export const GATEWAY_REQUEST_TIMEOUT_MS = 20_000;

export type LaravelCustomerHttpResult =
  { unreachable: true } | { unreachable: false; status: number; data: unknown };

export type CustomerAuthAttempt = {
  result: LaravelCustomerHttpResult;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth: boolean;
};

/**
 * GET/POST/PATCH/DELETE `{API_BASE_URL}/api{path}` with a Bearer access token.
 * Does not log bodies or tokens.
 */
export async function laravelCustomerFetch(
  path: string,
  init: {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    /** JSON body, or a multipart `FormData` (file uploads). */
    body?: Record<string, unknown> | FormData;
    accessToken: string;
    /**
     * Language of the backend's texts (notifications, validation messages).
     * Defaults to the UI language. Pass `'en'` where the store recognises the
     * message itself and shows its own translation (e.g. profile errors).
     */
    acceptLanguage?: 'en' | 'ar';
    /** Defaults to 8 s; `GATEWAY_REQUEST_TIMEOUT_MS` where the backend calls Thawani. */
    timeoutMs?: number;
  },
): Promise<LaravelCustomerHttpResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': init.acceptLanguage ?? (await getServerLanguage()),
  };
  const isMultipart = init.body instanceof FormData;
  if (init.body !== undefined && !isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  headers.Authorization = `Bearer ${init.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api${path}`, {
      method: init.method,
      headers,
      body:
        init.body === undefined
          ? undefined
          : isMultipart
            ? (init.body as FormData)
            : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `Laravel customer ${init.method} ${path} unreachable`,
        error.name,
      );
    } else {
      console.error(`Laravel customer ${init.method} ${path} unreachable`);
    }
    return { unreachable: true };
  }

  let data: unknown;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      console.error(
        `Laravel customer ${init.method} ${path} returned non-JSON`,
        res.status,
      );
      data = undefined;
    }
  }

  if (!res.ok) {
    console.error(`Laravel customer ${init.method} ${path} failed`, res.status);
  }

  return { unreachable: false, status: res.status, data };
}

function jwtAccessExpired(token: string): boolean {
  try {
    const segment = token.split('.')[1];
    if (!segment) return true;
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp))
      return true;
    return payload.exp * 1000 <= Date.now() + 5000;
  } catch {
    return true;
  }
}

/**
 * Run an authenticated Laravel customer request, refreshing the access token once.
 * Reuses `refreshAuthTokensDetailed` — does not implement a second token flow.
 * A throttled or failed refresh answers "unreachable" and keeps the session.
 */
export async function withCustomerAuth(
  execute: (accessToken: string) => Promise<LaravelCustomerHttpResult>,
): Promise<CustomerAuthAttempt> {
  const jar = await readAuthCookieJar();
  if (!jar.accessToken && !jar.refreshToken) {
    return {
      result: { unreachable: false, status: 401, data: undefined },
      remember: jar.remember,
      clearAuth: false,
    };
  }

  let access = jar.accessToken;
  let rotated: LaravelAuthTokensDto | undefined;
  let refreshed = false;

  // 'temporary' = refresh throttled or backend down: keep the session.
  const rotate = async (): Promise<'ok' | 'rejected' | 'temporary'> => {
    if (!jar.refreshToken) return 'rejected';
    const outcome = await refreshAuthTokensDetailed(jar.refreshToken);
    refreshed = true;
    if (!outcome.ok) return outcome.temporary ? 'temporary' : 'rejected';
    rotated = outcome.tokens;
    access = rotated.access_token;
    return 'ok';
  };

  const failedRotation = (
    outcome: 'rejected' | 'temporary',
  ): CustomerAuthAttempt =>
    outcome === 'temporary'
      ? { result: { unreachable: true }, remember: jar.remember, clearAuth: false }
      : {
          result: { unreachable: false, status: 401, data: undefined },
          remember: jar.remember,
          clearAuth: true,
        };

  if (!access || jwtAccessExpired(access)) {
    const outcome = await rotate();
    if (outcome !== 'ok') return failedRotation(outcome);
  }

  let result = await execute(access as string);

  if (
    !result.unreachable &&
    result.status === 401 &&
    !refreshed &&
    jar.refreshToken
  ) {
    const outcome = await rotate();
    if (outcome !== 'ok') return failedRotation(outcome);
    result = await execute(access as string);
  }

  if (!result.unreachable && result.status === 401) {
    return {
      result,
      remember: jar.remember,
      clearAuth: true,
    };
  }

  return {
    result,
    rotatedTokens: rotated,
    remember: jar.remember,
    clearAuth: false,
  };
}
