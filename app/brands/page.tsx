import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
import BrandsIndex, {
  type BrandsIndexStatus,
} from '@/components/brands/BrandsIndex';
import { fetchBrandDirectory } from '@/lib/api/server/brands';
import {
  DEFAULT_BRAND_DIRECTORY_QUERY,
  hasActiveBrandDirectoryFilters,
  parseBrandDirectorySearchParams,
  pickTrackingParams,
} from '@/lib/brands/params';
import { toBrand } from '@/lib/mappers/brand';
import type { Brand } from '@/types';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return { title: t.meta.brands, description: t.meta.brandsDescription };
}

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const parsed = parseBrandDirectorySearchParams(raw);
  const tracking = Object.fromEntries(pickTrackingParams(raw));

  if (!parsed.ok) {
    return (
      <BrandsIndex
        status="invalid"
        brands={[]}
        query={DEFAULT_BRAND_DIRECTORY_QUERY}
        meta={null}
        tracking={tracking}
      />
    );
  }

  const query = parsed.query;
  const page = await fetchBrandDirectory(query);

  if (page === null) {
    return (
      <BrandsIndex
        status="unavailable"
        brands={[]}
        query={query}
        meta={null}
        tracking={tracking}
      />
    );
  }

  let brands: Brand[];
  try {
    brands = page.data.map((dto) => toBrand(dto, { featured: false }));
  } catch (error) {
    console.error('[brands] invalid brand payload', error);
    return (
      <BrandsIndex
        status="data-error"
        brands={[]}
        query={query}
        meta={null}
        tracking={tracking}
      />
    );
  }

  const meta = {
    total: page.meta.total,
    currentPage: page.meta.current_page,
    lastPage: page.meta.last_page,
    perPage: page.meta.per_page,
  };

  let status: BrandsIndexStatus = 'ok';
  if (query.page > meta.lastPage && meta.total > 0) {
    status = 'beyond-page';
  } else if (meta.total === 0) {
    status = hasActiveBrandDirectoryFilters(query) ? 'no-matching' : 'empty';
  }

  return (
    <BrandsIndex
      status={status}
      brands={brands}
      query={query}
      meta={meta}
      tracking={tracking}
    />
  );
}
