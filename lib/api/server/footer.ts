import 'server-only';

import type { FooterLinkDto, FooterLinkGroups } from '@/types/api/footer';
import { apiGet, isTransportFailure } from './http';

const FOOTER_REVALIDATE_SECONDS = 300;
const FOOTER_CACHE_TAG = 'footer-links';

function isFooterLink(value: unknown): value is FooterLinkDto {
  if (!value || typeof value !== 'object') return false;
  const link = value as FooterLinkDto;
  return (
    typeof link.id === 'number' &&
    typeof link.group === 'string' &&
    typeof link.label === 'string' &&
    typeof link.url === 'string' &&
    typeof link.sort_order === 'number' &&
    typeof link.is_active === 'boolean'
  );
}

function normalizeGroup(links: unknown): FooterLinkDto[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter(isFooterLink)
    .filter(link => link.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

/**
 * Laravel returns `[]` when the collection is empty and a grouped object when
 * records exist. Both are success. `null` is reserved for transport failure.
 */
function normalizeFooterLinks(payload: unknown): FooterLinkGroups {
  if (payload == null || (Array.isArray(payload) && payload.length === 0)) {
    return {};
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const groups: FooterLinkGroups = {};
  for (const [key, value] of Object.entries(payload)) {
    const links = normalizeGroup(value);
    if (links.length > 0) groups[key] = links;
  }
  return groups;
}

/**
 * GET /api/public/footer-links
 * Returns `null` on transport failure. An empty collection is `{}`.
 */
export async function fetchFooterLinks(): Promise<FooterLinkGroups | null> {
  try {
    const payload = await apiGet<FooterLinkGroups | FooterLinkDto[]>('/public/footer-links', {
      revalidate: FOOTER_REVALIDATE_SECONDS,
      tags: [FOOTER_CACHE_TAG],
    });
    return normalizeFooterLinks(payload);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[footer] failed to load /api/public/footer-links', error);
    return null;
  }
}
