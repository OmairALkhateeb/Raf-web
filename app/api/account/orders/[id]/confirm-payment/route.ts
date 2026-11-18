import { confirmLaravelPayment } from '@/lib/api/server/payments';
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
 * After the customer comes back from Thawani (or returns to an unpaid order):
 * the backend checks the payment with Thawani and answers the order.
 */
export async function POST(_request: Request, context: OrderContext) {
  const { id: rawId } = await context.params;
  const id = parseOrderIdParam(rawId);
  if (id === null) return invalidAccountInput();

  const result = await confirmLaravelPayment(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, order: result.data }),
    result,
  );
}
