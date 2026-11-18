import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  clearAuthCookies,
} from '@/lib/api/server/auth-cookies';
import { readJsonBody, readStringField } from '@/lib/api/server/auth-route';
import {
  changeLaravelPassword,
  type PasswordChangeOpResult,
} from '@/lib/api/server/password-change';
import type {
  PasswordChangeErrorJson,
  PasswordChangeSuccessJson,
} from '@/types/api/auth';

export const dynamic = 'force-dynamic';

function applyCookies(
  response: NextResponse,
  result: PasswordChangeOpResult,
): NextResponse {
  if (result.clearAuth) {
    clearAuthCookies(response);
  } else if (result.rotatedTokens) {
    applyAuthCookies(response, result.rotatedTokens, result.remember);
  }
  return response;
}

function errorStatus(code: PasswordChangeErrorJson['code']): number {
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
  const currentPassword = readStringField(body, 'current_password');
  const password = readStringField(body, 'password');
  const passwordConfirmation = readStringField(body, 'password_confirmation');

  if (
    currentPassword === undefined ||
    currentPassword === '' ||
    password === undefined ||
    password === '' ||
    passwordConfirmation === undefined ||
    passwordConfirmation === ''
  ) {
    const error: PasswordChangeErrorJson = { ok: false, code: 'invalid_input' };
    return NextResponse.json(error, { status: 400 });
  }

  const result = await changeLaravelPassword({
    currentPassword,
    password,
    passwordConfirmation,
  });

  if (!result.ok) {
    return applyCookies(
      NextResponse.json(result.error, {
        status: errorStatus(result.error.code),
      }),
      result,
    );
  }

  const success: PasswordChangeSuccessJson = { ok: true };
  return applyCookies(NextResponse.json(success), result);
}
