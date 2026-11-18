import { cancelLaravelReturn } from '@/lib/api/server/returns';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
} from '@/lib/api/server/account-route';
import { parseReturnIdParam } from '@/lib/account/returns';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ReturnContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: ReturnContext) {
  const { id: rawId } = await context.params;
  const id = parseReturnIdParam(rawId);
  if (id === null) return invalidAccountInput();

  const result = await cancelLaravelReturn(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true }), result);
}
