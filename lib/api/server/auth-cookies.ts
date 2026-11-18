import 'server-only';

import type { NextResponse } from 'next/server';
import type { LaravelAuthTokensDto } from '@/types/api/auth';

export const ACCESS_COOKIE = 'raf_access_token';
export const REFRESH_COOKIE = 'raf_refresh_token';
export const REMEMBER_COOKIE = 'raf_auth_remember';

/** Matches Laravel `JWT_REFRESH_TTL` default of 14 days, in seconds. */
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function baseCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/** Session cookie. JWT `exp` still enforces access-token lifetime server-side. */
export function accessCookieOptions() {
  return baseCookieOptions();
}

export function refreshCookieOptions(remember: boolean) {
  if (remember) {
    return {
      ...baseCookieOptions(),
      maxAge: REFRESH_MAX_AGE_SECONDS,
    };
  }
  return baseCookieOptions();
}

export function applyAuthCookies(
  response: NextResponse,
  tokens: LaravelAuthTokensDto,
  remember: boolean,
): NextResponse {
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, accessCookieOptions());
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, refreshCookieOptions(remember));
  response.cookies.set(
    REMEMBER_COOKIE,
    remember ? '1' : '0',
    refreshCookieOptions(remember),
  );
  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  const expired = { ...baseCookieOptions(), maxAge: 0 };
  response.cookies.set(ACCESS_COOKIE, '', expired);
  response.cookies.set(REFRESH_COOKIE, '', expired);
  response.cookies.set(REMEMBER_COOKIE, '', expired);
  return response;
}
