import 'server-only';

import type { Brand } from '@/types';
import type { PublicBrandDto } from '@/types/api/brand';
import { resolveMediaUrl } from '@/lib/api/server/media';
import { optionalText } from '@/lib/mappers/product';

/**
 * Throws when a brand row cannot be mapped without fabricating values.
 * Directory, catalog and home treat any throw as a mapping failure.
 */
export function assertMappableBrand(dto: PublicBrandDto): void {
  if (typeof dto.id !== 'number' || !Number.isFinite(dto.id)) {
    throw new Error('Brand is missing a usable id');
  }
  if (!dto.name || typeof dto.name !== 'string') {
    throw new Error(`Brand ${dto.id} is missing a usable name`);
  }
  if (!dto.slug || typeof dto.slug !== 'string') {
    throw new Error(`Brand ${dto.id} is missing a usable slug`);
  }
  if (!Number.isFinite(Number(dto.products_count))) {
    throw new Error(`Brand ${dto.id} has a non-finite products_count`);
  }
}

export function toBrand(dto: PublicBrandDto, options?: { featured?: boolean }): Brand {
  assertMappableBrand(dto);

  const country = dto.country?.trim();

  return {
    id: String(dto.id),
    slug: dto.slug,
    name: dto.name,
    nameAr: optionalText(dto.name_ar),
    logo: resolveMediaUrl(dto.logo_url) ?? undefined,
    banner: resolveMediaUrl(dto.cover_image_url) ?? undefined,
    description: dto.description ?? '',
    descriptionAr: optionalText(dto.description_ar),
    // Preserve the returned value (e.g. `OM`). Empty when the API sends null.
    origin: country || '',
    featured: options?.featured ?? true,
    productCount: Number(dto.products_count),
    categorySlugs: Array.isArray(dto.categories)
      ? dto.categories
          .map((category) => (typeof category?.slug === 'string' ? category.slug.trim() : ''))
          .filter(Boolean)
      : undefined,
  };
}
