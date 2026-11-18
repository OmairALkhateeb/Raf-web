import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerDictionary } from '@/lib/i18n/server';
import { pickLocalized } from '@/lib/i18n/language';
import { fetchBundle } from '@/lib/api/server/bundles';
import BundleDetailView from '@/components/bundles/BundleDetailView';
import JsonLd from '@/components/seo/JsonLd';
import { languagePath } from '@/lib/seo/alternates';
import {
  breadcrumbJsonLd,
  currentAlternates,
  metaDescription,
  NOINDEX,
  openGraphFor,
  productJsonLd,
} from '@/lib/seo/metadata';
import { absoluteUrl, siteOrigin } from '@/lib/seo/site';

type BundlePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BundlePageProps): Promise<Metadata> {
  const [{ slug }, { language, t }] = await Promise.all([params, getServerDictionary()]);
  const result = await fetchBundle(slug);
  if (result.status === 'not-found') return { title: t.bundles.notFound, robots: NOINDEX };
  if (result.status !== 'ok') return { title: t.bundles.title };
  const { bundle } = result;
  const name = pickLocalized(language, bundle.name, bundle.nameAr);
  const description = metaDescription(
    bundle.description ? pickLocalized(language, bundle.description, bundle.descriptionAr) : null,
  );
  const image = /^https?:\/\//.test(bundle.imageUrl) ? bundle.imageUrl : undefined;
  const { canonical } = await currentAlternates(language);
  return {
    title: name,
    description,
    openGraph: openGraphFor(language, canonical, {
      title: name,
      description,
      images: image ? [{ url: image, alt: name }] : undefined,
    }),
  };
}

export default async function BundlePage({ params }: BundlePageProps) {
  const [{ slug }, { language, t }] = await Promise.all([params, getServerDictionary()]);
  const result = await fetchBundle(slug);

  if (result.status !== 'ok') {
    return (
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-32 text-center">
        <h1 className="text-2xl font-serif text-[#2D1F1F] mb-3">
          {result.status === 'not-found' ? t.bundles.notFound : t.bundles.unavailable}
        </h1>
        {result.status === 'not-found' ? (
          <p className="text-sm text-[#2D1F1F]/45 mb-8">{t.bundles.notFoundHint}</p>
        ) : null}
        <Link href="/bundles" className="text-[11px] font-black tracking-[0.2em] uppercase text-[#C9A84C]">
          {t.bundles.viewAll}
        </Link>
      </div>
    );
  }

  const { bundle } = result;
  const origin = await siteOrigin();
  const name = pickLocalized(language, bundle.name, bundle.nameAr);
  const bundlePath = `/bundles/${encodeURIComponent(bundle.slug)}`;
  const structuredData = [
    productJsonLd({
      origin,
      url: absoluteUrl(origin, languagePath(bundlePath, language)),
      name,
      description: metaDescription(
        bundle.description ? pickLocalized(language, bundle.description, bundle.descriptionAr) : null,
      ),
      images: /^https?:\/\//.test(bundle.imageUrl) ? [bundle.imageUrl] : [],
      price: bundle.bundlePrice,
      currency: 'OMR',
      availability: bundle.inStock ? 'InStock' : 'OutOfStock',
    }),
    breadcrumbJsonLd(origin, language, [
      { name: t.nav.home, path: '/' },
      { name: t.bundles.title, path: '/bundles' },
      { name, path: bundlePath },
    ]),
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <BundleDetailView bundle={bundle} />
    </>
  );
}
