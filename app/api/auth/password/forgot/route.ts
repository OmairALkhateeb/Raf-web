import { NextResponse } from 'next/server';
import { readJsonBody, readStringField } from '@/lib/api/server/auth-route';
import { sendLaravelPasswordResetLink } from '@/lib/api/server/password-reset';
import { looksLikeEmail } from '@/lib/auth/password-reset';
import type {
  ForgotPasswordErrorJson,
  ForgotPasswordSuccessJson,
} from '@/types/api/auth';

export const dynamic = 'force-dynamic';

function errorStatus(code: ForgotPasswordErrorJson['code']): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'rate_limited':
      return 429;
    default:
      return 503;
  }
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const email = readStringField(body, 'email')?.trim();

  if (!email || !looksLikeEmail(email)) {
    const error: ForgotPasswordErrorJson = { ok: false, code: 'invalid_input' };
    return NextResponse.json(error, { status: errorStatus('invalid_input') });
  }

  const result = await sendLaravelPasswordResetLink(email);

  if (!result.ok) {
    return NextResponse.json(result.error, {
      status: errorStatus(result.error.code),
    });
  }

  const success: ForgotPasswordSuccessJson = { ok: true };
  return NextResponse.json(success);
}
