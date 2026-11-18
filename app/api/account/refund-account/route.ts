import { NextResponse } from 'next/server';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import {
  getLaravelRefundAccount,
  saveLaravelRefundAccount,
} from '@/lib/api/server/refund-account';
import { readRefundAccountBody } from '@/lib/account/refund-account';

export const dynamic = 'force-dynamic';

type Result = Awaited<ReturnType<typeof getLaravelRefundAccount>>;

function respond(result: Result): NextResponse {
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true, account: result.data }), result);
}

/** The bank account for refunds (profile `refund_iban` / `refund_account_name`). */
export async function GET() {
  return respond(await getLaravelRefundAccount());
}

/** Save or replace it: `{ iban, accountName }`. */
export async function PUT(request: Request) {
  const input = readRefundAccountBody(await readAccountJsonBody(request));
  if (!input) return invalidAccountInput();
  return respond(await saveLaravelRefundAccount(input));
}

/** Remove it (both fields `null`). */
export async function DELETE() {
  return respond(await saveLaravelRefundAccount(null));
}
