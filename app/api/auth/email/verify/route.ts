import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  clearAuthCookies,
} from '@/lib/api/server/auth-cookies';
import { readJsonBody, readStringField } from '@/lib/api/server/auth-route';
import {
  verifyLaravelEmailCode,
  type EmailVerifyOpResult,
} from '@/lib/api/server/email-verification';
import type {
  EmailVerifyErrorJson,
  EmailVerifySuccessJson,
} from '@/types/api/auth';

export const dynamic = 'force-dynamic';

function applyCookies(
  response: NextResponse,
  result: EmailVerifyOpResult,
): NextResponse {
  if (result.clearAuth) {
    clearAuthCookies(response);
  } else if (result.rotatedTokens) {
    applyAuthCookies(response, result.rotatedTokens, result.remember);
  }
  return response;
}

function errorStatus(code: EmailVerifyErrorJson['code']): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'validation':
      return 422;
    case 'unauthenticated':
      return 401;
    default:
      return 503;
  }
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const code = readStringField(body, 'code');

  if (code === undefined || code.trim() === '') {
    const error: EmailVerifyErrorJson = { ok: false, code: 'invalid_input' };
    return NextResponse.json(error, { status: 400 });
  }

  const result = await verifyLaravelEmailCode(code.trim());

  if (!result.ok) {
    return applyCookies(
      NextResponse.json(result.error, {
        status: errorStatus(result.error.code),
      }),
      result,
    );
  }

  const success: EmailVerifySuccessJson = { ok: true };
  return applyCookies(NextResponse.json(success), result);
}
