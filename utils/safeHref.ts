/**
 * Admin-supplied destinations that are safe to render as links.
 *
 * Internal storefront paths stay on Next.js `Link`. External http(s) and
 * contact schemes use a plain `<a>`. Rendered hrefs keep the administrator's
 * original (trimmed) spelling — they are not lowercased. Everything else is
 * rejected.
 */

export type SafeHref =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'contact'; href: string };

const CONTROL_OR_BACKSLASH = /[\u0000-\u001F\u007F\\]/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

export function safeHref(raw: string | null | undefined): SafeHref | null {
  if (typeof raw !== 'string') return null;

  const url = raw.trim();
  if (!url) return null;
  if (CONTROL_OR_BACKSLASH.test(url)) return null;
  if (url.startsWith('//')) return null;

  if (url.startsWith('/')) {
    return { kind: 'internal', href: url };
  }

  const match = SCHEME.exec(url);
  if (!match) return null;

  const scheme = match[1].toLowerCase();

  if (scheme === 'http' || scheme === 'https') {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return { kind: 'external', href: url };
    } catch {
      return null;
    }
  }

  if (scheme === 'mailto' || scheme === 'tel') {
    return { kind: 'contact', href: url };
  }

  return null;
}
