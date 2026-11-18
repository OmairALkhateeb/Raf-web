import type { FooterLinkDto } from '@/types/api/footer';
import { contactIconKind } from '@/lib/footer/contact';
import { safeFooterLinks } from '@/lib/footer/nav';
import { safeHref } from '@/utils/safeHref';

/**
 * Contact details the admin manages as footer `contact_links`. Any missing
 * entry falls back to the official details in the dictionary.
 */
export interface ContactDetails {
  phone: { display: string; href: string } | null;
  email: { display: string; href: string } | null;
  address: { label: string; labelAr: string | null; href: string } | null;
}

/** `+96896919896` → `+968 9691 9896`; other numbers stay as they are. */
export function formatContactPhone(raw: string): string {
  const digits = raw.replace(/[\s-]/g, '');
  const oman = /^\+968(\d{4})(\d{4})$/.exec(digits);
  return oman ? `+968 ${oman[1]} ${oman[2]}` : raw.trim();
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** `tel:+96896919896` → `+968 9691 9896`; `null` for anything else. */
export function phoneFromTelHref(href: string): string | null {
  if (!/^tel:/i.test(href)) return null;
  const number = decode(href.replace(/^tel:/i, '')).trim();
  return number ? formatContactPhone(number) : null;
}

export function contactDetailsFromLinks(links: FooterLinkDto[] | undefined): ContactDetails {
  const details: ContactDetails = { phone: null, email: null, address: null };
  for (const link of safeFooterLinks(links)) {
    const dest = safeHref(link.url);
    if (!dest) continue;
    const kind = contactIconKind(dest);
    if (kind === 'phone' && !details.phone) {
      const display = phoneFromTelHref(dest.href);
      if (display) details.phone = { display, href: dest.href };
    } else if (kind === 'mail' && !details.email) {
      const address = decode(dest.href.replace(/^mailto:/i, '').split('?')[0]).trim();
      if (address) details.email = { display: address, href: dest.href };
    } else if (kind === 'map' && !details.address) {
      details.address = {
        label: link.label,
        labelAr: link.label_ar?.trim() || null,
        href: dest.href,
      };
    }
  }
  return details;
}
