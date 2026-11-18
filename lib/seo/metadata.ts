import 'server-only';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { Language } from '@/types';
import { buildAlternates, languagePath, PATH_HEADER } from './alternates';
import { absoluteUrl } from './site';

/** Cart, checkout, account and sign-in pages: never in search results. */
export const NOINDEX: Metadata['robots'] = { index: false, follow: false };

/** Search results: not indexed, but their product links are followed. */
export const NOINDEX_FOLLOW: Metadata['robots'] = { index: false, follow: true };

/** Canonical + hreflang paths of the current request. */
export async function currentAlternates(language: Language) {
  const requestHeaders = await headers();
  return buildAlternates(requestHeaders.get(PATH_HEADER) ?? '/', language);
}

/**
 * A page's own Open Graph block. A page's `openGraph` replaces the layout's
 * entirely, so the shared fields are repeated here.
 */
export function openGraphFor(
  language: Language,
  url: string,
  fields: { title: string; description?: string; images?: { url: string; alt?: string }[] },
): NonNullable<Metadata['openGraph']> {
  return {
    type: 'website',
    siteName: 'RAF',
    locale: language === 'ar' ? 'ar_OM' : 'en_OM',
    alternateLocale: language === 'ar' ? 'en_OM' : 'ar_OM',
    url,
    title: fields.title,
    ...(fields.description ? { description: fields.description } : {}),
    ...(fields.images?.length ? { images: fields.images } : {}),
  };
}

/** Plain text for meta descriptions: no tags, single spaces, max ~160 chars. */
export function metaDescription(value: string | null | undefined): string | undefined {
  const text = value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

/* ── schema.org JSON-LD ── */

export function organizationJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'RAF',
    url: `${origin}/`,
    logo: absoluteUrl(origin, '/images/logo.png'),
    areaServed: { '@type': 'Country', name: 'Oman' },
  };
}

/** Lets search engines show a search box for the store. */
export function websiteJsonLd(origin: string, language: Language, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name,
    url: `${origin}/`,
    inLanguage: language === 'ar' ? 'ar-OM' : 'en-OM',
    publisher: { '@id': `${origin}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: absoluteUrl(origin, languagePath('/search?q={search_term_string}', language))
          .replace('%7B', '{')
          .replace('%7D', '}'),
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(
  origin: string,
  language: Language,
  items: { name: string; path: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(origin, languagePath(item.path, language)),
    })),
  };
}

export type SchemaAvailability = 'InStock' | 'LimitedAvailability' | 'OutOfStock';

/** Backend `stock_status` → schema.org availability (unknown values sell). */
export function availabilityFor(stockStatus: string | null | undefined): SchemaAvailability {
  if (stockStatus === 'out_of_stock') return 'OutOfStock';
  if (stockStatus === 'low_stock') return 'LimitedAvailability';
  return 'InStock';
}

export function productJsonLd(input: {
  origin: string;
  url: string;
  name: string;
  description?: string;
  images: string[];
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  price: number;
  currency: string;
  availability: SchemaAvailability;
  rating?: { value: number; count: number };
  seller?: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.images.length ? { image: input.images } : {}),
    ...(input.sku ? { sku: input.sku } : {}),
    ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
    ...(input.category ? { category: input.category } : {}),
    offers: {
      '@type': 'Offer',
      url: input.url,
      price: input.price.toFixed(3),
      priceCurrency: input.currency,
      availability: `https://schema.org/${input.availability}`,
      itemCondition: 'https://schema.org/NewCondition',
      seller: input.seller
        ? { '@type': 'Organization', name: input.seller }
        : { '@id': `${input.origin}/#organization` },
    },
    ...(input.rating && input.rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: input.rating.value,
            reviewCount: input.rating.count,
          },
        }
      : {}),
  };
}
