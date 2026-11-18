import 'server-only';

import type {
  ForgotPasswordErrorJson,
  ResetPasswordErrorJson,
  ResetPasswordFields,
} from '@/types/api/auth';
import { parseResetPasswordFields } from '@/lib/mappers/auth';
import { laravelAuthFetch } from './auth-http';

export type ForgotPasswordOpResult =
  | { ok: true }
  | { ok: false; error: ForgotPasswordErrorJson };

export type ResetPasswordOpResult =
  | { ok: true }
  | { ok: false; error: ResetPasswordErrorJson };

/**
 * Proxies Laravel forgot-password. Does not invent success when Laravel fails.
 * Tokens and emails are never logged.
 */
export async function sendLaravelPasswordResetLink(
  email: string,
): Promise<ForgotPasswordOpResult> {
  const result = await laravelAuthFetch('/auth/password/forgot', {
    method: 'POST',
    body: { email },
  });

  if (result.unreachable) {
    return { ok: false, error: { ok: false, code: 'unavailable' } };
  }

  if (result.status >= 200 && result.status < 300) {
    return { ok: true };
  }

  if (result.status === 429) {
    return { ok: false, error: { ok: false, code: 'rate_limited' } };
  }

  return { ok: false, error: { ok: false, code: 'unavailable' } };
}

/**
 * Proxies Laravel reset-password. Does not set auth cookies or return tokens.
 */
export async function resetLaravelPassword(input: {
  email: string;
  token: string;
  password: string;
  passwordConfirmation: string;
}): Promise<ResetPasswordOpResult> {
  const result = await laravelAuthFetch('/auth/password/reset', {
    method: 'POST',
    body: {
      email: input.email,
      token: input.token,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
  });

  if (result.unreachable) {
    return { ok: false, error: { ok: false, code: 'unavailable' } };
  }

  if (result.status === 429) {
    return { ok: false, error: { ok: false, code: 'rate_limited' } };
  }

  if (result.status === 422) {
    const fields: ResetPasswordFields = parseResetPasswordFields(result.data);
    return {
      ok: false,
      error: { ok: false, code: 'validation', fields },
    };
  }

  if (result.status >= 200 && result.status < 300) {
    return { ok: true };
  }

  return { ok: false, error: { ok: false, code: 'unavailable' } };
}
