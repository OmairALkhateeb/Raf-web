import {
  createLaravelReturn,
  listLaravelReturns,
} from '@/lib/api/server/returns';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { parseReturnCreateBody } from '@/lib/account/returns';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listLaravelReturns();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({
      ok: true,
      returns: result.data.returns,
      meta: result.data.meta,
    }),
    result,
  );
}

export async function POST(request: Request) {
  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();

  const input = parseReturnCreateBody(body);
  if (!input) return invalidAccountInput();

  const result = await createLaravelReturn(input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json(
      { ok: true, returnRequest: result.data },
      { status: 201 },
    ),
    result,
  );
}
