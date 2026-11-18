import { NextResponse } from 'next/server';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import {
  deleteLaravelDeviceToken,
  registerLaravelDeviceToken,
} from '@/lib/api/server/notifications';

export const dynamic = 'force-dynamic';

/** Laravel's limits: token 512, device_name 190. */
function readToken(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.length <= 512 ? value.trim() : null;
}

/** `{ token, locale, deviceName? }`: this browser receives pushes (web, customer app). */
export async function POST(request: Request) {
  const body = (await readAccountJsonBody(request)) as Record<string, unknown> | undefined;
  const token = readToken(body?.token);
  const locale = body?.locale;
  if (!token || (locale !== 'en' && locale !== 'ar')) return invalidAccountInput();
  const deviceName =
    typeof body?.deviceName === 'string' && body.deviceName.trim()
      ? body.deviceName.trim().slice(0, 190)
      : null;

  const result = await registerLaravelDeviceToken({ token, locale, deviceName });
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true }), result);
}

/** `{ token }`: this browser stops receiving pushes. */
export async function DELETE(request: Request) {
  const body = (await readAccountJsonBody(request)) as Record<string, unknown> | undefined;
  const token = readToken(body?.token);
  if (!token) return invalidAccountInput();

  const result = await deleteLaravelDeviceToken(token);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true }), result);
}
