import { NextResponse } from 'next/server';
import { fetchProductQuestions } from '@/lib/api/server/products';

export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/i;
const PER_PAGE = 5;

type Context = { params: Promise<{ slug: string }> };

/** One page of a product's answered questions (product page Q&A). */
export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  const pageRaw = new URL(request.url).searchParams.get('page') ?? '1';
  const page = /^\d{1,4}$/.test(pageRaw) ? Number(pageRaw) : 0;
  if (!SLUG.test(slug) || page < 1) {
    return NextResponse.json({ ok: false, code: 'invalid_input' }, { status: 400 });
  }
  const result = await fetchProductQuestions(slug, page, PER_PAGE);
  if (!result) {
    return NextResponse.json({ ok: false, code: 'unavailable' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...result });
}
