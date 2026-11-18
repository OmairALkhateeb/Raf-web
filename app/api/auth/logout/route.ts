import { clearAuthCookies } from '@/lib/api/server/auth-cookies';
import { logoutLaravel, readAuthCookieJar } from '@/lib/api/server/auth';
import { authSessionResponse } from '@/lib/api/server/auth-route';

export const dynamic = 'force-dynamic';

/** Optional JSON `{ deviceToken }`: this browser's push token, removed with the session. */
async function readDeviceToken(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { deviceToken?: unknown } | null;
    const token = body?.deviceToken;
    return typeof token === 'string' && token.trim() && token.length <= 512 ? token.trim() : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const jar = await readAuthCookieJar();
  const deviceToken = await readDeviceToken(request);

  try {
    await logoutLaravel(jar, deviceToken);
  } catch (error) {
    console.error('Laravel logout threw', error instanceof Error ? error.name : 'unknown');
  }

  return clearAuthCookies(authSessionResponse(null));
}
