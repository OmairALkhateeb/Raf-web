import 'server-only';

import type {
  EmailVerifyErrorJson,
  LaravelAuthTokensDto,
} from '@/types/api/auth';
import { parseEmailVerifyFields } from '@/lib/mappers/auth';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type EmailVerifyOpSuccess = {
  ok: true;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type EmailVerifyOpFailure = {
  ok: false;
  error: EmailVerifyErrorJson;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type EmailVerifyOpResult = EmailVerifyOpSuccess | EmailVerifyOpFailure;

function withCookies(
  result: EmailVerifyOpResult,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): EmailVerifyOpResult {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

function fromAttempt(
  attempt: Awaited<ReturnType<typeof withCustomerAuth>>,
): EmailVerifyOpResult {
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
    const fields = parseEmailVerifyFields(result.data);
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

export async function sendLaravelEmailVerification(): Promise<EmailVerifyOpResult> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/auth/email/verify/send', {
      method: 'POST',
      accessToken,
    }),
  );
  return fromAttempt(attempt);
}

export async function verifyLaravelEmailCode(
  code: string,
): Promise<EmailVerifyOpResult> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/auth/email/verify', {
      method: 'POST',
      accessToken,
      body: { code },
    }),
  );
  return fromAttempt(attempt);
}
