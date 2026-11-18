import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { CartClientError } from '@/types/api/cart';
import type { LaravelCartResult } from './cart';
import { applyAuthCookies, clearAuthCookies } from './auth-cookies';
import {
  GUEST_TOKEN_COOKIE,
  clearGuestTokenCookieOptions,
  guestTokenCookieOptions,
  normalizeGuestToken,
} from './guest-token';

export function errorStatus(error: CartClientError): number {
  switch (error.code) {
    case 'invalid_input':
      return 400;
    case 'validation':
      return 422;
    case 'not_found':
      return 404;
    case 'unauthenticated':
      return 401;
    default:
      return 503;
  }
}

export async function readGuestTokenCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return normalizeGuestToken(jar.get(GUEST_TOKEN_COOKIE)?.value);
}

export function cartJsonResponse(result: LaravelCartResult): NextResponse {
  const response = result.ok
    ? NextResponse.json({ ok: true, cart: result.snapshot })
    : NextResponse.json(result.error, { status: errorStatus(result.error) });

  return applyCartCookies(response, result);
}

export function invalidInputResponse(): NextResponse {
  const error: CartClientError = { ok: false, code: 'invalid_input' };
  return NextResponse.json(error, { status: 400 });
}

export function attachGuestToken(response: NextResponse, token?: string): NextResponse {
  const value = normalizeGuestToken(token);
  if (value) {
    response.cookies.set(GUEST_TOKEN_COOKIE, value, guestTokenCookieOptions());
  }
  return response;
}

export function clearGuestToken(response: NextResponse): NextResponse {
  response.cookies.set(GUEST_TOKEN_COOKIE, '', clearGuestTokenCookieOptions());
  return response;
}

function applyCartCookies(response: NextResponse, result: LaravelCartResult): NextResponse {
  if (result.clearAuth) {
    clearAuthCookies(response);
  } else if (result.rotatedTokens) {
    applyAuthCookies(response, result.rotatedTokens, result.remember ?? true);
  }

  if (result.clearGuestToken) {
    clearGuestToken(response);
  } else if (result.ok && result.guestToken) {
    attachGuestToken(response, result.guestToken);
  }

  return response;
}
