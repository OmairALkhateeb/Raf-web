import 'server-only';

import type { Brand, Category, SubCategory } from '@/types';
import type { CategoryDto } from '@/types/api/category';
import type { PublicBrandDto } from '@/types/api/brand';
import { resolveMediaUrl } from '@/lib/api/server/media';
import { toBrand } from '@/lib/mappers/brand';
import { optionalText, PLACEHOLDER_MEDIA } from '@/lib/mappers/product';

export interface FlatCategory {
  id: number;
  slug: string;
  parentId: number | null;
  rootSlug: string;
}

/**
 * Index every node we actually received. Laravel's category index only
 * eager-loads one child level, so grandchildren are usually absent — walk
 * with `children ?? []` and stop when the array is empty.
 */
export function flattenCategories(roots: CategoryDto[]): Map<string, FlatCategory> {
  const index = new Map<string, FlatCategory>();

  const walk = (node: CategoryDto, rootSlug: string) => {
    index.set(node.slug, {
      id: node.id,
      slug: node.slug,
      parentId: node.parent_id,
      rootSlug,
    });
    for (const child of node.children ?? []) {
      walk(child, rootSlug);
    }
  };

  for (const root of roots) {
    walk(root, root.slug);
  }

  return index;
}

/**
 * The parent of a sub-category, from the category tree (GET /public/categories),
 * for breadcrumbs. `null` for a main category or a slug that isn't in the tree.
 */
export function findParentCategory(
  roots: CategoryDto[] | null | undefined,
  slug: string | null | undefined,
): { slug: string; name: string; nameAr: string | null } | null {
  if (!roots || !slug) return null;
  for (const root of roots) {
    if ((root.children ?? []).some((child) => child.slug === slug)) {
      return { slug: root.slug, name: root.name, nameAr: optionalText(root.name_ar) ?? null };
    }
  }
  return null;
}

function toSubCategory(dto: CategoryDto, parentId: number): SubCategory {
  return {
    id: String(dto.id),
    slug: dto.slug,
    name: dto.name,
    nameAr: optionalText(dto.name_ar),
    categoryId: String(parentId),
    image: resolveMediaUrl(dto.image_url) ?? undefined,
    productCount: dto.products_count,
  };
}

export function toCatalogCategory(dto: CategoryDto): Category {
  const activeChildren = (dto.children ?? []).filter(
    (child) => child.is_active !== false,
  );
  return {
    id: String(dto.id),
    slug: dto.slug,
    name: dto.name,
    nameAr: optionalText(dto.name_ar),
    image: resolveMediaUrl(dto.image_url) ?? PLACEHOLDER_MEDIA,
    icon: '',
    productCount: dto.products_count,
    featured: false,
    subCategories: activeChildren.map((child) => toSubCategory(child, dto.id)),
  };
}

/** A filterable category attribute the catalog can offer (it has an option list). */
export type CatalogAttributeFilter = {
  code: string;
  name: string;
  nameAr: string | null;
  /** Stored values: what the filter sends. */
  options: string[];
  /** Display labels per value, when the admin wrote them. */
  optionLabels: Record<string, { label: string; labelAr: string | null }>;
};

/** Category context from GET /api/public/categories/{slug} for catalog headings. */
export type CatalogCategoryDetail = {
  id: number;
  slug: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  imageUrl: string | null;
  productsCount: number;
  filters: CatalogAttributeFilter[];
};

/**
 * `is_filterable` attributes that list their options (select / multiselect).
 * Number or text attributes have no option list to choose from, so they're skipped.
 */
function toAttributeFilters(dto: CategoryDto): CatalogAttributeFilter[] {
  return [...(dto.attributes ?? [])]
    .filter((a) => a.is_filterable && /^[a-z0-9_]{1,64}$/.test(a.code))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => ({
      code: a.code,
      name: a.name,
      nameAr: optionalText(a.name_ar) ?? null,
      optionLabels: Object.fromEntries(
        (Array.isArray(a.options_localized) ? a.options_localized : [])
          .filter((o) => o && typeof o.value === 'string')
          .map((o) => [
            o.value,
            { label: optionalText(o.label) ?? o.value, labelAr: optionalText(o.label_ar) ?? null },
          ]),
      ),
      options: Array.isArray(a.options) && a.options.length > 0
        ? [
            ...new Set(
              a.options
                .filter((o): o is string | number => typeof o === 'string' || typeof o === 'number')
                .map((o) => String(o).trim())
                .filter((o) => o && !o.includes(',') && o.length <= 100),
            ),
          ]
        : Array.isArray(a.values)
          ? [
              ...new Set(
                a.values
                  .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
                  .map((v) => String(v).trim())
                  .filter((v) => v && !v.includes(',') && v.length <= 100),
              ),
            ]
          : [],
    }))
    .filter((f) => f.options.length > 0);
}

export function toCatalogCategoryDetail(
  dto: CategoryDto,
): CatalogCategoryDetail {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    nameAr: optionalText(dto.name_ar) ?? null,
    description: dto.description,
    descriptionAr: optionalText(dto.description_ar) ?? null,
    imageUrl: resolveMediaUrl(dto.image_url) ?? null,
    productsCount:
      typeof dto.products_count === 'number' &&
      Number.isFinite(dto.products_count)
        ? dto.products_count
        : 0,
    filters: toAttributeFilters(dto),
  };
}

export function toCatalogBrand(dto: PublicBrandDto): Brand {
  return toBrand(dto, { featured: false });
}
