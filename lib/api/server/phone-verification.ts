import 'server-only';
import { laravelErrorCode } from './error-code';

import type {
  LaravelAuthTokensDto,
  PhoneVerifyErrorJson,
} from '@/types/api/auth';
import { parsePhoneVerifyFields } from '@/lib/mappers/auth';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type PhoneVerifyOpSuccess = {
  ok: true;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type PhoneVerifyOpFailure = {
  ok: false;
  error: PhoneVerifyErrorJson;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type PhoneVerifyOpResult = PhoneVerifyOpSuccess | PhoneVerifyOpFailure;

function withCookies(
  result: PhoneVerifyOpResult,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): PhoneVerifyOpResult {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

function fromAttempt(
  attempt: Awaited<ReturnType<typeof withCustomerAuth>>,
): PhoneVerifyOpResult {
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

  if (result.status === 422 && laravelErrorCode(result.data) === 'phone_missing') {
    return withCookies(
      { ok: false, error: { ok: false, code: 'phone_missing' }, remember: attempt.remember },
      attempt,
    );
  }

  if (result.status === 422) {
    const fields = parsePhoneVerifyFields(result.data);
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

export async function sendLaravelPhoneVerification(): Promise<PhoneVerifyOpResult> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/auth/phone/verify/send', {
      method: 'POST',
      accessToken,
    }),
  );
  return fromAttempt(attempt);
}

export async function verifyLaravelPhoneCode(
  code: string,
): Promise<PhoneVerifyOpResult> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/auth/phone/verify', {
      method: 'POST',
      accessToken,
      body: { code },
    }),
  );
  return fromAttempt(attempt);
}
