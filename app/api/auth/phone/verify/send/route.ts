import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  clearAuthCookies,
} from '@/lib/api/server/auth-cookies';
import {
  sendLaravelPhoneVerification,
  type PhoneVerifyOpResult,
} from '@/lib/api/server/phone-verification';
import type {
  PhoneVerifyErrorJson,
  PhoneVerifySuccessJson,
} from '@/types/api/auth';

export const dynamic = 'force-dynamic';

function applyCookies(
  response: NextResponse,
  result: PhoneVerifyOpResult,
): NextResponse {
  if (result.clearAuth) {
    clearAuthCookies(response);
  } else if (result.rotatedTokens) {
    applyAuthCookies(response, result.rotatedTokens, result.remember);
  }
  return response;
}

function errorStatus(code: PhoneVerifyErrorJson['code']): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'validation':
    case 'phone_missing':
      return 422;
    case 'unauthenticated':
      return 401;
    default:
      return 503;
  }
}

export async function POST() {
  const result = await sendLaravelPhoneVerification();

  if (!result.ok) {
    return applyCookies(
      NextResponse.json(result.error, {
        status: errorStatus(result.error.code),
      }),
      result,
    );
  }

  const success: PhoneVerifySuccessJson = { ok: true };
  return applyCookies(NextResponse.json(success), result);
}
