/**
 * Laravel CMS page keys allowed on `/{key}`, `/pages/{key}`, and Footer links.
 *
 * Reserved-route limitation: static storefront segments (`/products`,
 * `/brands`, `/account`, `/faq`, …) always win over `app/[key]`. A CMS key
 * that collides with an existing route cannot take over that URL.
 */
export const SAFE_CMS_PAGE_KEY_PATTERN = /^[a-z0-9_-]{1,100}$/;

export function isSafeCmsPageKey(value: string): boolean {
  return SAFE_CMS_PAGE_KEY_PATTERN.test(value);
}

/**
 * Exactly `/pages/{safe-key}` — one segment, no extra path parts.
 * Use a case-preserved pathname (query/hash/trailing slash already stripped).
 */
export function isSafeCmsPagePath(pathname: string): boolean {
  if (!pathname.startsWith('/pages/')) return false;
  const key = pathname.slice('/pages/'.length);
  return key.length > 0 && !key.includes('/') && isSafeCmsPageKey(key);
}
