import 'server-only';

import type {
  Product,
  ProductDetail,
  ProductDetailAttribute,
  ProductDetailReview,
  ProductDetailSpecification,
  ProductDetailVariant,
  ProductGalleryImage,
} from '@/types';
import type {
  ProductMediaDto,
  ProductVariantDto,
  PublicProductDetailDto,
  PublicProductDto,
  PublicProductReviewDto,
} from '@/types/api/product';
import { resolveMediaUrl } from '@/lib/api/server/media';
import { sellerLogo, sellerStoreKey } from '@/lib/mappers/merchant';

/** Language-neutral local asset. Never a remote or fabricated product image. */
export const PLACEHOLDER_MEDIA = '/images/placeholder-media.svg';

/** Trimmed text, or `undefined` for null/blank (an Arabic field not written yet). */
export function optionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * `image_url` is derived from the primary media row, which is normally also
 * present in `images[]`, so the combined list is deduped to avoid a repeated
 * first frame. Order is preserved: primary first, then `sort_order`.
 */
function toProductImages(dto: PublicProductDto): string[] {
  const ordered = [...dto.images].sort((a, b) => a.sort_order - b.sort_order);
  const candidates = [dto.image_url, ...ordered.map(media => media.url)];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const url = resolveMediaUrl(candidate);
    if (url) seen.add(url);
  }

  return seen.size > 0 ? Array.from(seen) : [PLACEHOLDER_MEDIA];
}

/**
 * Throws when a listing row cannot be mapped without fabricating values.
 * Catalog treats any throw as a whole-payload data-error (no silent row drop).
 */
export function assertMappableProduct(dto: PublicProductDto): void {
  if (!dto.brand || typeof dto.brand.id !== 'number' || !dto.brand.name || !dto.brand.slug) {
    throw new Error(`Product ${dto.id} is missing a usable brand relation`);
  }
  if (!dto.category || typeof dto.category.id !== 'number' || !dto.category.name || !dto.category.slug) {
    throw new Error(`Product ${dto.id} is missing a usable category relation`);
  }
  if (!Number.isFinite(Number(dto.effective_price))) {
    throw new Error(`Product ${dto.id} has a non-finite effective_price`);
  }
  if (!Array.isArray(dto.images)) {
    throw new Error(`Product ${dto.id} is missing an images array`);
  }
}

export function toProduct(dto: PublicProductDto): Product {
  return {
    id: String(dto.id),
    slug: dto.slug,
    name: dto.name,
    // Arabic falls back to English in the components when it's missing.
    nameAr: optionalText(dto.name_ar),
    brand: dto.brand.name,
    brandAr: optionalText(dto.brand.name_ar),
    brandId: String(dto.brand.id),
    brandSlug: dto.brand.slug,
    category: dto.category.name,
    categoryAr: optionalText(dto.category.name_ar),
    categoryId: String(dto.category.id),
    price: Number(dto.effective_price),
    originalPrice: dto.is_on_sale ? Number(dto.price) : undefined,
    currency: 'OMR',
    rating: dto.average_rating,
    reviewCount: dto.reviews_count,
    images: toProductImages(dto),
    description: dto.short_description ?? '',
    descriptionAr: optionalText(dto.short_description_ar),
    specifications: [],
    tags: [],
    // Only `out_of_stock` is sold out; `low_stock` and unknown values sell (B1).
    inStock: dto.stock_status !== 'out_of_stock',
    lowStock: dto.stock_status === 'low_stock',
    // stockCount omitted: the endpoint exposes no quantity.
    discount: dto.discount_percentage > 0 ? dto.discount_percentage : undefined,
    hasVariants: dto.has_variants,
  };
}

export function toBestsellers(dtos: PublicProductDto[]): Product[] {
  return dtos.map(dto => ({ ...toProduct(dto), isBestseller: true }));
}

export function toNewArrivals(dtos: PublicProductDto[]): Product[] {
  return dtos.map(dto => ({ ...toProduct(dto), isNew: true }));
}

export function toPinnedProducts(dtos: PublicProductDto[]): Product[] {
  return dtos.map(dto => ({ ...toProduct(dto), isFeatured: true }));
}

function finiteNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toGalleryImages(
  imageUrl: string | null | undefined,
  images: ProductMediaDto[] | undefined,
): { items: ProductGalleryImage[]; openGraphImageUrl?: string } {
  const ordered = [...(images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const candidates: { url: string | null | undefined; alt: string | null }[] = [
    { url: imageUrl, alt: null },
    ...ordered.map(media => ({ url: media.url, alt: media.alt })),
  ];

  const seen = new Set<string>();
  const items: ProductGalleryImage[] = [];
  for (const candidate of candidates) {
    const url = resolveMediaUrl(candidate.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    items.push({ url, alt: candidate.alt });
  }

  if (items.length === 0) {
    return { items: [{ url: PLACEHOLDER_MEDIA, alt: null }] };
  }

  return { items, openGraphImageUrl: items[0].url };
}

/** First resolved Laravel/remote image, or `undefined` — never the local placeholder. */
export function firstBackendImageUrl(
  imageUrl: string | null | undefined,
  images: ProductMediaDto[] | undefined,
): string | undefined {
  return toGalleryImages(imageUrl, images).openGraphImageUrl;
}

export function assertMappableProductDetail(dto: PublicProductDetailDto): void {
  assertMappableProduct(dto);
  if (!Array.isArray(dto.variants)) {
    throw new Error(`Product ${dto.id} is missing a variants array`);
  }
  if (!Array.isArray(dto.attributes)) {
    throw new Error(`Product ${dto.id} is missing an attributes array`);
  }
}

/** "Volume: 50 ml" from `attributes_localized`, in English or Arabic. */
function localizedVariantLabel(dto: ProductVariantDto, arabic: boolean): string | null {
  const parts = (dto.attributes_localized ?? [])
    .filter((attr) => attr && attr.key)
    .map((attr) => {
      const name = (arabic ? attr.name_ar : null) || attr.name || attr.key;
      const value = (arabic ? attr.label_ar : null) || attr.label || attr.value;
      return value ? `${name}: ${value}` : null;
    })
    .filter((part): part is string => part !== null);
  return parts.length ? parts.join(' · ') : null;
}

function variantLabel(dto: ProductVariantDto): string {
  const localizedLabel = localizedVariantLabel(dto, false);
  if (localizedLabel) return localizedLabel;
  const attrs = dto.attributes;
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === '') continue;
      parts.push(`${key}: ${String(value)}`);
    }
    if (parts.length > 0) return parts.join(' · ');
  }
  return dto.sku;
}

function toDetailVariant(
  dto: ProductVariantDto,
  productListPrice: string,
): ProductDetailVariant | null {
  if (dto.status !== 'active') return null;

  const price = finiteNumber(dto.effective_price);
  if (price === undefined) return null;

  const originalPrice = dto.is_on_sale
    ? finiteNumber(dto.price ?? productListPrice)
    : undefined;

  const gallery = toGalleryImages(dto.image_url, dto.media);
  const hasBackendMedia = gallery.openGraphImageUrl !== undefined;

  const quantityAvailable =
    typeof dto.available_quantity === 'number' && Number.isFinite(dto.available_quantity)
      ? dto.available_quantity
      : dto.inventory && Number.isFinite(dto.inventory.quantity_available)
        ? dto.inventory.quantity_available
        : undefined;
  const stockStatus = dto.stock_status ?? null;

  return {
    id: dto.id,
    sku: dto.sku,
    barcode: dto.barcode,
    label: variantLabel(dto),
    labelAr: localizedVariantLabel(dto, true),
    price,
    originalPrice,
    images: hasBackendMedia ? gallery.items : [],
    quantityAvailable,
    isAvailable:
      stockStatus !== null
        ? stockStatus !== 'out_of_stock'
        : quantityAvailable !== undefined && quantityAvailable > 0,
    isLowStock: stockStatus === 'low_stock' || dto.inventory?.is_low_stock === true,
    sortOrder: dto.sort_order,
  };
}

/** Merchant key/value specs; non-text values are shown as text, empties dropped. */
function toSpecifications(
  raw: PublicProductDto['specifications'],
): ProductDetailSpecification[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const specs: ProductDetailSpecification[] = [];
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const key = rawKey.trim();
    if (!key || rawValue === null || rawValue === undefined) continue;
    const value =
      typeof rawValue === 'string'
        ? rawValue.trim()
        : typeof rawValue === 'number' || typeof rawValue === 'boolean'
          ? String(rawValue)
          : '';
    if (value) specs.push({ key, value });
  }
  return specs;
}

function toTags(raw: PublicProductDto['tags']): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function toReviews(raw: PublicProductReviewDto[] | undefined): ProductDetailReview[] {
  if (!Array.isArray(raw)) return [];
  const reviews: ProductDetailReview[] = [];
  for (const dto of raw) {
    const rating = Number(dto?.rating);
    if (
      !dto ||
      typeof dto.id !== 'number' ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      typeof dto.created_at !== 'string'
    ) {
      continue;
    }
    reviews.push({
      id: dto.id,
      customerName: optionalText(dto.customer_name) ?? null,
      rating,
      comment: optionalText(dto.comment) ?? null,
      merchantReply: optionalText(dto.merchant_reply) ?? null,
      merchantRepliedAt: dto.merchant_replied_at ?? null,
      createdAt: dto.created_at,
    });
  }
  return reviews;
}

export function toProductDetail(dto: PublicProductDetailDto): ProductDetail {
  const listing = toProduct(dto);
  const gallery = toGalleryImages(dto.image_url, dto.images);
  const productOriginal = dto.is_on_sale ? finiteNumber(dto.price) : undefined;

  const attributes: ProductDetailAttribute[] = dto.attributes
    .filter(attr => attr && attr.name && attr.value)
    .map(attr => ({
      code: attr.code,
      name: attr.name,
      value: attr.value,
      nameAr: optionalText(attr.name_ar) ?? null,
      valueAr: optionalText(attr.value_ar) ?? null,
    }));

  const variants = dto.variants
    .map(variant => toDetailVariant(variant, dto.price))
    .filter((variant): variant is ProductDetailVariant => variant !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  return {
    listing,
    slug: dto.slug,
    name: dto.name,
    nameAr: optionalText(dto.name_ar) ?? null,
    brand: dto.brand.name,
    brandAr: optionalText(dto.brand.name_ar) ?? null,
    brandSlug: dto.brand.slug,
    category: dto.category.name,
    categoryAr: optionalText(dto.category.name_ar) ?? null,
    categorySlug: dto.category.slug,
    merchantName: dto.merchant?.name || undefined,
    merchantSlug: sellerStoreKey(dto.merchant),
    merchantLogo: sellerLogo(dto.merchant),
    shortDescription: dto.short_description,
    shortDescriptionAr: optionalText(dto.short_description_ar) ?? null,
    description: optionalText(dto.description) ?? null,
    descriptionAr: optionalText(dto.description_ar) ?? null,
    specifications: toSpecifications(dto.specifications),
    specificationsAr: toSpecifications(dto.specifications_ar ?? null),
    tags: toTags(dto.tags),
    availableQuantity:
      typeof dto.available_quantity === 'number' &&
      Number.isFinite(dto.available_quantity)
        ? dto.available_quantity
        : undefined,
    reviews: toReviews(dto.reviews),
    price: listing.price,
    originalPrice: productOriginal,
    discount: listing.discount,
    rating: dto.average_rating,
    reviewCount: dto.reviews_count,
    inStock: listing.inStock,
    lowStock: listing.lowStock,
    hasVariants: dto.has_variants,
    images: gallery.items,
    openGraphImageUrl: gallery.openGraphImageUrl,
    attributes,
    variants,
  };
}
