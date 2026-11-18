import {
  createLaravelBulkOrder,
  listLaravelBulkOrders,
} from '@/lib/api/server/bulk-orders';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { parseBulkOrderCreateBody } from '@/lib/account/bulk-orders';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageRaw = url.searchParams.get('page');
  const page =
    pageRaw && /^\d+$/.test(pageRaw) ? Number.parseInt(pageRaw, 10) : 1;
  if (!Number.isInteger(page) || page < 1) return invalidAccountInput();

  const result = await listLaravelBulkOrders(page);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({
      ok: true,
      requests: result.data.requests,
      meta: result.data.meta,
    }),
    result,
  );
}

export async function POST(request: Request) {
  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();

  const input = parseBulkOrderCreateBody(body);
  if (!input) return invalidAccountInput();

  const result = await createLaravelBulkOrder(input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, request: result.data }, { status: 201 }),
    result,
  );
}
