import 'server-only';

import type { PublicMerchantDto } from '@/types/api/merchant';
import type { ProductMerchantDto } from '@/types/api/product';
import type { SellerStore, SellerStoreCategory } from '@/types';
import { resolveMediaUrl } from '@/lib/api/server/media';

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function wholeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * The `/sellers/{…}` path segment for a product's merchant: its slug, or its
 * numeric id (the store endpoint accepts both) when an older payload has no slug.
 */
export function sellerStoreKey(merchant: ProductMerchantDto | null | undefined): string | undefined {
  if (!merchant) return undefined;
  const slug = text(merchant.slug);
  if (slug) return slug;
  return Number.isInteger(merchant.id) && merchant.id > 0 ? String(merchant.id) : undefined;
}

export function sellerLogo(merchant: ProductMerchantDto | null | undefined): string | undefined {
  return resolveMediaUrl(merchant?.logo_url) ?? undefined;
}

/** Throws when the store can't be shown at all (no id, name or slug). */
export function toSellerStore(dto: PublicMerchantDto): SellerStore {
  const name = text(dto?.name);
  const slug = text(dto?.slug);
  if (!dto || !Number.isInteger(dto.id) || !name || !slug) {
    throw new Error('Invalid merchant payload: id, name and slug are required');
  }

  const rating = Number(dto.average_rating);
  const joinedAt = text(dto.joined_at);

  const categories: SellerStoreCategory[] = [];
  const seen = new Set<number>();
  for (const category of Array.isArray(dto.categories) ? dto.categories : []) {
    const categoryName = text(category?.name);
    const categorySlug = text(category?.slug);
    if (!Number.isInteger(category?.id) || !categoryName || !categorySlug || seen.has(category.id)) continue;
    seen.add(category.id);
    categories.push({
      id: category.id,
      slug: categorySlug,
      name: categoryName,
      nameAr: text(category.name_ar),
      parentId: Number.isInteger(category.parent_id) ? category.parent_id : null,
    });
  }

  return {
    id: String(dto.id),
    slug,
    name,
    logo: resolveMediaUrl(dto.logo_url) ?? undefined,
    description: text(dto.description),
    city: text(dto.city),
    productCount: wholeNumber(dto.products_count),
    rating: Number.isFinite(rating) && rating > 0 ? Math.min(rating, 5) : 0,
    reviewCount: wholeNumber(dto.reviews_count),
    joinedAt: joinedAt && !Number.isNaN(Date.parse(joinedAt)) ? joinedAt : undefined,
    categories,
  };
}
