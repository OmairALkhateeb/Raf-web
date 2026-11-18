/**
 * Transport types for `PublicProductResource`.
 *
 * Shared by Home and the public listing. `merchant` is `whenLoaded` — present
 * on GET /api/public/products, absent on GET /api/public/home.
 * `price`, `sale_price` and `effective_price` are `decimal:3` casts and
 * therefore arrive as JSON strings.
 */

export interface ProductMediaDto {
  id: number;
  variant_id: number | null;
  url: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductRelationDto {
  id: number;
  name: string;
  /** Since 08/10/2026 (#2). */
  name_ar?: string | null;
  slug: string;
}

export interface ProductMerchantDto {
  id: number;
  name: string;
  /** Opens the store: GET /public/merchants/{slug}. Optional: older cached payloads don't have it. */
  slug?: string | null;
  logo_url?: string | null;
}

export interface PublicProductDto {
  id: number;
  name: string;
  /** Arabic name; `null` when the merchant hasn't written one. */
  name_ar?: string | null;
  slug: string;
  short_description: string | null;
  short_description_ar?: string | null;
  /** Full description (plain text from the merchant form). */
  description?: string | null;
  description_ar?: string | null;
  tags?: string[] | null;
  /** Merchant key/value pairs, e.g. `{ "Volume": "100 ml" }`. */
  specifications?: Record<string, unknown> | null;
  /** Arabic copy of `specifications` (keys and values), when the merchant wrote one. */
  specifications_ar?: Record<string, unknown> | null;
  brand: ProductRelationDto;
  category: ProductRelationDto;
  merchant?: ProductMerchantDto;
  price: string;
  sale_price: string | null;
  effective_price: string;
  discount_percentage: number;
  is_on_sale: boolean;
  has_variants: boolean;
  /**
   * `low_stock` (at or below the low-stock threshold) is still sold.
   * Anything but `out_of_stock` counts as available (backend guide, B1).
   */
  stock_status: PublicStockStatusDto;
  average_rating: number;
  reviews_count: number;
  image_url: string | null;
  images: ProductMediaDto[];
  /** Only on the detail endpoint (inventory loaded); `null` for variant products. */
  available_quantity?: number | null;
  /** Detail endpoint: the latest approved reviews (up to 10). */
  reviews?: PublicProductReviewDto[];
}

/** `PublicReviewResource` */
export interface PublicProductReviewDto {
  id: number;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  merchant_reply: string | null;
  merchant_replied_at: string | null;
  created_at: string;
}

export type PublicStockStatusDto = 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder';

export interface ProductAttributeDto {
  code: string;
  name: string;
  value: string;
  /** Since 08/10/2026 (#40). */
  name_ar?: string | null;
  value_ar?: string | null;
}

/** `variants[].attributes_localized` (08/10/2026): match on key/value, show name/label. */
export interface ProductVariantLocalizedAttributeDto {
  key: string;
  name: string;
  name_ar: string | null;
  value: string;
  label: string;
  label_ar: string | null;
}

export interface ProductVariantInventoryDto {
  id: number;
  product_id: number;
  variant_id: number;
  quantity_available: number;
  quantity_reserved: number;
  quantity_sold: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
}

export type ProductVariantAttributeValue = string | number | boolean | null;

export interface ProductVariantDto {
  id: number;
  sku: string;
  barcode: string | null;
  attributes: Record<string, ProductVariantAttributeValue> | null;
  price: string | null;
  sale_price: string | null;
  is_on_sale: boolean;
  effective_price: string;
  image_url: string | null;
  status: 'active' | 'hidden';
  sort_order: number;
  inventory: ProductVariantInventoryDto | null;
  /** Since 08/10/2026; `null` when the variant has no inventory row. */
  stock_status?: PublicStockStatusDto | null;
  available_quantity?: number | null;
  attributes_localized?: ProductVariantLocalizedAttributeDto[] | null;
  media: ProductMediaDto[];
}

/** `GET /api/public/products/{slug}` — `PublicProductResource` plus loaded relations. */
export interface PublicProductDetailDto extends PublicProductDto {
  merchant: ProductMerchantDto;
  variants: ProductVariantDto[];
  attributes: ProductAttributeDto[];
}

export interface PublicProductDetailResponse {
  data: PublicProductDetailDto;
}

export interface PublicProductListResponse {
  data: PublicProductDto[];
}
