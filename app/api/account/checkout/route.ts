import { createLaravelCheckout } from '@/lib/api/server/checkout';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { parseCheckoutCreateBody } from '@/lib/account/checkout';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Same-origin BFF for customer checkout.
 * Requires auth cookies; forwards Bearer access token server-side via withCustomerAuth.
 * Accepts only addressId, shippingMethodId, optional couponCode, idempotencyKey.
 */
export async function POST(request: Request) {
  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();

  const input = parseCheckoutCreateBody(body);
  if (!input) return invalidAccountInput();

  const result = await createLaravelCheckout(input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, order: result.data }, { status: 201 }),
    result,
  );
}
