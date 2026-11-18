import { Banner } from '@/types';

/**
 * Resolve a banner's click target into an internal (relative) route.
 * Banners are never dead images — every one routes to related content.
 *
 * There is no click tracking: the backend has no click endpoint.
 */

/**
 * Accept admin-supplied destinations that are safe to navigate to: same-origin
 * relative paths, and fully qualified http(s) URLs. Protocol-relative (//evil)
 * and dangerous schemes (javascript:, data:, …) are rejected.
 */
function safeInternalUrl(url: string | undefined, fallback = '/'): string {
  if (!url) return fallback;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('//')) return fallback;
  if (trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function filtersToQuery(filters: Record<string, string | number> | undefined): string {
  if (!filters) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Where a banner goes; `null` = not clickable. */
export function bannerHref(banner: Banner): string | null {
  // API banners carry a link resolved on the server.
  if (banner.href !== undefined) return banner.href;
  const t = banner.target ?? {};
  switch (banner.linkType) {
    case 'category':
      return t.categorySlug ? `/products?category=${encodeURIComponent(t.categorySlug)}` : '/products';
    case 'brand':
      return t.brandSlug ? `/brands/${encodeURIComponent(t.brandSlug)}` : '/brands';
    case 'product':
      return t.productSlug ? `/products/${encodeURIComponent(t.productSlug)}` : '/products';
    case 'product_listing':
      if (t.url) return safeInternalUrl(t.url, '/products');
      return `/products${filtersToQuery(t.filters)}`;
    case 'search':
      return t.searchQuery ? `/products?search=${encodeURIComponent(t.searchQuery)}` : '/products';
    case 'custom_url':
      return safeInternalUrl(t.url, '/');
    default:
      return '/';
  }
}
