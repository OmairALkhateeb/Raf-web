/**
 * Transport types for `PublicMerchantResource`: GET /api/public/merchants/{slug}.
 *
 * Public shop details only (no contact, bank or legal data). `{slug}` also
 * accepts the numeric id. Pending, suspended and rejected merchants → 404.
 */

export interface PublicMerchantCategoryDto {
  id: number;
  parent_id: number | null;
  name: string;
  name_ar: string | null;
  slug: string;
}

export interface PublicMerchantDto {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  /** One language only (the backend has no `description_ar`). */
  description: string | null;
  country: string | null;
  /** As the vendor saved it, e.g. "Muscat". */
  city: string | null;
  products_count: number;
  /** 0 when the store has no approved reviews. */
  average_rating: number;
  reviews_count: number;
  /** ISO 8601: approval date, else creation date. */
  joined_at: string | null;
  /** Categories with active products of this merchant; flat, a child may come without its parent. */
  categories?: PublicMerchantCategoryDto[];
}

export interface PublicMerchantResponse {
  data: PublicMerchantDto;
}
