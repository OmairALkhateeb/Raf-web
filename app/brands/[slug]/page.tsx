import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
import { pickLocalized } from '@/lib/i18n/language';
import { notFound } from 'next/navigation';
import BrandStore, { type BrandStoreStatus } from '@/components/brands/BrandStore';
import { fetchBrandDetail, fetchBrandProducts } from '@/lib/api/server/brands';
import {
  brandStoreHref,
  parseBrandStoreSearchParams,
  pickTrackingParams,
} from '@/lib/brands/params';
import { toBrand } from '@/lib/mappers/brand';
import { assertMappableProduct, toProduct } from '@/lib/mappers/product';
import type { Brand, Product } from '@/types';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, currentAlternates, metaDescription, NOINDEX, openGraphFor } from '@/lib/seo/metadata';
import { siteOrigin } from '@/lib/seo/site';
import { resolveMediaUrl } from '@/lib/api/server/media';

type BrandPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [result, { language, t }] = await Promise.all([
    fetchBrandDetail(slug),
    getServerDictionary(),
  ]);

  if (result.status === 'not-found') return { title: t.meta.brandNotFound, robots: NOINDEX };
  if (result.status !== 'ok') return { title: t.meta.brand };

  const name = pickLocalized(language, result.data.name, result.data.name_ar);
  const description = metaDescription(
    result.data.description
      ? pickLocalized(language, result.data.description, result.data.description_ar)
      : null,
  );
  const title = t.meta.brandStore.replace('{name}', name);
  const image =
    resolveMediaUrl(result.data.cover_image_url) ?? resolveMediaUrl(result.data.logo_url) ?? undefined;
  const { canonical } = await currentAlternates(language);
  return {
    title,
    description,
    openGraph: openGraphFor(language, canonical, {
      title,
      description,
      images: image && /^https?:\/\//.test(image) ? [{ url: image, alt: name }] : undefined,
    }),
  };
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const { slug } = await params;
  const raw = await searchParams;
  const parsed = parseBrandStoreSearchParams(raw);
  const tracking = Object.fromEntries(pickTrackingParams(raw));

  const detail = await fetchBrandDetail(slug);

  if (detail.status === 'not-found') notFound();

  if (detail.status === 'unavailable') {
    return (
      <BrandStore
        status="unavailable"
        brand={null}
        products={[]}
        meta={null}
        tracking={tracking}
        firstPageHref="/brands"
      />
    );
  }

  let brand: Brand;
  try {
    brand = toBrand(detail.data, { featured: false });
  } catch (error) {
    console.error('[brand] invalid brand payload', error);
    return (
      <BrandStore
        status="data-error"
        brand={null}
        products={[]}
        meta={null}
        tracking={tracking}
        firstPageHref="/brands"
      />
    );
  }

  const firstPageHref = brandStoreHref(brand.slug, 1, pickTrackingParams(raw));

  if (!parsed.ok) {
    return (
      <BrandStore
        status="invalid"
        brand={brand}
        products={[]}
        meta={null}
        tracking={tracking}
        firstPageHref={firstPageHref}
      />
    );
  }

  const page = await fetchBrandProducts(slug, parsed.page);
  if (!page) {
    return (
      <BrandStore
        status="unavailable"
        brand={null}
        products={[]}
        meta={null}
        tracking={tracking}
        firstPageHref="/brands"
      />
    );
  }

  let products: Product[];
  try {
    for (const dto of page.data) {
      assertMappableProduct(dto);
    }
    products = page.data.map(toProduct);
  } catch (error) {
    console.error('[brand] invalid brand product payload', error);
    return (
      <BrandStore
        status="data-error"
        brand={null}
        products={[]}
        meta={null}
        tracking={tracking}
        firstPageHref="/brands"
      />
    );
  }

  const meta = {
    total: page.meta.total,
    currentPage: page.meta.current_page,
    lastPage: page.meta.last_page,
    perPage: page.meta.per_page,
  };

  const outOfRange = parsed.page > meta.lastPage;
  let status: BrandStoreStatus = 'ok';
  if (outOfRange) {
    status = 'beyond-page';
  } else if (products.length === 0) {
    status = 'empty';
  }

  const [{ language, t }, origin] = await Promise.all([getServerDictionary(), siteOrigin()]);
  const breadcrumb = breadcrumbJsonLd(origin, language, [
    { name: t.nav.home, path: '/' },
    { name: t.nav.brands, path: '/brands' },
    { name: pickLocalized(language, brand.name, brand.nameAr), path: `/brands/${encodeURIComponent(brand.slug)}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumb} />
      <BrandStore
        status={status}
        brand={brand}
        products={products}
        meta={meta}
        tracking={tracking}
        firstPageHref={firstPageHref}
      />
    </>
  );
}
