import { getLaravelReturnReasons } from '@/lib/api/server/returns';
import {
  accountErrorResponse,
  applyAccountCookies,
} from '@/lib/api/server/account-route';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Reason codes (with both labels) and the return window, from the backend. */
export async function GET() {
  const result = await getLaravelReturnReasons();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, reasons: result.data }),
    result,
  );
}
