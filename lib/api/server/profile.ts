import 'server-only';

import type { User } from '@/types';
import type {
  ProfileUpdateErrorJson,
  ProfileUpdateFields,
} from '@/types/api/account';
import type { LaravelAuthTokensDto } from '@/types/api/auth';
import { parseLaravelUser, toUser } from '@/lib/mappers/auth';
import { parseProfileUpdateFields } from '@/lib/mappers/profile';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';
import { toLaravelProfileBody, type ProfilePatch } from '@/lib/account/profile';

export type ProfileUpdateOpSuccess = {
  ok: true;
  user: User;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type ProfileUpdateOpFailure = {
  ok: false;
  error: ProfileUpdateErrorJson;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type ProfileUpdateOpResult =
  | ProfileUpdateOpSuccess
  | ProfileUpdateOpFailure;

function withCookies(
  result: ProfileUpdateOpResult,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): ProfileUpdateOpResult {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

/**
 * PATCH Laravel `/customer/profile` with only the changed fields: name,
 * phone, date_of_birth, gender.
 */
export async function updateLaravelProfile(
  patch: ProfilePatch,
): Promise<ProfileUpdateOpResult> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/profile', {
      method: 'PATCH',
      accessToken,
      body: toLaravelProfileBody(patch),
      // `parseProfileUpdateFields` reads the English messages ("taken", …).
      acceptLanguage: 'en',
    }),
  );
  return interpretUserResult(attempt);
}

/** POST Laravel `/customer/profile/avatar` (multipart field `avatar`). */
export async function uploadLaravelAvatar(file: File): Promise<ProfileUpdateOpResult> {
  const attempt = await withCustomerAuth((accessToken) => {
    const form = new FormData();
    form.append('avatar', file, file.name);
    return laravelCustomerFetch('/customer/profile/avatar', {
      method: 'POST',
      accessToken,
      body: form,
      // `parseProfileUpdateFields` reads the English messages ("kilobytes", …).
      acceptLanguage: 'en',
    });
  });
  return interpretUserResult(attempt);
}

function interpretUserResult(
  attempt: Awaited<ReturnType<typeof withCustomerAuth>>,
): ProfileUpdateOpResult {
  const { result } = attempt;

  if (result.unreachable) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unavailable' },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status === 401) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unauthenticated' },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status === 422) {
    const fields: ProfileUpdateFields = parseProfileUpdateFields(result.data);
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'validation', fields },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status < 200 || result.status >= 300) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unavailable' },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  try {
    const user = toUser(parseLaravelUser(result.data));
    return withCookies(
      { ok: true, user, remember: attempt.remember },
      attempt,
    );
  } catch {
    console.error('Laravel profile update payload could not be mapped');
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unavailable' },
        remember: attempt.remember,
      },
      attempt,
    );
  }
}
