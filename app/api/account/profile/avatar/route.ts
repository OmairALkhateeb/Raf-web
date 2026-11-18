import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  clearAuthCookies,
} from '@/lib/api/server/auth-cookies';
import { uploadLaravelAvatar } from '@/lib/api/server/profile';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '@/lib/account/profile';
import type {
  ProfileUpdateErrorJson,
  ProfileUpdateSuccessJson,
} from '@/types/api/account';

export const dynamic = 'force-dynamic';

function invalid(code: 'too_large' | 'wrong_type' | 'required') {
  const error: ProfileUpdateErrorJson = {
    ok: false,
    code: 'invalid_input',
    fields: { avatar: code },
  };
  return NextResponse.json(error, { status: 400 });
}

/** Profile photo: jpg / png / webp up to 2 MB, forwarded as multipart. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return invalid('required');
  }
  const file = form.get('avatar');
  if (!(file instanceof File) || file.size === 0) return invalid('required');
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return invalid('wrong_type');
  if (file.size > AVATAR_MAX_BYTES) return invalid('too_large');

  const result = await uploadLaravelAvatar(file);
  const response = result.ok
    ? NextResponse.json({ ok: true, user: result.user } satisfies ProfileUpdateSuccessJson)
    : NextResponse.json(result.error, {
        status:
          result.error.code === 'validation'
            ? 422
            : result.error.code === 'unauthenticated'
              ? 401
              : 503,
      });
  if (result.clearAuth) clearAuthCookies(response);
  else if (result.rotatedTokens) {
    applyAuthCookies(response, result.rotatedTokens, result.remember);
  }
  return response;
}
