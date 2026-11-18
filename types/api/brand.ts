/**
 * Transport types for `PublicBrandResource`.
 *
 * Shared by Home (`featured_brands`), the public brand index, brand detail,
 * and header/catalog lookups.
 */

export interface PublicBrandDto {
  id: number;
  name: string;
  name_ar?: string | null;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  description_ar?: string | null;
  country: string | null;
  products_count: number;
  /**
   * Since 08/10/2026: the categories the brand sells in, from its active
   * products, parent categories included.
   */
  categories?: Array<{ id: number; name: string; name_ar: string | null; slug: string }>;
}

export interface PublicBrandDetailResponse {
  data: PublicBrandDto;
}
