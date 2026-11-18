import type { Metadata } from 'next';
import { fetchPlacementBanners } from '@/lib/api/server/banners';
import { getServerDictionary } from '@/lib/i18n/server';
import CatalogView from '@/components/products/CatalogView';
import {
  fetchBrands,
  fetchCategories,
  fetchCategoryDetail,
  fetchProducts,
} from '@/lib/api/server/catalog';
import {
  attributeQueryMatches,
  brandSlugs,
  DEFAULT_CATALOG_QUERY,
  parseCatalogSearchParams,
  pickTrackingParams,
  toLaravelQueryString,
} from '@/lib/catalog/params';
import {
  flattenCategories,
  toCatalogBrand,
  toCatalogCategory,
  toCatalogCategoryDetail,
} from '@/lib/mappers/catalog';
import { assertMappableProduct, toProduct } from '@/lib/mappers/product';
import { pickLocalized } from '@/lib/i18n/language';
import { currentAlternates, metaDescription, openGraphFor } from '@/lib/seo/metadata';

/** `/products?category=perfumes` is titled "Perfumes", with its own description. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const [raw, { language, t }] = await Promise.all([searchParams, getServerDictionary()]);
  const slug = typeof raw.category === 'string' ? raw.category.trim() : '';
  if (!slug) return { title: t.meta.products, description: t.meta.siteDescription };

  const roots = await fetchCategories();
  const findCategory = (nodes: NonNullable<typeof roots>): NonNullable<typeof roots>[number] | undefined => {
    for (const node of nodes) {
      if (node.slug === slug) return node;
      const child = findCategory(node.children ?? []);
      if (child) return child;
    }
    return undefined;
  };
  const category = roots ? findCategory(roots) : undefined;
  if (!category) return { title: t.meta.products };

  const name = pickLocalized(language, category.name, category.name_ar);
  const description =
    metaDescription(category.description) ?? t.meta.categoryDescription.replace('{name}', name);
  const image = category.image_url && /^https?:\/\//.test(category.image_url) ? category.image_url : null;
  const { canonical } = await currentAlternates(language);
  return {
    title: name,
    description,
    openGraph: openGraphFor(language, canonical, {
      title: name,
      description,
      images: [image ? { url: image, alt: name } : { url: '/images/logo.png', alt: 'RAF' }],
    }),
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const parsed = parseCatalogSearchParams(raw);
  const tracking = Object.fromEntries(pickTrackingParams(raw));

  const [categoryDtos, brandDtos] = await Promise.all([
    fetchCategories(),
    fetchBrands(),
  ]);
  const categoriesFailed = categoryDtos === null;
  const brandsFailed = brandDtos === null;
  const categories = categoryDtos
    ? categoryDtos.map(toCatalogCategory)
    : [];
  const brands = brandDtos ? brandDtos.map(toCatalogBrand) : [];

  if (!parsed.ok) {
    return (
      <CatalogView
        status="invalid"
        query={DEFAULT_CATALOG_QUERY}
        products={[]}
        categories={categories}
        brands={brands}
        meta={null}
        tracking={tracking}
        categoriesFailed={categoriesFailed}
        brandsFailed={brandsFailed}
      />
    );
  }

  const query = parsed.query;

  if (query.category && categoriesFailed) {
    return (
      <CatalogView
        status="unavailable"
        query={query}
        products={[]}
        categories={[]}
        brands={brands}
        meta={null}
        tracking={tracking}
        categoriesFailed
        brandsFailed={brandsFailed}
      />
    );
  }

  if (query.brand && brandsFailed) {
    return (
      <CatalogView
        status="unavailable"
        query={query}
        products={[]}
        categories={categories}
        brands={[]}
        meta={null}
        tracking={tracking}
        categoriesFailed={categoriesFailed}
        brandsFailed
      />
    );
  }

  let categoryId: number | undefined;
  let categoryDetail = null;

  if (query.category) {
    const detail = await fetchCategoryDetail(query.category);
    if (detail.status === 'not-found') {
      return (
        <CatalogView
          status="not-found"
          query={query}
          products={[]}
          categories={categories}
          brands={brands}
          meta={null}
          tracking={tracking}
          categoriesFailed={categoriesFailed}
          brandsFailed={brandsFailed}
        />
      );
    }
    if (detail.status === 'unavailable') {
      return (
        <CatalogView
          status="unavailable"
          query={query}
          products={[]}
          categories={categories}
          brands={brands}
          meta={null}
          tracking={tracking}
          categoriesFailed={categoriesFailed}
          brandsFailed={brandsFailed}
        />
      );
    }
    categoryId = detail.data.id;
    categoryDetail = toCatalogCategoryDetail(detail.data);
    if (!attributeQueryMatches(query.attributes, categoryDetail.filters)) {
      return (
        <CatalogView
          status="invalid"
          query={query}
          products={[]}
          categories={categories}
          brands={brands}
          meta={null}
          tracking={tracking}
          categoriesFailed={categoriesFailed}
          brandsFailed={brandsFailed}
          categoryDetail={categoryDetail}
        />
      );
    }
  }

  let brandIds: number[] | undefined;
  const selectedBrandSlugs = brandSlugs(query.brand);
  if (selectedBrandSlugs.length > 0) {
    const hits = selectedBrandSlugs.map((slug) => (brandDtos ?? []).find((b) => b.slug === slug));
    if (hits.some((hit) => !hit)) {
      return (
        <CatalogView
          status="invalid"
          query={query}
          products={[]}
          categories={categories}
          brands={brands}
          meta={null}
          tracking={tracking}
          categoriesFailed={categoriesFailed}
          brandsFailed={brandsFailed}
        />
      );
    }
    brandIds = hits.map((hit) => hit!.id);
  }

  // Keep index flatten as a soft consistency check only when detail succeeded.
  if (query.category && categoryDtos) {
    const fromIndex = flattenCategories(categoryDtos).get(query.category);
    if (fromIndex && categoryId !== undefined && fromIndex.id !== categoryId) {
      console.error(
        '[catalog] category detail id disagrees with categories index',
        query.category,
      );
    }
  }

  // Category-page banners only make sense on a category listing.
  const bannersPromise = query.category
    ? fetchPlacementBanners('category_page', categoryId)
    : Promise.resolve(null);
  const page = await fetchProducts(
    toLaravelQueryString(query, { categoryId, brandIds }),
  );
  if (!page) {
    return (
      <CatalogView
        status="unavailable"
        query={query}
        products={[]}
        categories={categories}
        brands={brands}
        meta={null}
        tracking={tracking}
        categoriesFailed={categoriesFailed}
        brandsFailed={brandsFailed}
        categoryDetail={categoryDetail}
      />
    );
  }

  try {
    for (const dto of page.data) {
      assertMappableProduct(dto);
    }
  } catch (error) {
    console.error('[catalog] invalid product payload', error);
    return (
      <CatalogView
        status="data-error"
        query={query}
        products={[]}
        categories={categories}
        brands={brands}
        meta={null}
        tracking={tracking}
        categoriesFailed={categoriesFailed}
        brandsFailed={brandsFailed}
        categoryDetail={categoryDetail}
      />
    );
  }

  const products = page.data.map(toProduct);
  const categoryBanners = (await bannersPromise) ?? [];
  const meta = {
    total: page.meta.total,
    currentPage: page.meta.current_page,
    lastPage: page.meta.last_page,
    perPage: page.meta.per_page,
  };

  return (
    <CatalogView
      status={page.meta.total === 0 ? 'empty' : 'ok'}
      query={query}
      products={products}
      categories={categories}
      brands={brands}
      meta={meta}
      tracking={tracking}
      categoriesFailed={categoriesFailed}
      brandsFailed={brandsFailed}
      categoryDetail={categoryDetail}
      banners={categoryBanners}
    />
  );
}
