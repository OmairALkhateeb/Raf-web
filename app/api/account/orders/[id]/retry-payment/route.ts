import { retryLaravelPayment } from '@/lib/api/server/payments';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
} from '@/lib/api/server/account-route';
import { parseOrderIdParam } from '@/lib/account/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type OrderContext = { params: Promise<{ id: string }> };

/**
 * "Try again" on an unpaid order still inside its payment time: answers the
 * order with a `payment.redirectUrl` to open (the same page while it's open).
 */
export async function POST(_request: Request, context: OrderContext) {
  const { id: rawId } = await context.params;
  const id = parseOrderIdParam(rawId);
  if (id === null) return invalidAccountInput();

  const result = await retryLaravelPayment(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, order: result.data }),
    result,
  );
}
