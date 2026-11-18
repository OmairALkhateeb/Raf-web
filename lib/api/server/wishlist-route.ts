import 'server-only';

import { NextResponse } from 'next/server';
import type { WishlistClientError } from '@/types/api/wishlist';
import type { WishlistOpResult } from './wishlist';
import { applyAuthCookies, clearAuthCookies } from './auth-cookies';

export function wishlistErrorStatus(error: WishlistClientError): number {
  switch (error.code) {
    case 'invalid_input':
      return 400;
    case 'validation':
      return 422;
    case 'not_found':
      return 404;
    case 'forbidden':
      return 403;
    case 'unauthenticated':
      return 401;
    default:
      return 503;
  }
}

export function invalidWishlistInput(): NextResponse {
  const error: WishlistClientError = { ok: false, code: 'invalid_input' };
  return NextResponse.json(error, { status: 400 });
}

type WishlistOpFailure = Extract<WishlistOpResult<unknown>, { ok: false }>;

export function applyWishlistCookies<T>(
  response: NextResponse,
  result: WishlistOpResult<T>,
): NextResponse {
  if (result.clearAuth) {
    clearAuthCookies(response);
  } else if (result.rotatedTokens) {
    applyAuthCookies(response, result.rotatedTokens, result.remember);
  }
  return response;
}

export function wishlistErrorResponse(result: WishlistOpFailure): NextResponse {
  const response = NextResponse.json(result.error, {
    status: wishlistErrorStatus(result.error),
  });
  return applyWishlistCookies(response, result);
}

export async function readWishlistJsonBody(
  request: Request,
): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    console.error('Wishlist route received a non-JSON body');
    return undefined;
  }
}
