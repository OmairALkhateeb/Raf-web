import 'server-only';

import { NextResponse } from 'next/server';
import type { AccountClientError } from '@/types/api/account';
import type { AccountOpResult } from './account';
import { applyAuthCookies, clearAuthCookies } from './auth-cookies';

export function accountErrorStatus(error: AccountClientError): number {
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
    case 'rate_limited':
      return 429;
    default:
      return 503;
  }
}

export function invalidAccountInput(): NextResponse {
  const error: AccountClientError = { ok: false, code: 'invalid_input' };
  return NextResponse.json(error, { status: 400 });
}

type AccountOpFailure = Extract<AccountOpResult<unknown>, { ok: false }>;

export function applyAccountCookies<T>(
  response: NextResponse,
  result: AccountOpResult<T>,
): NextResponse {
  if (result.clearAuth) {
    clearAuthCookies(response);
  } else if (result.rotatedTokens) {
    applyAuthCookies(response, result.rotatedTokens, result.remember);
  }
  return response;
}

export function accountErrorResponse(result: AccountOpFailure): NextResponse {
  const response = NextResponse.json(result.error, {
    status: accountErrorStatus(result.error),
  });
  return applyAccountCookies(response, result);
}

export async function readAccountJsonBody(
  request: Request,
): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    console.error('Account route received a non-JSON body');
    return undefined;
  }
}
