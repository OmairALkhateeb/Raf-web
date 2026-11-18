/**
 * Transport types for GET/POST/PATCH/DELETE `/api/customer/cart*`.
 * Prices arrive as bcmath strings. `image_url` is a storage path, not a URL.
 */

export interface LaravelCartLineDto {
  item_id: number;
  product_id: number;
  variant_id: number | null;
  variant_sku?: string | null;
  /** The chosen variant's attributes, as on order items; `null` without a variant. */
  options?: { attributes?: Record<string, unknown> | null } | null;
  name: string;
  name_ar?: string | null;
  /** Not sent yet (backend note 39); read it as soon as it is. */
  slug?: string | null;
  image_url: string | null;
  unit_price: string;
  quantity: number;
  line_total: string;
  available_stock: number;
}

export interface LaravelCartIssueDto {
  /** Product lines. */
  item_id?: number;
  /** Bundle lines. */
  bundle_item_id?: number;
  /** An English sentence; kept for older payloads. */
  reason: string;
  /** Since 08/10/2026 (#21): `unavailable`, `stock`, `bundle_unavailable`, `bundle_stock`. */
  code?: string;
  /** How many are left, with `stock` codes. */
  available?: number | null;
  /** Translated sentence (Accept-Language); the store words its own. */
  message?: string;
}

export interface LaravelCartBundleLineDto {
  bundle_item_id: number;
  bundle_id: number;
  name: string;
  name_ar: string | null;
  slug: string;
  /** Full URL. */
  image_url: string | null;
  unit_price: string;
  compare_price: string | null;
  quantity: number;
  line_total: string;
  contents: Array<{
    product_id: number;
    name: string | null;
    name_ar: string | null;
    variant_id: number | null;
    /** Since 08/10/2026 (#28): the included option, e.g. "50 ml". */
    variant_label?: string | null;
    variant_label_ar?: string | null;
    variant_sku?: string | null;
    quantity: number;
  }>;
}

export interface LaravelCartDto {
  cart_id: number;
  guest_token: string | null;
  currency: string;
  subtotal: string;
  items: LaravelCartLineDto[];
  bundles?: LaravelCartBundleLineDto[];
  issues: LaravelCartIssueDto[];
  /**
   * Totals as checkout will charge them (08/10/2026), for the customer's
   * default address and method, or `?address_id=&shipping_method_id=`.
   */
  discount_total?: string;
  shipping_total?: string;
  tax_total?: string;
  /** Percent, e.g. "5"; "0" when tax is off. */
  tax_rate?: string;
  grand_total?: string;
  /** `null` when the store-wide threshold isn't set. */
  free_shipping_threshold?: string | null;
  /** True when there's no address (guest, or no saved address). */
  shipping_estimated?: boolean;
  /**
   * Since 15/10/2026: `false` = checkout would refuse this address/method (its
   * `shipping_total` of 0 is NOT free shipping); `null` while estimated.
   */
  shipping_available?: boolean | null;
  shipping_address_id?: number | null;
  shipping_method_id?: number | null;
  /** `POST /customer/cart/merge` only (#30): guest lines dropped or capped. */
  merge_notes?: Array<{
    type?: string;
    product_id?: number;
    bundle_id?: number;
    variant_id?: number | null;
    name?: string | null;
    name_ar?: string | null;
    requested?: number;
    merged?: number;
    code?: string;
  }>;
}

export type CartErrorCode = 'invalid_input' | 'validation' | 'not_found' | 'unavailable' | 'unauthenticated';

export type CartErrorField = 'product_id' | 'variant_id' | 'quantity' | 'item' | 'bundle_id';

/** Allowlisted validation reason — never a raw Laravel debug string. */
export type CartErrorReason =
  | 'stock'
  | 'variant_required'
  | 'variant_unavailable'
  | 'product_unavailable'
  | 'item_mismatch'
  | 'bundle_unavailable'
  | 'bundle_stock'
  | 'quantity_max';

export interface CartClientError {
  ok: false;
  code: CartErrorCode;
  field?: CartErrorField;
  reason?: CartErrorReason;
}

export type CartClientSuccess<T> = {
  ok: true;
  cart: T;
};
