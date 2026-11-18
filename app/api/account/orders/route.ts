import { listLaravelOrders } from '@/lib/api/server/account';
import {
  accountErrorResponse,
  applyAccountCookies,
} from '@/lib/api/server/account-route';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listLaravelOrders();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({
      ok: true,
      orders: result.data.orders,
      meta: result.data.meta,
    }),
    result,
  );
}
