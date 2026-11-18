import { previewLaravelCoupon } from '@/lib/api/server/checkout';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { parseCouponPreviewBody } from '@/lib/account/checkout';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** The totals an order would have with this coupon (nothing is reserved). */
export async function POST(request: Request) {
  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();

  const input = parseCouponPreviewBody(body);
  if (!input) return invalidAccountInput();

  const result = await previewLaravelCoupon(input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, preview: result.data }),
    result,
  );
}
