import { NextResponse } from 'next/server';
import type { AccountDeletionCheckJson } from '@/types/api/account';
import { accountErrorResponse, applyAccountCookies } from '@/lib/api/server/account-route';
import { getLaravelDeletionCheck } from '@/lib/api/server/account-deletion';

export const dynamic = 'force-dynamic';

/** Can this account be deleted now? Asked when "Delete my account" opens. */
export async function GET() {
  const result = await getLaravelDeletionCheck();
  if (!result.ok) return accountErrorResponse(result);

  const body: AccountDeletionCheckJson = { ok: true, check: result.data };
  return applyAccountCookies(NextResponse.json(body), result);
}
