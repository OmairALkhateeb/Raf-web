import type { FooterLinkDto, FooterLinkGroups } from '@/types/api/footer';
import {
  FOOTER_GROUP_CONTACT_LINKS,
  FOOTER_GROUP_CUSTOMER_SERVICE,
  FOOTER_GROUP_SOCIAL_LINKS,
} from '@/types/api/footer';
import { safeHref } from '@/utils/safeHref';

/**
 * Partition GET /api/public/footer-links for the storefront Footer.
 *
 * Laravel returns active rows ordered by `sort_order`, then `groupBy('group')`.
 * Group is free text (no enum, no localized title, no group-level sort).
 * A richer backend contract (group type, translated title, group order) is
 * required before the storefront can treat headings as first-class i18n.
 */

const ASCII_MACHINE_KEY = /^[a-z][a-z0-9_-]*$/i;

export type FooterExtraGroup = {
  group: string;
  links: FooterLinkDto[];
};

export type PartitionedFooterGroups = {
  customerService: FooterLinkDto[];
  socialLinks: FooterLinkDto[];
  contactLinks: FooterLinkDto[];
  extraGroups: FooterExtraGroup[];
};

/** Exact destination identity after validation — no case folding. */
function destinationIdentity(url: string): string | null {
  const dest = safeHref(url);
  return dest ? dest.href : null;
}

/**
 * Drop unsafe/malformed URLs. Deduplicate only exact destinations inside
 * one group. Cross-section duplicates are kept (admin chose the group).
 */
export function safeFooterLinks(links: FooterLinkDto[] | undefined): FooterLinkDto[] {
  if (!links?.length) return [];

  const seen = new Set<string>();
  const out: FooterLinkDto[] = [];

  for (const link of links) {
    const identity = destinationIdentity(link.url);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    out.push(link);
  }

  return out;
}

/**
 * Heading for extra groups. Arabic and other non-machine text is preserved.
 * Safe English keys such as `company_links` become `Company Links`.
 * The group string is never treated as HTML.
 */
export function footerGroupHeading(group: string): string {
  const name = group.trim();
  if (!name) return '';
  if (!ASCII_MACHINE_KEY.test(name)) return name;

  return name
    .split(/[_-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function partitionFooterGroups(groups: FooterLinkGroups): PartitionedFooterGroups {
  const customerService = safeFooterLinks(groups[FOOTER_GROUP_CUSTOMER_SERVICE]);
  const socialLinks = safeFooterLinks(groups[FOOTER_GROUP_SOCIAL_LINKS]);
  const contactLinks = safeFooterLinks(groups[FOOTER_GROUP_CONTACT_LINKS]);
  const extraGroups: FooterExtraGroup[] = [];

  for (const [group, links] of Object.entries(groups)) {
    if (
      group === FOOTER_GROUP_CUSTOMER_SERVICE ||
      group === FOOTER_GROUP_SOCIAL_LINKS ||
      group === FOOTER_GROUP_CONTACT_LINKS
    ) {
      continue;
    }
    const safe = safeFooterLinks(links);
    if (safe.length === 0) continue;
    extraGroups.push({ group, links: safe });
  }

  return { customerService, socialLinks, contactLinks, extraGroups };
}
