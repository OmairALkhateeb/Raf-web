import 'server-only';

import { apiBaseUrl } from './env';

/**
 * The home payload mixes two conventions: Laravel API Resources emit fully
 * qualified `*_url` values, while the raw Eloquent sections (hero banners,
 * featured categories) emit storage-relative `image_path` values. This resolves
 * both to something `next/image` can accept, or to `null` when it cannot.
 */
export function resolveMediaUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  // Protocol-relative points at an unknown host and would fail remotePatterns.
  if (raw.startsWith('//')) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).toString();
    } catch {
      return null;
    }
  }

  // Any other scheme (javascript:, data:, file:, …) is rejected outright.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;

  const path = raw.replace(/^\/+/, '').replace(/^storage\//, '');
  if (!path) return null;

  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${apiBaseUrl()}/storage/${encoded}`;
}
