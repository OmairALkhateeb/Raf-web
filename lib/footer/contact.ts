import type { SafeHref } from '@/utils/safeHref';

/**
 * Icons for Footer `contact_links`. Scheme and map hosts only — never derived
 * from the CMS key, Footer group, or label.
 */
export type ContactIconKind = 'phone' | 'mail' | 'map' | 'link';

function hostnameOf(href: string): string | null {
  try {
    const host = new URL(href).hostname.replace(/^www\./i, '').toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function isGoogleMapsHost(host: string): boolean {
  return (
    host === 'google.com' ||
    host.endsWith('.google.com') ||
    /^google\.[a-z]{2,}$/i.test(host) ||
    /^google\.[a-z]{2,}\.[a-z]{2}$/i.test(host)
  );
}

/** Safe HTTP(S) map / location destinations (Google Maps, OSM, Apple, Waze, …). */
export function isMapOrLocationHref(href: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return false;
  }

  const host = hostnameOf(href);
  if (!host) return false;

  const path = parsed.pathname.toLowerCase();

  if (host.startsWith('maps.') || host.includes('.maps.')) return true;
  if (host === 'goo.gl' && (path === '/maps' || path.startsWith('/maps/'))) return true;
  if (isGoogleMapsHost(host) && (path === '/maps' || path.startsWith('/maps/'))) return true;
  if (hostMatches(host, 'openstreetmap.org') || hostMatches(host, 'osm.org')) return true;
  if (hostMatches(host, 'bing.com') && (path === '/maps' || path.startsWith('/maps/'))) {
    return true;
  }
  if (hostMatches(host, 'waze.com')) return true;
  if (hostMatches(host, 'mapbox.com')) return true;

  return false;
}

export function contactIconKind(dest: SafeHref): ContactIconKind {
  if (dest.kind === 'contact') {
    if (/^tel:/i.test(dest.href)) return 'phone';
    if (/^mailto:/i.test(dest.href)) return 'mail';
    return 'link';
  }

  if (dest.kind === 'external' && isMapOrLocationHref(dest.href)) {
    return 'map';
  }

  return 'link';
}
