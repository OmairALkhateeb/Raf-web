import { NextResponse } from 'next/server';
import { fetchPublicSearch } from '@/lib/api/server/catalog';
import { assertMappableProduct, toProduct } from '@/lib/mappers/product';
import { CATALOG_PER_PAGE } from '@/lib/catalog/params';

export const dynamic = 'force-dynamic';

/**
 * Same-origin proxy for GET /api/public/search.
 * No auth. Safe product DTOs only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const pageRaw = url.searchParams.get('page');
  let page = 1;
  if (pageRaw !== null && pageRaw !== '') {
    if (!/^[1-9]\d*$/.test(pageRaw)) {
      return NextResponse.json(
        { ok: false, code: 'invalid_input' },
        { status: 400 },
      );
    }
    page = Number.parseInt(pageRaw, 10);
  }

  const perPageRaw = url.searchParams.get('per_page');
  let perPage = 8;
  if (perPageRaw !== null && perPageRaw !== '') {
    if (!/^[1-9]\d*$/.test(perPageRaw)) {
      return NextResponse.json(
        { ok: false, code: 'invalid_input' },
        { status: 400 },
      );
    }
    perPage = Math.min(Number.parseInt(perPageRaw, 10), CATALOG_PER_PAGE);
  }

  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  sp.set('per_page', String(perPage));
  sp.set('page', String(page));
  sp.set('sort', 'newest');

  const pageResult = await fetchPublicSearch(sp.toString());
  if (!pageResult) {
    return NextResponse.json(
      { ok: false, code: 'unavailable' },
      { status: 503 },
    );
  }

  const products = [];
  for (const dto of pageResult.data) {
    try {
      assertMappableProduct(dto);
      products.push(toProduct(dto));
    } catch (error) {
      console.error('[search bff] skipped unmappable product', error);
    }
  }

  return NextResponse.json({
    ok: true,
    products,
    meta: {
      total: pageResult.meta.total,
      currentPage: pageResult.meta.current_page,
      lastPage: pageResult.meta.last_page,
      perPage: pageResult.meta.per_page,
    },
    q,
  });
}
