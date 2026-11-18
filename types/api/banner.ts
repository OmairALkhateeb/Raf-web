/** `BannerResource` from GET /api/public/banners?placement=… */
export type BannerPlacementDto =
  | 'homepage_hero'
  | 'promotion'
  | 'category_page'
  | 'footer';

export interface PublicBannerDto {
  id: number;
  placement: BannerPlacementDto;
  title: string;
  title_ar: string | null;
  subtitle: string | null;
  subtitle_ar: string | null;
  /** Since 08/10/2026; `null` → use the store's "Shop now". */
  button_text?: string | null;
  button_text_ar?: string | null;
  /** Full URL. */
  image_url: string | null;
  /**
   * Where the banner leads (08/10/2026). `null` = display only.
   * Absent on an older API: fall back to `link_url`.
   */
  link_type?: BannerLinkTypeDto | null;
  target?: BannerTargetDto | null;
  /** The `custom` link (a full URL). */
  link_url: string | null;
  sort_order: number;
  /** Offer details (08/10/2026, frontend guide §7). */
  description?: string | null;
  description_ar?: string | null;
  /** The offer's products: list them with `/products?ids=…`. */
  product_ids?: number[] | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export type BannerLinkTypeDto =
  | 'category'
  | 'brand'
  | 'product'
  | 'search'
  | 'product_listing'
  | 'custom';

export interface BannerTargetDto {
  category_slug: string | null;
  brand_slug: string | null;
  product_slug: string | null;
  search_query: string | null;
  url: string | null;
}
