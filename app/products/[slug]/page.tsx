import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
import { pickLocalized } from '@/lib/i18n/language';
import { notFound } from 'next/navigation';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import ProductDetailView from '@/components/products/ProductDetailView';
import ProductStatusMessage from '@/components/products/ProductStatusMessage';
import {
  fetchProductDetail,
  fetchRelatedProducts,
  fetchSameBrandProducts,
} from '@/lib/api/server/products';
import {
  assertMappableProduct,
  assertMappableProductDetail,
  firstBackendImageUrl,
  toProduct,
  toProductDetail,
} from '@/lib/mappers/product';
import { fetchCategories } from '@/lib/api/server/catalog';
import { findParentCategory } from '@/lib/mappers/catalog';
import type { Product } from '@/types';
import type { PublicProductDto } from '@/types/api/product';
import { translations } from '@/utils/translations';
import JsonLd from '@/components/seo/JsonLd';
import { languagePath } from '@/lib/seo/alternates';
import {
  availabilityFor,
  breadcrumbJsonLd,
  currentAlternates,
  metaDescription,
  NOINDEX,
  openGraphFor,
  productJsonLd,
} from '@/lib/seo/metadata';
import { absoluteUrl, siteOrigin } from '@/lib/seo/site';

function mapRecommendations(dtos: PublicProductDto[] | null, label: string): Product[] {
  if (!dtos || dtos.length === 0) return [];
  try {
    for (const dto of dtos) {
      assertMappableProduct(dto);
    }
    return dtos.map(toProduct);
  } catch (error) {
    console.error(`[product] invalid ${label} payload`, error);
    return [];
  }
}

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [result, { language, t }] = await Promise.all([
    fetchProductDetail(slug),
    getServerDictionary(),
  ]);

  if (result.status === 'not-found') return { title: t.meta.productNotFound, robots: NOINDEX };
  if (result.status !== 'ok') return { title: t.meta.product };

  const og = firstBackendImageUrl(result.data.image_url, result.data.images);
  const name = pickLocalized(language, result.data.name, result.data.name_ar);
  const description =
    metaDescription(
      result.data.short_description
        ? pickLocalized(language, result.data.short_description, result.data.short_description_ar)
        : null,
    ) ??
    metaDescription(
      result.data.description
        ? pickLocalized(language, result.data.description, result.data.description_ar)
        : null,
    );
  const { canonical } = await currentAlternates(language);
  return {
    title: name,
    description,
    openGraph: openGraphFor(language, canonical, {
      title: name,
      description,
      images: og ? [{ url: og, alt: name }] : undefined,
    }),
    twitter: {
      card: og ? 'summary_large_image' : 'summary',
      title: name,
      ...(description ? { description } : {}),
      ...(og ? { images: [og] } : {}),
    },
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const result = await fetchProductDetail(slug);

  if (result.status === 'not-found') notFound();

  if (result.status === 'unavailable') {
    return <ProductStatusMessage kind="unavailable" />;
  }

  let detail;
  try {
    assertMappableProductDetail(result.data);
    detail = toProductDetail(result.data);
  } catch (error) {
    console.error('[product] invalid product detail payload', error);
    return <ProductStatusMessage kind="data-error" />;
  }

  const [relatedDtos, sameBrandDtos, { language, t }, origin, categoryTree] = await Promise.all([
    fetchRelatedProducts(slug),
    fetchSameBrandProducts(slug),
    getServerDictionary(),
    siteOrigin(),
    // Cached (the header uses it too); null when it fails — the breadcrumb then skips the parent.
    fetchCategories(),
  ]);

  const categoryParent = findParentCategory(categoryTree, detail.categorySlug);
  if (categoryParent) detail = { ...detail, categoryParent };

  // Rich results: price, availability, rating and the breadcrumb trail.
  const name = pickLocalized(language, detail.name, detail.nameAr);
  const productPath = `/products/${encodeURIComponent(detail.slug)}`;
  const structuredData = [
    productJsonLd({
      origin,
      url: absoluteUrl(origin, languagePath(productPath, language)),
      name,
      description: metaDescription(
        detail.shortDescription
          ? pickLocalized(language, detail.shortDescription, detail.shortDescriptionAr)
          : detail.description
            ? pickLocalized(language, detail.description, detail.descriptionAr)
            : null,
      ),
      images: detail.images.map((image) => image.url).filter((url) => /^https?:\/\//.test(url)),
      brand: pickLocalized(language, detail.brand, detail.brandAr) || null,
      category: pickLocalized(language, detail.category, detail.categoryAr) || null,
      price: detail.price,
      currency: 'OMR',
      availability: availabilityFor(result.data.stock_status),
      rating: { value: detail.rating, count: detail.reviewCount },
      seller: detail.merchantName ?? null,
    }),
    breadcrumbJsonLd(origin, language, [
      { name: t.nav.home, path: '/' },
      ...(detail.categoryParent
        ? [{
            name: pickLocalized(language, detail.categoryParent.name, detail.categoryParent.nameAr),
            path: `/products?category=${encodeURIComponent(detail.categoryParent.slug)}`,
          }]
        : []),
      ...(detail.categorySlug
        ? [{ name: pickLocalized(language, detail.category, detail.categoryAr), path: `/products?category=${encodeURIComponent(detail.categorySlug)}` }]
        : []),
      { name, path: productPath },
    ]),
  ];

  const related = mapRecommendations(relatedDtos, 'related').slice(0, 5);
  const relatedIds = new Set(related.map(product => product.id));
  const sameBrand = mapRecommendations(sameBrandDtos, 'same-brand')
    .filter(product => !relatedIds.has(product.id))
    .slice(0, 5);

  return (
    <div>
      <JsonLd data={structuredData} />
      <ProductDetailView product={detail} />

      {related.length > 0 && (
        <div className="border-t border-[#2D1F1F]/8">
          <FeaturedProducts
            products={related}
            title={translations.en.product.relatedProducts}
            titleAr={translations.ar.product.relatedProducts}
            viewAllHref={`/products?category=${detail.categorySlug}`}
          />
        </div>
      )}

      {sameBrand.length > 0 && (
        <div className="border-t border-[#2D1F1F]/8">
          <FeaturedProducts
            products={sameBrand}
            label={detail.brand}
            title={translations.en.product.moreFromBrand}
            titleAr={translations.ar.product.moreFromBrand}
            viewAllHref={`/products?brand=${detail.brandSlug}`}
          />
        </div>
      )}
    </div>
  );
}
