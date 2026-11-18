import type { User } from '@/types';
import type {
  AuthErrorJson,
  AuthSessionJson,
  AuthUserJson,
  EmailVerifyErrorJson,
  ForgotPasswordErrorJson,
  PasswordChangeErrorJson,
  PhoneVerifyErrorJson,
  ResetPasswordErrorJson,
} from '@/types/api/auth';
import {
  joinSafeAuthErrorMessages,
  unavailableAuthMessage,
} from '@/lib/auth/error-body';

export type ClientAuthResult =
  { success: true; user: User } | { success: false; error: string };

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    console.error('Auth client received a non-JSON response', res.status);
    return undefined;
  }
}

export async function fetchAuthSession(): Promise<{
  user: User | null;
  unavailable: boolean;
}> {
  const res = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (res.status === 503) {
    return { user: null, unavailable: true };
  }

  const data = (await readBody(res)) as
    AuthSessionJson | AuthErrorJson | undefined;
  if (!res.ok) {
    return { user: null, unavailable: false };
  }

  if (data && typeof data === 'object' && 'user' in data) {
    return { user: data.user ?? null, unavailable: false };
  }

  return { user: null, unavailable: false };
}

export async function postLogin(
  email: string,
  password: string,
  remember: boolean,
  acceptPolicies: boolean,
): Promise<ClientAuthResult> {
  let res: Response;

  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        remember,
        accept_policies: acceptPolicies,
      }),
    });
  } catch (error) {
    console.error(
      'Login request failed',
      error instanceof Error ? error.name : 'unknown',
    );

    return {
      success: false,
      error: unavailableAuthMessage(),
    };
  }

  const data = await readBody(res);

  if (!res.ok) {
    if (res.status >= 500) {
      return {
        success: false,
        error: unavailableAuthMessage(),
      };
    }

    const extracted = joinSafeAuthErrorMessages(data);

    return {
      success: false,
      error: extracted ?? unavailableAuthMessage(),
    };
  }

  const user = (data as AuthUserJson | undefined)?.user;

  if (!user) {
    return {
      success: false,
      error: unavailableAuthMessage(),
    };
  }

  return { success: true, user };
}

export async function postRegister(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
}): Promise<ClientAuthResult> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      phone: input.phone.trim() ? input.phone.trim() : null,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    }),
  });
  const data = await readBody(res);
  if (!res.ok) {
    if (res.status >= 500) {
      return { success: false, error: unavailableAuthMessage() };
    }
    const extracted = joinSafeAuthErrorMessages(data);
    return {
      success: false,
      error: extracted ?? unavailableAuthMessage(),
    };
  }
  const user = (data as AuthUserJson | undefined)?.user;
  if (!user) {
    return { success: false, error: unavailableAuthMessage() };
  }
  return { success: true, user };
}

/** `deviceToken`: this browser's push token, so the backend stops pushing to it. */
export async function postLogout(deviceToken: string | null = null): Promise<void> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(deviceToken ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(deviceToken ? { body: JSON.stringify({ deviceToken }) } : {}),
  });
  if (!res.ok) {
    console.error('Storefront logout request failed', res.status);
  }
}

export type ChangePasswordClientResult = { ok: true } | PasswordChangeErrorJson;

export async function postChangePassword(input: {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}): Promise<ChangePasswordClientResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/password/change', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: input.currentPassword,
        password: input.password,
        password_confirmation: input.passwordConfirmation,
      }),
    });
  } catch (error) {
    console.error(
      'Password change request failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }

  const data = await readBody(res);
  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === true
  ) {
    return { ok: true };
  }

  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === false
  ) {
    const code = 'code' in data ? (data as { code: unknown }).code : undefined;
    if (
      code === 'invalid_input' ||
      code === 'validation' ||
      code === 'unauthenticated' ||
      code === 'unavailable'
    ) {
      const fields =
        'fields' in data && data.fields && typeof data.fields === 'object'
          ? (data as PasswordChangeErrorJson).fields
          : undefined;
      return { ok: false, code, fields };
    }
  }

  if (res.status === 401) return { ok: false, code: 'unauthenticated' };
  if (res.status === 422) return { ok: false, code: 'validation' };
  return { ok: false, code: 'unavailable' };
}

export type EmailVerifyClientResult = { ok: true } | EmailVerifyErrorJson;

function parseEmailVerifyResult(
  res: Response,
  data: unknown,
): EmailVerifyClientResult {
  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === true
  ) {
    return { ok: true };
  }

  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === false
  ) {
    const code = 'code' in data ? (data as { code: unknown }).code : undefined;
    if (
      code === 'invalid_input' ||
      code === 'validation' ||
      code === 'unauthenticated' ||
      code === 'unavailable'
    ) {
      const fields =
        'fields' in data && data.fields && typeof data.fields === 'object'
          ? (data as EmailVerifyErrorJson).fields
          : undefined;
      return { ok: false, code, fields };
    }
  }

  if (res.status === 401) return { ok: false, code: 'unauthenticated' };
  if (res.status === 422) return { ok: false, code: 'validation' };
  return { ok: false, code: 'unavailable' };
}

export async function postSendEmailVerification(): Promise<EmailVerifyClientResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/email/verify/send', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    console.error(
      'Email verification send failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }

  const data = await readBody(res);
  return parseEmailVerifyResult(res, data);
}

export async function postVerifyEmail(
  code: string,
): Promise<EmailVerifyClientResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/email/verify', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    console.error(
      'Email verification failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }

  const data = await readBody(res);
  return parseEmailVerifyResult(res, data);
}

export type PhoneVerifyClientResult = { ok: true } | PhoneVerifyErrorJson;

function parsePhoneVerifyResult(
  res: Response,
  data: unknown,
): PhoneVerifyClientResult {
  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === true
  ) {
    return { ok: true };
  }

  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === false
  ) {
    const code = 'code' in data ? (data as { code: unknown }).code : undefined;
    if (
      code === 'invalid_input' ||
      code === 'validation' ||
      code === 'unauthenticated' ||
      code === 'unavailable' ||
      code === 'phone_missing'
    ) {
      const fields =
        'fields' in data && data.fields && typeof data.fields === 'object'
          ? (data as PhoneVerifyErrorJson).fields
          : undefined;
      return { ok: false, code, fields };
    }
  }

  if (res.status === 401) return { ok: false, code: 'unauthenticated' };
  if (res.status === 422) return { ok: false, code: 'validation' };
  return { ok: false, code: 'unavailable' };
}

export async function postSendPhoneVerification(): Promise<PhoneVerifyClientResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/phone/verify/send', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    console.error(
      'Phone verification send failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }

  const data = await readBody(res);
  return parsePhoneVerifyResult(res, data);
}

export async function postVerifyPhone(
  code: string,
): Promise<PhoneVerifyClientResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/phone/verify', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    console.error(
      'Phone verification failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }

  const data = await readBody(res);
  return parsePhoneVerifyResult(res, data);
}

export type ForgotPasswordClientResult =
  | { ok: true }
  | ForgotPasswordErrorJson;

function parseForgotPasswordResult(
  res: Response,
  data: unknown,
): ForgotPasswordClientResult {
  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === true
  ) {
    return { ok: true };
  }

  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === false
  ) {
    const code = 'code' in data ? (data as { code: unknown }).code : undefined;
    if (
      code === 'invalid_input' ||
      code === 'rate_limited' ||
      code === 'unavailable'
    ) {
      return { ok: false, code };
    }
  }

  if (res.status === 400) return { ok: false, code: 'invalid_input' };
  if (res.status === 429) return { ok: false, code: 'rate_limited' };
  return { ok: false, code: 'unavailable' };
}

export async function postForgotPassword(
  email: string,
): Promise<ForgotPasswordClientResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/password/forgot', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    console.error(
      'Forgot password request failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }

  const data = await readBody(res);
  return parseForgotPasswordResult(res, data);
}

export type ResetPasswordClientResult =
  | { ok: true }
  | ResetPasswordErrorJson;

function parseResetPasswordResult(
  res: Response,
  data: unknown,
): ResetPasswordClientResult {
  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === true
  ) {
    return { ok: true };
  }

  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === false
  ) {
    const code = 'code' in data ? (data as { code: unknown }).code : undefined;
    if (
      code === 'invalid_input' ||
      code === 'validation' ||
      code === 'rate_limited' ||
      code === 'unavailable'
    ) {
      const fields =
        'fields' in data && data.fields && typeof data.fields === 'object'
          ? (data as ResetPasswordErrorJson).fields
          : undefined;
      return { ok: false, code, fields };
    }
  }

  if (res.status === 400) return { ok: false, code: 'invalid_input' };
  if (res.status === 422) return { ok: false, code: 'validation' };
  if (res.status === 429) return { ok: false, code: 'rate_limited' };
  return { ok: false, code: 'unavailable' };
}

export async function postResetPassword(input: {
  email: string;
  token: string;
  password: string;
  passwordConfirmation: string;
}): Promise<ResetPasswordClientResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/password/reset', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        token: input.token,
        password: input.password,
        password_confirmation: input.passwordConfirmation,
      }),
    });
  } catch (error) {
    console.error(
      'Reset password request failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }

  const data = await readBody(res);
  return parseResetPasswordResult(res, data);
}
