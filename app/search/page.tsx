import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
import { NOINDEX_FOLLOW } from '@/lib/seo/metadata';
import SearchView from '@/components/search/SearchView';
import { fetchPublicSearch } from '@/lib/api/server/catalog';
import {
  parseSearchPageParams,
  toPublicSearchQueryString,
} from '@/lib/search/params';
import { assertMappableProduct, toProduct } from '@/lib/mappers/product';

type SearchPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const [raw, { t }] = await Promise.all([searchParams, getServerDictionary()]);
  const parsed = parseSearchPageParams(raw);
  // Result pages stay out of the index; their product links are followed.
  if (!parsed.ok || !parsed.q) return { title: t.meta.search, robots: NOINDEX_FOLLOW };
  return { title: t.meta.searchFor.replace('{q}', parsed.q), robots: NOINDEX_FOLLOW };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams;
  const parsed = parseSearchPageParams(raw);

  if (!parsed.ok) {
    return (
      <SearchView status="invalid" q="" products={[]} meta={null} />
    );
  }

  if (!parsed.q) {
    return <SearchView status="idle" q="" products={[]} meta={null} />;
  }

  const page = await fetchPublicSearch(
    toPublicSearchQueryString(parsed.q, parsed.page),
  );

  if (!page) {
    return (
      <SearchView
        status="unavailable"
        q={parsed.q}
        products={[]}
        meta={null}
      />
    );
  }

  try {
    for (const dto of page.data) {
      assertMappableProduct(dto);
    }
  } catch (error) {
    console.error('[search] invalid product payload', error);
    return (
      <SearchView
        status="data-error"
        q={parsed.q}
        products={[]}
        meta={null}
      />
    );
  }

  const products = page.data.map(toProduct);
  const meta = {
    total: page.meta.total,
    currentPage: page.meta.current_page,
    lastPage: page.meta.last_page,
    perPage: page.meta.per_page,
  };

  return (
    <SearchView
      status={page.meta.total === 0 ? 'empty' : 'ok'}
      q={parsed.q}
      products={products}
      meta={meta}
    />
  );
}
