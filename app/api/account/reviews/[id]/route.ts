import { NextResponse } from 'next/server';
import { deleteLaravelReview, updateLaravelReview } from '@/lib/api/server/reviews';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { parseReviewUpdateBody } from '@/lib/account/reviews';

export const dynamic = 'force-dynamic';

type ReviewContext = { params: Promise<{ id: string }> };

function reviewId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

/** Edit one of the customer's reviews (back to moderation). */
export async function PATCH(request: Request, context: ReviewContext) {
  const id = reviewId((await context.params).id);
  if (id === null) return invalidAccountInput();
  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();
  const input = parseReviewUpdateBody(body);
  if (!input) return invalidAccountInput();

  const result = await updateLaravelReview(id, input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true, review: result.data }), result);
}

/** Delete one of the customer's reviews. */
export async function DELETE(_request: Request, context: ReviewContext) {
  const id = reviewId((await context.params).id);
  if (id === null) return invalidAccountInput();

  const result = await deleteLaravelReview(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true }), result);
}
