import 'server-only';

import type { Banner, BannerLinkType, BannerPlacement, BannerTarget } from '@/types';
import type { BannerPlacementDto, PublicBannerDto } from '@/types/api/banner';
import { resolveMediaUrl } from '@/lib/api/server/media';
import { ar } from '@/utils/locales/ar';
import { en } from '@/utils/locales/en';

const PLACEMENTS: Record<BannerPlacementDto, BannerPlacement> = {
  homepage_hero: 'home_hero',
  promotion: 'promotion',
  category_page: 'category_page',
  footer: 'footer',
};

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * The banner's destination: a store path for links to this site, an external
 * URL otherwise, or `null` (not clickable) when there's no usable link.
 * Only http(s) and site-relative paths are accepted.
 */
export function resolveBannerLink(
  raw: string | null | undefined,
  storeHost: string | null,
): { href: string | null; external: boolean } {
  const value = raw?.trim();
  if (!value || value.startsWith('//')) return { href: null, external: false };
  if (value.startsWith('/')) return { href: value, external: false };
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { href: null, external: false };
    }
    if (storeHost && url.host.toLowerCase() === storeHost.toLowerCase()) {
      return { href: `${url.pathname}${url.search}${url.hash}` || '/', external: false };
    }
    return { href: url.toString(), external: true };
  } catch {
    return { href: null, external: false };
  }
}

/**
 * The banner's destination from `link_type` + `target` (backend guide B4).
 * A missing slug (e.g. a deleted product) or a `null` type: not clickable.
 */
function bannerDestination(
  dto: PublicBannerDto,
  storeHost: string | null,
): { linkType: BannerLinkType; target: BannerTarget; href: string | null; external: boolean } {
  const target = dto.target ?? null;
  const slug = (value: string | null | undefined) => text(value ?? undefined);
  const internal = (linkType: BannerLinkType, href: string | null, extra: BannerTarget) => ({
    linkType,
    target: extra,
    href,
    external: false,
  });

  // An offer banner lists its products (frontend guide §7).
  const offerIds = (Array.isArray(dto.product_ids) ? dto.product_ids : []).filter(
    (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
  );
  if (offerIds.length > 0) {
    return internal('product_listing', `/products?ids=${offerIds.slice(0, 50).join(',')}`, {});
  }

  // Older API without `link_type`: only `link_url` exists.
  if (dto.link_type === undefined) {
    const link = resolveBannerLink(dto.link_url, storeHost);
    return { linkType: 'custom_url', target: {}, ...link };
  }

  switch (dto.link_type) {
    case 'category': {
      const value = slug(target?.category_slug);
      return internal('category', value ? `/products?category=${encodeURIComponent(value)}` : null, { categorySlug: value });
    }
    case 'brand': {
      const value = slug(target?.brand_slug);
      return internal('brand', value ? `/brands/${encodeURIComponent(value)}` : null, { brandSlug: value });
    }
    case 'product': {
      const value = slug(target?.product_slug);
      return internal('product', value ? `/products/${encodeURIComponent(value)}` : null, { productSlug: value });
    }
    case 'search': {
      const value = slug(target?.search_query);
      return internal('search', value ? `/products?search=${encodeURIComponent(value)}` : null, { searchQuery: value });
    }
    case 'product_listing':
      return internal('product_listing', '/products', {});
    case 'custom': {
      const link = resolveBannerLink(target?.url ?? dto.link_url, storeHost);
      return { linkType: 'custom_url', target: {}, ...link };
    }
    default:
      return { linkType: 'custom_url', target: {}, href: null, external: false };
  }
}

/** Banners without an image are dropped rather than rendered broken. */
export function toPlacementBanners(
  dtos: PublicBannerDto[],
  placement: BannerPlacementDto,
  storeHost: string | null,
): Banner[] {
  const banners: Banner[] = [];
  for (const dto of dtos) {
    const image = resolveMediaUrl(dto?.image_url ?? null);
    const title = text(dto?.title);
    if (!dto || typeof dto.id !== 'number' || !image || !title) continue;
    const destination = bannerDestination(dto, storeHost);
    banners.push({
      id: String(dto.id),
      placement: PLACEMENTS[placement],
      title,
      titleAr: text(dto.title_ar),
      subtitle: text(dto.subtitle) ?? '',
      subtitleAr: text(dto.subtitle_ar),
      // The admin's button text, else the store's "Shop now" per language.
      buttonText: text(dto.button_text) ?? en.hero.shopNow,
      buttonTextAr: text(dto.button_text_ar) ?? ar.hero.shopNow,
      imageDesktop: image,
      imageMobile: image,
      linkType: destination.linkType,
      target: destination.target,
      href: destination.href,
      external: destination.external,
      ...(text(dto.description) ? { description: text(dto.description) } : {}),
      ...(text(dto.description_ar) ? { descriptionAr: text(dto.description_ar) } : {}),
      ...(text(dto.ends_at) ? { endsAt: text(dto.ends_at) } : {}),
    });
  }
  return banners;
}
