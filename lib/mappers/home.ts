import 'server-only';

import type { Banner, Category } from '@/types';
import type { FeaturedCategoryDto, HeroBannerDto } from '@/types/api/home';
import { resolveMediaUrl } from '@/lib/api/server/media';
import { toPlacementBanners } from '@/lib/mappers/banner';
import { PLACEHOLDER_MEDIA } from '@/lib/mappers/product';

export { PLACEHOLDER_MEDIA, toBestsellers, toNewArrivals, toPinnedProducts, toProduct } from '@/lib/mappers/product';
export { toBrand } from '@/lib/mappers/brand';

/**
 * Maps the Laravel home payload onto the existing UI types.
 *
 * Since 08/10/2026 `hero_banners` is the same `BannerResource` as
 * GET /public/banners (Arabic texts, link type, button text). The home page
 * loads the hero from /public/banners (60 s cache, for start/end dates) and
 * uses these rows only when that call fails.
 */

export function toBanners(dtos: HeroBannerDto[], storeHost: string | null): Banner[] {
  return toPlacementBanners(dtos, 'homepage_hero', storeHost);
}

export function toCategory(dto: FeaturedCategoryDto): Category {
  const nameAr = typeof dto.name_ar === 'string' && dto.name_ar.trim() ? dto.name_ar.trim() : undefined;
  return {
    id: String(dto.id),
    slug: dto.slug,
    name: dto.name,
    ...(nameAr ? { nameAr } : {}),
    image: resolveMediaUrl(dto.image_url ?? dto.image_path ?? null) ?? PLACEHOLDER_MEDIA,
    icon: '',
    ...(typeof dto.products_count === 'number' ? { productCount: dto.products_count } : {}),
    featured: true,
  };
}
