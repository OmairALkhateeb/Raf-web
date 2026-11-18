import 'server-only';

import type { BundleItemView, BundleView } from '@/types';
import type { PublicBundleDto, PublicBundleItemDto } from '@/types/api/bundle';
import { resolveMediaUrl } from '@/lib/api/server/media';
import { PLACEHOLDER_MEDIA } from '@/lib/mappers/product';

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function money(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toItem(dto: PublicBundleItemDto): BundleItemView | null {
  const name = text(dto?.product_name);
  const quantity = Number(dto?.quantity);
  if (!dto || typeof dto.id !== 'number' || !name || !Number.isInteger(quantity) || quantity < 1) {
    return null;
  }
  return {
    id: dto.id,
    productName: name,
    productNameAr: text(dto.product_name_ar),
    productSlug: text(dto.product_slug),
    imageUrl: resolveMediaUrl(dto.image_url) ?? PLACEHOLDER_MEDIA,
    variantId: typeof dto.variant_id === 'number' ? dto.variant_id : null,
    variantLabel: text(dto.variant_label),
    variantLabelAr: text(dto.variant_label_ar),
    quantity,
    unitPrice: money(dto.unit_price),
  };
}

/** `null` when the row can't be shown without inventing a name or price. */
export function toBundle(dto: PublicBundleDto): BundleView | null {
  const name = text(dto?.name);
  const slug = text(dto?.slug);
  const bundlePrice = money(dto?.bundle_price);
  if (!dto || typeof dto.id !== 'number' || !name || !slug || bundlePrice === null) return null;

  const items = (Array.isArray(dto.items) ? dto.items : [])
    .map(toItem)
    .filter((item): item is BundleItemView => item !== null);
  const firstItemImage = items.find((item) => item.imageUrl !== PLACEHOLDER_MEDIA)?.imageUrl;
  const comparePrice = money(dto.compare_price);
  const savings = money(dto.savings);

  return {
    id: dto.id,
    slug,
    name,
    nameAr: text(dto.name_ar),
    description: text(dto.description),
    descriptionAr: text(dto.description_ar),
    bundlePrice,
    comparePrice: comparePrice !== null && comparePrice > bundlePrice ? comparePrice : null,
    savings: savings !== null && savings > 0 ? savings : null,
    isGiftSet: dto.is_gift_set === true,
    imageUrl: resolveMediaUrl(dto.image_url) ?? firstItemImage ?? PLACEHOLDER_MEDIA,
    inStock: dto.in_stock === true,
    items,
  };
}

export function toBundles(dtos: unknown): BundleView[] {
  if (!Array.isArray(dtos)) return [];
  return dtos
    .map((dto) => toBundle(dto as PublicBundleDto))
    .filter((bundle): bundle is BundleView => bundle !== null);
}
