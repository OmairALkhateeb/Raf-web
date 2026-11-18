import {
  createLaravelReview,
  listLaravelReviews,
} from '@/lib/api/server/reviews';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { parseReviewCreateBody } from '@/lib/account/reviews';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listLaravelReviews();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({
      ok: true,
      reviews: result.data.reviews,
      meta: result.data.meta,
    }),
    result,
  );
}

export async function POST(request: Request) {
  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();

  const input = parseReviewCreateBody(body);
  if (!input) return invalidAccountInput();

  const result = await createLaravelReview(input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, review: result.data }, { status: 201 }),
    result,
  );
}
