import 'server-only';

/** Server-only configuration for the Laravel backend. */

const RAW = (process.env.API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Origin of the Laravel application, e.g. `http://127.0.0.1:8000`.
 * Both `/api/...` and `/storage/...` hang off it.
 *
 * A missing value is a configuration error, not a runtime failure to absorb.
 */
export function apiBaseUrl(): string {
  if (!RAW) {
    throw new Error(
      'API_BASE_URL is not set. Add it to .env.local, e.g. API_BASE_URL=http://127.0.0.1:8000',
    );
  }
  return RAW;
}
