import 'server-only';

import { headers } from 'next/headers';

function normalizedOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The store's public origin for canonical URLs, the sitemap and JSON-LD.
 * `SITE_URL` (e.g. `https://raf.om`) wins; on Vercel the production domain is
 * used; otherwise the request's own host (local development).
 */
export async function siteOrigin(): Promise<string> {
  const configured =
    normalizedOrigin(process.env.SITE_URL) ??
    normalizedOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (configured) return configured;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get('x-forwarded-proto') ?? (local ? 'http' : 'https');
  return normalizedOrigin(`${proto}://${host}`) ?? 'http://localhost:3000';
}

/** An absolute URL on this store for a path such as `/products/oud-noir`. */
export function absoluteUrl(origin: string, path: string): string {
  return new URL(path, `${origin}/`).toString();
}
