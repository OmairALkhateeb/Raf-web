import { acceptLaravelBulkOrder } from '@/lib/api/server/bulk-orders';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
} from '@/lib/api/server/account-route';
import { parseBulkOrderIdParam } from '@/lib/account/bulk-orders';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const { id: rawId } = await context.params;
  const id = parseBulkOrderIdParam(rawId);
  if (id === null) return invalidAccountInput();

  const result = await acceptLaravelBulkOrder(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, request: result.data }),
    result,
  );
}
