import 'server-only';

import { apiBaseUrl } from './env';

const REQUEST_TIMEOUT_MS = 8000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
    readonly body?: unknown,
    /** Seconds from a 429's `Retry-After` header, when Laravel sent one. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** `Retry-After` in seconds (Laravel's throttle sends a number), if present. */
export function readRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('Retry-After');
  if (!raw) return undefined;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/**
 * Either uncached (`no-store`) or tagged ISR. Combining `revalidate` with
 * `cache: 'no-store'` is rejected by Next.js and both options are ignored.
 */
export type ApiGetOptions =
  | { cache: 'no-store' }
  | { revalidate: number; tags: string[] };

/** GET `{API_BASE_URL}/api{path}` and decode the JSON body. */
export async function apiGet<T>(path: string, options: ApiGetOptions): Promise<T> {
  const init: RequestInit & { next?: { revalidate: number; tags: string[] } } = {
    // English: the store translates public errors itself (e.g. the contact form).
    headers: { Accept: 'application/json', 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if ('cache' in options) {
    init.cache = options.cache;
  } else {
    init.next = { revalidate: options.revalidate, tags: options.tags };
  }

  const res = await fetch(`${apiBaseUrl()}/api${path}`, init);

  if (!res.ok) {
    throw new ApiError(res.status, path, `API ${res.status} ${res.statusText} for ${path}`);
  }

  return (await res.json()) as T;
}

/** POST `{API_BASE_URL}/api{path}` with a JSON body and decode the JSON response. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}/api${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = undefined;
    }
    throw new ApiError(
      res.status,
      path,
      `API ${res.status} ${res.statusText} for ${path}`,
      errorBody,
      readRetryAfter(res),
    );
  }

  return (await res.json()) as T;
}

/**
 * True only for failures we expect from a remote service: a non-2xx response,
 * a network-level fetch rejection, an unparseable body, or a timeout/abort.
 *
 * Anything else is a bug in our own code and must keep propagating rather than
 * being downgraded into an empty page.
 */
export function isTransportFailure(error: unknown): boolean {
  if (error instanceof ApiError) return true;
  if (error instanceof TypeError) return true;
  if (error instanceof SyntaxError) return true;
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return true;
  }
  return false;
}
