import type { MetadataRoute } from 'next';
import { apiGet, isTransportFailure } from '@/lib/api/server/http';
import { fetchBrands, fetchCategories } from '@/lib/api/server/catalog';
import { fetchBundlesPage } from '@/lib/api/server/bundles';
import { languagePath } from '@/lib/seo/alternates';
import { absoluteUrl, siteOrigin } from '@/lib/seo/site';
import type { CategoryDto } from '@/types/api/category';
import type { LaravelPaginated } from '@/types/api/pagination';
import type { PublicProductDto } from '@/types/api/product';

// Rebuilt at most once an hour.
export const revalidate = 3600;

const STATIC_PATHS: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/products', priority: 0.9, changeFrequency: 'daily' },
  { path: '/brands', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/bundles', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/faq', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/shipping', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/returns-policy', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'monthly' },
];

const MAX_PRODUCT_PAGES = 50;

/**
 * Next.js writes sitemap URLs into the XML as they are, so `&` in
 * `?category=…&lang=ar` would break the file. Escape them here.
 */
function xmlEscape(url: string): string {
  return url
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Every active product slug (100 per request). Stops quietly on an API failure. */
async function productSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  for (let page = 1; page <= MAX_PRODUCT_PAGES; page += 1) {
    let payload: LaravelPaginated<PublicProductDto>;
    try {
      payload = await apiGet<LaravelPaginated<PublicProductDto>>(
        `/public/products?per_page=100&page=${page}`,
        { revalidate, tags: ['products'] },
      );
    } catch (error) {
      if (!isTransportFailure(error)) throw error;
      console.error('[sitemap] failed to load products', error);
      break;
    }
    for (const product of payload?.data ?? []) {
      if (typeof product?.slug === 'string' && product.slug) slugs.push(product.slug);
    }
    if (page >= (payload?.meta?.last_page ?? 1)) break;
  }
  return slugs;
}

async function bundleSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const result = await fetchBundlesPage({ page, perPage: 100, giftSetsOnly: false });
    if (!result) break;
    slugs.push(...result.bundles.map((bundle) => bundle.slug));
    if (page >= result.lastPage) break;
  }
  return slugs;
}

function categorySlugs(roots: CategoryDto[] | null): string[] {
  const slugs: string[] = [];
  const walk = (nodes: CategoryDto[]) => {
    for (const node of nodes) {
      if (node.is_active === false) continue;
      slugs.push(node.slug);
      walk(node.children ?? []);
    }
  };
  walk(roots ?? []);
  return slugs;
}

/**
 * /sitemap.xml: public pages, categories, brands, bundles and products, each
 * in English and Arabic (`?lang=ar`) with hreflang alternates.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, categories, brands, products, bundles] = await Promise.all([
    siteOrigin(),
    fetchCategories(),
    fetchBrands(),
    productSlugs(),
    bundleSlugs(),
  ]);

  const pages: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
    ...STATIC_PATHS,
    ...categorySlugs(categories).map((slug) => ({
      path: `/products?category=${encodeURIComponent(slug)}`,
      priority: 0.8,
      changeFrequency: 'daily' as const,
    })),
    ...(brands ?? []).map((brand) => ({
      path: `/brands/${encodeURIComponent(brand.slug)}`,
      priority: 0.6,
      changeFrequency: 'weekly' as const,
    })),
    ...bundles.map((slug) => ({
      path: `/bundles/${encodeURIComponent(slug)}`,
      priority: 0.6,
      changeFrequency: 'weekly' as const,
    })),
    ...products.map((slug) => ({
      path: `/products/${encodeURIComponent(slug)}`,
      priority: 0.7,
      changeFrequency: 'weekly' as const,
    })),
  ];

  const now = new Date();
  return pages.flatMap(({ path, priority, changeFrequency }) => {
    const en = xmlEscape(absoluteUrl(origin, path));
    const ar = xmlEscape(absoluteUrl(origin, languagePath(path, 'ar')));
    const alternates = { languages: { en, ar, 'x-default': en } };
    return [
      { url: en, lastModified: now, changeFrequency, priority, alternates },
      { url: ar, lastModified: now, changeFrequency, priority, alternates },
    ];
  });
}
