import { NextResponse } from 'next/server';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { markAllLaravelNotificationsRead } from '@/lib/api/server/notifications';

export const dynamic = 'force-dynamic';

const CATEGORIES = new Set(['orders', 'shipping', 'returns', 'community', 'announcements', 'other']);

/** Optional `{ category }` limits it to one tab. */
export async function POST(request: Request) {
  const body = (await readAccountJsonBody(request)) as { category?: unknown } | undefined;
  const category = typeof body?.category === 'string' ? body.category : null;
  if (category && !CATEGORIES.has(category)) return invalidAccountInput();

  const result = await markAllLaravelNotificationsRead(category);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true }), result);
}
