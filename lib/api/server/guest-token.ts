import 'server-only';

export const GUEST_TOKEN_COOKIE = 'raf_guest_token';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export function guestTokenCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
  };
}

export function clearGuestTokenCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  };
}

export function normalizeGuestToken(value: string | null | undefined): string | undefined {
  const token = value?.trim();
  return token ? token : undefined;
}
