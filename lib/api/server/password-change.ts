import 'server-only';

import type {
  LaravelAuthTokensDto,
  PasswordChangeErrorJson,
  PasswordChangeFields,
} from '@/types/api/auth';
import { parsePasswordChangeFields } from '@/lib/mappers/auth';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type PasswordChangeOpSuccess = {
  ok: true;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type PasswordChangeOpFailure = {
  ok: false;
  error: PasswordChangeErrorJson;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type PasswordChangeOpResult =
  PasswordChangeOpSuccess | PasswordChangeOpFailure;

function withCookies(
  result: PasswordChangeOpResult,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): PasswordChangeOpResult {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

export async function changeLaravelPassword(input: {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}): Promise<PasswordChangeOpResult> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/auth/password/change', {
      method: 'POST',
      accessToken,
      body: {
        current_password: input.currentPassword,
        password: input.password,
        password_confirmation: input.passwordConfirmation,
      },
    }),
  );

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
    const fields: PasswordChangeFields = parsePasswordChangeFields(result.data);
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

  return withCookies({ ok: true, remember: attempt.remember }, attempt);
}
