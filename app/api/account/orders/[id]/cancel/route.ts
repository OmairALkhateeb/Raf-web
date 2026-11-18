import { cancelLaravelOrder } from '@/lib/api/server/payments';
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
 * "Cancel order" on an order that isn't paid yet (guide §5.3-b): the backend
 * cancels it, closes Thawani's page, releases the stock and coupon and puts
 * the lines back in the cart. Answers the order and what went back.
 */
export async function POST(_request: Request, context: OrderContext) {
  const { id: rawId } = await context.params;
  const id = parseOrderIdParam(rawId);
  if (id === null) return invalidAccountInput();

  const result = await cancelLaravelOrder(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, order: result.data.order, cart: result.data.cart }),
    result,
  );
}
