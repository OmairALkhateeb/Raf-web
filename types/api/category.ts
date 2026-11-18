/**
 * Transport type for `CategoryResource` on GET /api/public/categories
 * and GET /api/public/categories/{slug}.
 *
 * Index eager-loads one `children` level. Show also loads `attributes`.
 * Nested grandchildren are not guaranteed; always read `children ?? []`.
 * Show does not filter children with `active()` — filter `is_active` client-side.
 */
export interface CategoryAttributeDto {
  id: number;
  name: string;
  /** Since 08/10/2026 (#40). */
  name_ar?: string | null;
  code: string;
  type: string;
  is_required: boolean;
  is_filterable: boolean;
  options: unknown;
  /** `[{value, label, label_ar}]`; filter by `value`, show `label(_ar)`. */
  options_localized?: Array<{ value: string; label?: string | null; label_ar?: string | null }> | null;
  /** Category page, filterable attributes without options: the values in use (#41). */
  values?: Array<string | number> | null;
  sort_order: number;
}

export interface CategoryDto {
  id: number;
  parent_id: number | null;
  name: string;
  name_ar?: string | null;
  slug: string;
  description: string | null;
  /** Since 08/10/2026 (#25). */
  description_ar?: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  products_count: number;
  children?: CategoryDto[];
  attributes?: CategoryAttributeDto[];
  shipping_constraints?: unknown;
}

export interface CategoryDetailResponse {
  data: CategoryDto;
}
