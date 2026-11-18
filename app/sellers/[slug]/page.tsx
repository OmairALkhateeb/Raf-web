import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerDictionary } from '@/lib/i18n/server';
import { fetchMerchantDetail, fetchMerchantProducts } from '@/lib/api/server/merchants';
import { resolveMediaUrl } from '@/lib/api/server/media';
import { toSellerStore } from '@/lib/mappers/merchant';
import { assertMappableProduct, toProduct } from '@/lib/mappers/product';
import SellerStore, {
  type SellerProductsMeta,
  type SellerProductsStatus,
} from '@/components/sellers/SellerStore';
import { parseSellerStoreParams, sellerStoreHref } from '@/lib/sellers/params';
import SellerStatusMessage from '@/components/sellers/SellerStatusMessage';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, currentAlternates, metaDescription, NOINDEX, openGraphFor } from '@/lib/seo/metadata';
import { siteOrigin } from '@/lib/seo/site';
import type { Product, SellerStore as SellerStoreData } from '@/types';

// No loading.tsx in this segment on purpose: a streamed response can't send
// the 404 status that notFound() gives an unknown or closed store.

type SellerPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: SellerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [result, { language, t }] = await Promise.all([fetchMerchantDetail(slug), getServerDictionary()]);

  if (result.status === 'not-found') return { title: t.meta.sellerNotFound, robots: NOINDEX };
  if (result.status !== 'ok') return { title: t.meta.seller };

  const name = result.data.name?.trim() || t.meta.seller;
  const title = t.meta.sellerStore.replace('{name}', name);
  const description =
    metaDescription(result.data.description) ?? t.meta.sellerDescription.replace('{name}', name);
  const image = resolveMediaUrl(result.data.logo_url) ?? undefined;
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

export default async function SellerPage({ params, searchParams }: SellerPageProps) {
  const { slug } = await params;
  const raw = await searchParams;
  const detail = await fetchMerchantDetail(slug);

  if (detail.status === 'not-found') notFound();
  if (detail.status === 'unavailable') return <SellerStatusMessage kind="unavailable" />;

  let store: SellerStoreData;
  try {
    store = toSellerStore(detail.data);
  } catch (error) {
    console.error('[merchant] invalid merchant payload', error);
    return <SellerStatusMessage kind="data-error" />;
  }

  // Opened by id (or an old slug): move to the store's own address.
  let requested = slug;
  try {
    requested = decodeURIComponent(slug);
  } catch {
    // Malformed escape: compare as it came.
  }
  const query = parseSellerStoreParams(
    raw,
    store.categories.map((category) => category.id),
  );

  if (requested !== store.slug) {
    redirect(sellerStoreHref(store.slug, query));
  }

  const page = await fetchMerchantProducts(store.slug, query);
  let products: Product[] = [];
  let productsStatus: SellerProductsStatus = 'unavailable';
  let meta: SellerProductsMeta | null = null;
  if (page) {
    try {
      for (const dto of page.data) assertMappableProduct(dto);
      products = page.data.map(toProduct);
      meta = {
        total: page.meta.total,
        currentPage: page.meta.current_page,
        lastPage: Math.max(page.meta.last_page, 1),
      };
      const filtered = query.categoryId !== undefined || !!query.q;
      if (products.length > 0) productsStatus = 'ok';
      else if (meta.total > 0 && query.page > meta.lastPage) productsStatus = 'beyond-page';
      else productsStatus = filtered ? 'no-match' : 'empty';
    } catch (error) {
      console.error('[merchant] invalid merchant product payload', error);
    }
  }

  const [{ language, t }, origin] = await Promise.all([getServerDictionary(), siteOrigin()]);
  const breadcrumb = breadcrumbJsonLd(origin, language, [
    { name: t.nav.home, path: '/' },
    { name: store.name, path: `/sellers/${encodeURIComponent(store.slug)}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumb} />
      <SellerStore
        store={store}
        query={query}
        products={products}
        productsStatus={productsStatus}
        meta={meta}
      />
    </>
  );
}
