import { NextResponse } from 'next/server';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
} from '@/lib/api/server/account-route';
import { listLaravelNotifications } from '@/lib/api/server/notifications';

export const dynamic = 'force-dynamic';

const CATEGORIES = new Set(['orders', 'shipping', 'returns', 'community', 'announcements', 'other']);

/** Inbox page: `?page=&unread=1&category=`. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pageRaw = params.get('page') ?? '1';
  const page = /^\d{1,4}$/.test(pageRaw) ? Number(pageRaw) : 0;
  const category = params.get('category');
  if (page < 1 || (category && !CATEGORIES.has(category))) return invalidAccountInput();

  const result = await listLaravelNotifications({
    page,
    perPage: 20,
    unread: params.get('unread') === '1',
    category: category || null,
  });
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true, page: result.data }), result);
}
