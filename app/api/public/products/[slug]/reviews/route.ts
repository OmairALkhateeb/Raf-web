import { NextResponse } from 'next/server';
import { fetchProductReviews } from '@/lib/api/server/products';
import { toReviews } from '@/lib/mappers/product';

export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/i;
const PER_PAGE = 10;

type Context = { params: Promise<{ slug: string }> };

/** One page of a product's approved reviews ("Show more" on the product page). */
export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  const pageRaw = new URL(request.url).searchParams.get('page') ?? '1';
  const page = /^\d{1,4}$/.test(pageRaw) ? Number(pageRaw) : 0;
  if (!SLUG.test(slug) || page < 1) {
    return NextResponse.json({ ok: false, code: 'invalid_input' }, { status: 400 });
  }

  const result = await fetchProductReviews(slug, page, PER_PAGE);
  if (!result) {
    return NextResponse.json({ ok: false, code: 'unavailable' }, { status: 503 });
  }
  return NextResponse.json({
    ok: true,
    reviews: toReviews(result.reviews),
    currentPage: result.currentPage,
    lastPage: result.lastPage,
    total: result.total,
  });
}
