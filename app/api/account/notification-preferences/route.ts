import { NextResponse } from 'next/server';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import {
  getLaravelNotificationPreferences,
  updateLaravelNotificationPreferences,
} from '@/lib/api/server/notifications';

export const dynamic = 'force-dynamic';

const CATEGORIES = new Set(['orders', 'shipping', 'returns', 'community', 'announcements', 'other']);

export async function GET() {
  const result = await getLaravelNotificationPreferences();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true, preferences: result.data }), result);
}

/**
 * `{ locale?: 'en' | 'ar', preferences?: { [category]: { push?: boolean, mail?: boolean } } }`
 * — only what changed is forwarded.
 */
export async function PUT(request: Request) {
  const body = (await readAccountJsonBody(request)) as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') return invalidAccountInput();

  const forward: Record<string, unknown> = {};
  if (body.locale !== undefined) {
    if (body.locale !== 'en' && body.locale !== 'ar') return invalidAccountInput();
    forward.locale = body.locale;
  }
  if (body.preferences !== undefined) {
    const prefs = body.preferences;
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return invalidAccountInput();
    const clean: Record<string, Record<string, boolean>> = {};
    for (const [cat, value] of Object.entries(prefs as Record<string, unknown>)) {
      if (!CATEGORIES.has(cat) || !value || typeof value !== 'object') return invalidAccountInput();
      const channels: Record<string, boolean> = {};
      for (const [channel, on] of Object.entries(value as Record<string, unknown>)) {
        if ((channel !== 'push' && channel !== 'mail') || typeof on !== 'boolean') {
          return invalidAccountInput();
        }
        channels[channel] = on;
      }
      clean[cat] = channels;
    }
    forward.preferences = clean;
  }
  if (Object.keys(forward).length === 0) return invalidAccountInput();

  const result = await updateLaravelNotificationPreferences(forward);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true, preferences: result.data }), result);
}
