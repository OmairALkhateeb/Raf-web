import type { SafeHref } from '@/utils/safeHref';

/**
 * lucide-react 1.x ships no brand logos. Hostnames pick the closest existing
 * icon; unknown hosts use Globe.
 */

export type SocialIconKind =
  | 'instagram'
  | 'whatsapp'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'youtube'
  | 'telegram'
  | 'globe';

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

export function socialIconKind(dest: SafeHref): SocialIconKind {
  if (dest.kind !== 'external') return 'globe';

  const host = hostnameOf(dest.href);
  if (!host) return 'globe';

  if (hostMatches(host, 'instagram.com') || hostMatches(host, 'instagr.am')) {
    return 'instagram';
  }
  if (hostMatches(host, 'whatsapp.com') || host === 'wa.me' || host.endsWith('.wa.me')) {
    return 'whatsapp';
  }
  if (
    hostMatches(host, 'facebook.com') ||
    hostMatches(host, 'fb.com') ||
    hostMatches(host, 'fb.me')
  ) {
    return 'facebook';
  }
  if (hostMatches(host, 'twitter.com') || hostMatches(host, 'x.com')) {
    return 'twitter';
  }
  if (hostMatches(host, 'linkedin.com') || hostMatches(host, 'lnkd.in')) {
    return 'linkedin';
  }
  if (
    hostMatches(host, 'youtube.com') ||
    hostMatches(host, 'youtu.be') ||
    hostMatches(host, 'youtube-nocookie.com')
  ) {
    return 'youtube';
  }
  if (
    hostMatches(host, 'telegram.org') ||
    hostMatches(host, 'telegram.me') ||
    host === 't.me' ||
    host.endsWith('.t.me')
  ) {
    return 'telegram';
  }

  return 'globe';
}
