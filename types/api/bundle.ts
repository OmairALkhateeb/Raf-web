/** `ProductBundleResource` (GET /public/bundles, /public/bundles/{slug}, home `bundles`). */
export interface PublicBundleItemDto {
  id: number;
  product_id: number | null;
  product_name: string | null;
  product_name_ar: string | null;
  product_slug: string | null;
  image_url: string | null;
  variant_id: number | null;
  /** Since 08/10/2026 (#28). */
  variant_label?: string | null;
  variant_label_ar?: string | null;
  variant_sku?: string | null;
  quantity: number;
  unit_price: string | null;
}

export interface PublicBundleDto {
  id: number;
  name: string;
  name_ar: string | null;
  slug: string;
  description: string | null;
  description_ar: string | null;
  bundle_price: string;
  compare_price: string | null;
  savings?: string | null;
  is_gift_set: boolean;
  image_url: string | null;
  status: string;
  in_stock?: boolean;
  items?: PublicBundleItemDto[];
}
