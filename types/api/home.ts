/**
 * Transport types for `GET /api/public/home`.
 *
 * These mirror the Laravel response exactly and are intentionally separate from
 * the UI types in `types/index.ts`. The response is a flat object with no
 * top-level `data` wrapper, and the nested resource collections serialise as
 * bare arrays because Laravel only applies its wrapper at the response root.
 */

export type {
  ProductMediaDto,
  ProductMerchantDto,
  ProductRelationDto,
  PublicProductDto,
} from './product';

export type { PublicBrandDto } from './brand';

import type { PublicBannerDto } from './banner';
import type { PublicBrandDto } from './brand';
import type { PublicBundleDto } from './bundle';
import type { PublicProductDto } from './product';

/** Since 08/10/2026 the same `BannerResource` as GET /public/banners. */
export type HeroBannerDto = PublicBannerDto;

/**
 * Since 08/10/2026 the `CategoryResource` shape (#1), in the admin's order.
 * `image_path` was the old raw column; kept optional for older payloads.
 */
export interface FeaturedCategoryDto {
  id: number;
  name: string;
  name_ar?: string | null;
  slug: string;
  description?: string | null;
  description_ar?: string | null;
  image_url?: string | null;
  image_path?: string | null;
  products_count?: number;
}

export interface HomeResponseDto {
  hero_banners: HeroBannerDto[];
  featured_categories: FeaturedCategoryDto[];
  featured_brands: PublicBrandDto[];
  bestsellers: PublicProductDto[];
  pinned_products: PublicProductDto[];
  new_arrivals: PublicProductDto[];
  /** Latest 8 active bundles. */
  bundles: PublicBundleDto[];
}
