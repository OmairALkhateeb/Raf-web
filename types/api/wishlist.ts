import type { Product } from '@/types';

/**
 * Transport types for Laravel WishlistResource / ProductResource as loaded by
 * GET/POST /api/customer/wishlist. Tokens stay on the server BFF.
 */

export type LaravelStockStatusDto = 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder';

export interface LaravelWishlistMediaDto {
  id: number;
  variant_id: number | null;
  url: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface LaravelWishlistProductDto {
  id: number;
  name: string;
  name_ar: string | null;
  slug: string;
  description: string | null;
  short_description: string | null;
  short_description_ar: string | null;
  /** `active` products are on sale; anything else 404s on the product page. */
  status: string | null;
  price: string;
  sale_price: string | null;
  effective_price: string;
  discount_percentage: number;
  is_on_sale: boolean;
  has_variants: boolean;
  stock_status: LaravelStockStatusDto;
  average_rating: number;
  reviews_count: number;
  media: LaravelWishlistMediaDto[];
  brand_id?: number | null;
  brand_name?: string;
  category_id?: number | null;
  category_name?: string;
}

export interface LaravelWishlistItemDto {
  id: number;
  product: LaravelWishlistProductDto;
  variant_id: number | null;
  created_at: string;
}

export type WishlistErrorCode =
  | 'invalid_input'
  | 'validation'
  | 'not_found'
  | 'forbidden'
  | 'unavailable'
  | 'unauthenticated';

export interface WishlistClientError {
  ok: false;
  code: WishlistErrorCode;
  error?: string;
}

export interface WishlistItemJson {
  id: number;
  productId: number;
  variantId: number | null;
  product: Product;
}

export interface WishlistListJson {
  ok: true;
  items: WishlistItemJson[];
}

export interface WishlistItemResponseJson {
  ok: true;
  item: WishlistItemJson;
}

export interface WishlistDeleteJson {
  ok: true;
}
