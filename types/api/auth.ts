import type { User } from '@/types';

/**
 * Transport types for Laravel auth UserResource / token payloads.
 * Tokens stay on the server BFF — these types are not returned to the browser.
 */

export interface LaravelUserDto {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  type: string;
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  two_factor_enabled: boolean;
  /** Customers only. `unspecified` is the backend's "not set". */
  gender?: 'male' | 'female' | 'unspecified' | null;
  /** Timestamp such as `1995-05-05T00:00:00.000000Z`; use the date part. */
  date_of_birth?: string | null;
  /** Full URL. */
  avatar_url?: string | null;
  created_at: string;
}

export interface LaravelAuthTokensDto {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface LaravelLoginResponseDto {
  requires_2fa?: boolean;
  user?: LaravelUserDto;
  tokens?: LaravelAuthTokensDto;
}

export interface LaravelRegisterResponseDto {
  user?: LaravelUserDto;
  tokens?: LaravelAuthTokensDto;
}

export interface LaravelRefreshResponseDto {
  tokens?: LaravelAuthTokensDto;
}

export interface LaravelValidationErrorDto {
  message?: string;
  errors?: Record<string, string[]>;
}

/** JSON returned by the storefront BFF to the browser. Never includes tokens. */
export interface AuthSessionJson {
  user: User | null;
}

export interface AuthUserJson {
  user: User;
}

export interface AuthErrorJson {
  error: string;
}

export type PasswordChangeField =
  'current_password' | 'password' | 'password_confirmation';

export type PasswordChangeFieldCode =
  'incorrect' | 'required' | 'mismatch' | 'policy';

export type PasswordChangeFields = Partial<
  Record<PasswordChangeField, PasswordChangeFieldCode>
>;

export interface PasswordChangeSuccessJson {
  ok: true;
}

export interface PasswordChangeErrorJson {
  ok: false;
  code: 'invalid_input' | 'validation' | 'unauthenticated' | 'unavailable';
  fields?: PasswordChangeFields;
}

export type EmailVerifyField = 'code';

export type EmailVerifyFieldCode = 'required' | 'format' | 'invalid';

export type EmailVerifyFields = Partial<
  Record<EmailVerifyField, EmailVerifyFieldCode>
>;

export interface EmailVerifySuccessJson {
  ok: true;
}

export interface EmailVerifyErrorJson {
  ok: false;
  code: 'invalid_input' | 'validation' | 'unauthenticated' | 'unavailable';
  fields?: EmailVerifyFields;
}

export type PhoneVerifyField = 'code';

export type PhoneVerifyFieldCode = 'required' | 'format' | 'invalid';

export type PhoneVerifyFields = Partial<
  Record<PhoneVerifyField, PhoneVerifyFieldCode>
>;

export interface PhoneVerifySuccessJson {
  ok: true;
}

export interface PhoneVerifyErrorJson {
  ok: false;
  /** `phone_missing`: the account has no phone number (backend #29). */
  code: 'invalid_input' | 'validation' | 'unauthenticated' | 'unavailable' | 'phone_missing';
  fields?: PhoneVerifyFields;
}

export interface ForgotPasswordSuccessJson {
  ok: true;
}

export interface ForgotPasswordErrorJson {
  ok: false;
  code: 'invalid_input' | 'rate_limited' | 'unavailable';
}

export type ResetPasswordField =
  | 'email'
  | 'token'
  | 'password'
  | 'password_confirmation';

export type ResetPasswordFieldCode =
  | 'required'
  | 'format'
  | 'invalid'
  | 'mismatch'
  | 'policy';

export type ResetPasswordFields = Partial<
  Record<ResetPasswordField, ResetPasswordFieldCode>
>;

export interface ResetPasswordSuccessJson {
  ok: true;
}

export interface ResetPasswordErrorJson {
  ok: false;
  code: 'invalid_input' | 'validation' | 'rate_limited' | 'unavailable';
  fields?: ResetPasswordFields;
}
