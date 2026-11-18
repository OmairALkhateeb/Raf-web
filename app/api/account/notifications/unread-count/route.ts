import { NextResponse } from 'next/server';
import { accountErrorResponse, applyAccountCookies } from '@/lib/api/server/account-route';
import { getLaravelUnreadCount } from '@/lib/api/server/notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getLaravelUnreadCount();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true, unread: result.data }), result);
}
