import { getLaravelOrder } from '@/lib/api/server/account';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
} from '@/lib/api/server/account-route';
import { parseOrderIdParam } from '@/lib/account/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type OrderContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: OrderContext) {
  const { id: rawId } = await context.params;
  const id = parseOrderIdParam(rawId);
  if (id === null) return invalidAccountInput();

  const result = await getLaravelOrder(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, order: result.data }),
    result,
  );
}
