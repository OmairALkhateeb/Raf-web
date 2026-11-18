import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  clearAuthCookies,
} from '@/lib/api/server/auth-cookies';
import { readJsonBody } from '@/lib/api/server/auth-route';
import { readProfilePatch, validateProfilePatch } from '@/lib/account/profile';
import {
  updateLaravelProfile,
  type ProfileUpdateOpResult,
} from '@/lib/api/server/profile';
import type {
  ProfileUpdateErrorJson,
  ProfileUpdateSuccessJson,
} from '@/types/api/account';

export const dynamic = 'force-dynamic';

function applyCookies(
  response: NextResponse,
  result: ProfileUpdateOpResult,
): NextResponse {
  if (result.clearAuth) {
    clearAuthCookies(response);
  } else if (result.rotatedTokens) {
    applyAuthCookies(response, result.rotatedTokens, result.remember);
  }
  return response;
}

function errorStatus(code: ProfileUpdateErrorJson['code']): number {
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

export async function PATCH(request: Request) {
  const body = await readJsonBody(request);
  const patch = readProfilePatch(body);
  if (!patch) {
    const error: ProfileUpdateErrorJson = { ok: false, code: 'invalid_input' };
    return NextResponse.json(error, { status: errorStatus('invalid_input') });
  }

  const fields = validateProfilePatch(patch);
  if (Object.keys(fields).length > 0) {
    const error: ProfileUpdateErrorJson = { ok: false, code: 'validation', fields };
    return NextResponse.json(error, { status: errorStatus('validation') });
  }

  const result = await updateLaravelProfile(patch);

  if (!result.ok) {
    return applyCookies(
      NextResponse.json(result.error, {
        status: errorStatus(result.error.code),
      }),
      result,
    );
  }

  const success: ProfileUpdateSuccessJson = { ok: true, user: result.user };
  return applyCookies(NextResponse.json(success), result);
}
