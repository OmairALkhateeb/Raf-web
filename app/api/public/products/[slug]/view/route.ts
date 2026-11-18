import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api/server/env';

export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/i;

type Context = { params: Promise<{ slug: string }> };

/** Counts one product view (#22): POST /api/public/products/{slug}/view → 204. */
export async function POST(_request: Request, context: Context) {
  const { slug } = await context.params;
  if (!SLUG.test(slug)) return new NextResponse(null, { status: 400 });
  try {
    const res = await fetch(`${apiBaseUrl()}/api/public/products/${encodeURIComponent(slug)}/view`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return new NextResponse(null, { status: res.ok ? 204 : 502 });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
