import 'server-only';

import { apiBaseUrl } from './env';

const REQUEST_TIMEOUT_MS = 8000;
const DEVICE_NAME = 'raf-storefront';

export type LaravelAuthHttpResult =
  | { unreachable: true }
  | { unreachable: false; status: number; data: unknown };

export function authDeviceName(): string {
  return DEVICE_NAME;
}

/**
 * POST/GET `{API_BASE_URL}/api{path}`. Does not log bodies, passwords, or tokens.
 */
export async function laravelAuthFetch(
  path: string,
  init: {
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
    accessToken?: string;
    /**
     * Default English: `lib/auth/messages.ts` and `lib/mappers/auth.ts` match
     * these texts. Registration asks in the UI language and shows the
     * backend's field messages as they are.
     */
    acceptLanguage?: 'en' | 'ar';
  },
): Promise<LaravelAuthHttpResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': init.acceptLanguage ?? 'en',
  };
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (init.accessToken) {
    headers.Authorization = `Bearer ${init.accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Laravel auth ${init.method} ${path} unreachable`, error.name);
    } else {
      console.error(`Laravel auth ${init.method} ${path} unreachable`);
    }
    return { unreachable: true };
  }

  let data: unknown;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      console.error(`Laravel auth ${init.method} ${path} returned non-JSON`, res.status);
      data = undefined;
    }
  }

  if (!res.ok) {
    console.error(`Laravel auth ${init.method} ${path} failed`, res.status);
  }

  return { unreachable: false, status: res.status, data };
}
