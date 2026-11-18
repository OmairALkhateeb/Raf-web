import { NextResponse } from 'next/server';
import { accountErrorResponse, applyAccountCookies } from '@/lib/api/server/account-route';
import { deleteReadLaravelNotifications } from '@/lib/api/server/notifications';

export const dynamic = 'force-dynamic';

/** Delete every read notification. */
export async function DELETE() {
  const result = await deleteReadLaravelNotifications();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true }), result);
}
