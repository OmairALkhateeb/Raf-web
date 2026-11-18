import 'server-only';

import type { Product } from '@/types';
import type {
  LaravelWishlistItemDto,
  LaravelWishlistProductDto,
  WishlistItemJson,
} from '@/types/api/wishlist';
import { PLACEHOLDER_MEDIA } from '@/lib/mappers/product';
import { resolveMediaUrl } from '@/lib/api/server/media';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function positiveInt(value: unknown): number | undefined {
  const n = finiteNumber(value);
  if (n === undefined || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function unwrapData(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) return payload;
  if ('data' in record) return record.data;
  return payload;
}

function mediaImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [PLACEHOLDER_MEDIA];
  const ordered = [...raw].sort((a, b) => {
    const ao = asRecord(a);
    const bo = asRecord(b);
    const as = finiteNumber(ao?.sort_order) ?? 0;
    const bs = finiteNumber(bo?.sort_order) ?? 0;
    return as - bs;
  });

  const seen = new Set<string>();
  const images: string[] = [];
  for (const entry of ordered) {
    const media = asRecord(entry);
    const url = resolveMediaUrl(
      typeof media?.url === 'string' ? media.url : null,
    );
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push(url);
  }
  return images.length > 0 ? images : [PLACEHOLDER_MEDIA];
}

function parseProduct(raw: unknown): LaravelWishlistProductDto | undefined {
  const dto = asRecord(raw);
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const name = asNonEmptyString(dto.name);
  const slug = asNonEmptyString(dto.slug);
  const effective =
    asNonEmptyString(dto.effective_price) ??
    (typeof dto.effective_price === 'number'
      ? String(dto.effective_price)
      : undefined);
  const price =
    asNonEmptyString(dto.price) ??
    (typeof dto.price === 'number' ? String(dto.price) : undefined);
  const stock =
    dto.stock_status === 'in_stock' ||
    dto.stock_status === 'low_stock' ||
    dto.stock_status === 'out_of_stock' ||
    dto.stock_status === 'backorder'
      ? dto.stock_status
      : undefined;
  const hasVariants =
    typeof dto.has_variants === 'boolean' ? dto.has_variants : undefined;
  const rating = finiteNumber(dto.average_rating);
  const reviews = finiteNumber(dto.reviews_count);
  const discount = finiteNumber(dto.discount_percentage);
  const onSale =
    typeof dto.is_on_sale === 'boolean' ? dto.is_on_sale : undefined;

  if (
    id === undefined ||
    !name ||
    !slug ||
    !effective ||
    !price ||
    !stock ||
    hasVariants === undefined ||
    rating === undefined ||
    reviews === undefined ||
    discount === undefined ||
    onSale === undefined
  ) {
    return undefined;
  }

  const description = asNullableString(dto.description ?? null) ?? null;
  const shortDescription =
    asNullableString(dto.short_description ?? null) ?? null;
  let salePrice: string | null = null;
  if (dto.sale_price !== null && dto.sale_price !== undefined) {
    salePrice =
      asNullableString(dto.sale_price) ??
      (finiteNumber(dto.sale_price) !== undefined
        ? String(dto.sale_price)
        : null);
  }

  return {
    id,
    name,
    name_ar: asNullableString(dto.name_ar ?? null) ?? null,
    slug,
    description,
    short_description: shortDescription,
    short_description_ar:
      asNullableString(dto.short_description_ar ?? null) ?? null,
    status: asNonEmptyString(dto.status) ?? null,
    price,
    sale_price: salePrice,
    effective_price: effective,
    discount_percentage: discount,
    is_on_sale: onSale,
    has_variants: hasVariants,
    stock_status: stock,
    average_rating: rating,
    reviews_count: reviews,
    media: Array.isArray(dto.media)
      ? (dto.media as LaravelWishlistProductDto['media'])
      : [],
    brand_id: positiveInt(dto.brand_id) ?? null,
    brand_name: asNonEmptyString(dto.brand_name),
    category_id: positiveInt(dto.category_id) ?? null,
    category_name: asNonEmptyString(dto.category_name),
  };
}

function toProduct(dto: LaravelWishlistProductDto): Product {
  const effective = Number(dto.effective_price);
  const listPrice = Number(dto.price);
  return {
    id: String(dto.id),
    slug: dto.slug,
    name: dto.name,
    nameAr: dto.name_ar ?? undefined,
    brand: dto.brand_name ?? '',
    brandId: dto.brand_id ? String(dto.brand_id) : '',
    category: dto.category_name ?? '',
    categoryId: dto.category_id ? String(dto.category_id) : '',
    price: effective,
    originalPrice:
      dto.is_on_sale && Number.isFinite(listPrice) ? listPrice : undefined,
    currency: 'OMR',
    rating: dto.average_rating,
    reviewCount: dto.reviews_count,
    images: mediaImages(dto.media),
    description: dto.short_description ?? dto.description ?? '',
    descriptionAr: dto.short_description_ar ?? undefined,
    specifications: [],
    tags: [],
    inStock: dto.stock_status !== 'out_of_stock',
    lowStock: dto.stock_status === 'low_stock',
    // Missing status = old payload: treat as available rather than hide it.
    unavailable: dto.status !== null && dto.status !== 'active',
    discount: dto.discount_percentage > 0 ? dto.discount_percentage : undefined,
    hasVariants: dto.has_variants,
  };
}

export function parseLaravelWishlistItem(
  raw: unknown,
): WishlistItemJson | undefined {
  const dto = asRecord(raw) as LaravelWishlistItemDto | null;
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  if (id === undefined) return undefined;

  let variantId: number | null = null;
  if (dto.variant_id !== null && dto.variant_id !== undefined) {
    const parsed = positiveInt(dto.variant_id);
    if (parsed === undefined) return undefined;
    variantId = parsed;
  }

  const productDto = parseProduct(dto.product);
  if (!productDto) return undefined;

  return {
    id,
    productId: productDto.id,
    variantId,
    product: toProduct(productDto),
  };
}

export function parseLaravelWishlistList(
  raw: unknown,
): WishlistItemJson[] | undefined {
  const data = unwrapData(raw);
  if (!Array.isArray(data)) return undefined;

  const items: WishlistItemJson[] = [];
  for (const entry of data) {
    const item = parseLaravelWishlistItem(entry);
    if (!item) {
      console.error('Laravel wishlist row could not be mapped');
      continue;
    }
    items.push(item);
  }
  return items;
}

export function parseLaravelWishlistResource(
  raw: unknown,
): WishlistItemJson | undefined {
  return parseLaravelWishlistItem(unwrapData(raw));
}
