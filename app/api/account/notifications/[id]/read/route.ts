import { NextResponse } from 'next/server';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
} from '@/lib/api/server/account-route';
import { markLaravelNotificationRead } from '@/lib/api/server/notifications';

export const dynamic = 'force-dynamic';

const NOTIFICATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!NOTIFICATION_ID.test(id)) return invalidAccountInput();
  const result = await markLaravelNotificationRead(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true }), result);
}
