import { NextResponse } from 'next/server';
import { readJsonBody, readStringField } from '@/lib/api/server/auth-route';
import { resetLaravelPassword } from '@/lib/api/server/password-reset';
import { looksLikeEmail } from '@/lib/auth/password-reset';
import { passwordMeetsPolicy } from '@/lib/auth/password';
import type {
  ResetPasswordErrorJson,
  ResetPasswordSuccessJson,
} from '@/types/api/auth';

export const dynamic = 'force-dynamic';

function errorStatus(code: ResetPasswordErrorJson['code']): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'validation':
      return 422;
    case 'rate_limited':
      return 429;
    default:
      return 503;
  }
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const email = readStringField(body, 'email')?.trim();
  const token = readStringField(body, 'token');
  const password = readStringField(body, 'password');
  const passwordConfirmation = readStringField(body, 'password_confirmation');

  if (
    !email ||
    !looksLikeEmail(email) ||
    token === undefined ||
    token.trim() === '' ||
    password === undefined ||
    password === '' ||
    passwordConfirmation === undefined ||
    passwordConfirmation === ''
  ) {
    const error: ResetPasswordErrorJson = { ok: false, code: 'invalid_input' };
    return NextResponse.json(error, { status: errorStatus('invalid_input') });
  }

  if (password !== passwordConfirmation) {
    const error: ResetPasswordErrorJson = {
      ok: false,
      code: 'validation',
      fields: { password_confirmation: 'mismatch' },
    };
    return NextResponse.json(error, { status: errorStatus('validation') });
  }

  if (!passwordMeetsPolicy(password)) {
    const error: ResetPasswordErrorJson = {
      ok: false,
      code: 'validation',
      fields: { password: 'policy' },
    };
    return NextResponse.json(error, { status: errorStatus('validation') });
  }

  const result = await resetLaravelPassword({
    email,
    token: token.trim(),
    password,
    passwordConfirmation,
  });

  if (!result.ok) {
    return NextResponse.json(result.error, {
      status: errorStatus(result.error.code),
    });
  }

  const success: ResetPasswordSuccessJson = { ok: true };
  return NextResponse.json(success);
}
