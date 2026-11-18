import type {
  ForgotPasswordErrorJson,
  ResetPasswordErrorJson,
  ResetPasswordField,
  ResetPasswordFieldCode,
} from '@/types/api/auth';
import type { Dictionary } from '@/utils/translations';

export function localizeForgotPasswordError(
  error: ForgotPasswordErrorJson,
  t: Dictionary,
): string {
  switch (error.code) {
    case 'invalid_input':
      return t.home.newsletterInvalid;
    case 'rate_limited':
      return t.common.tooManyAttempts;
    case 'unavailable':
    default:
      return t.common.serviceUnavailable;
  }
}

export function localizeResetPasswordField(
  code: ResetPasswordFieldCode,
  t: Dictionary,
): string {
  switch (code) {
    case 'required':
      return t.common.fillRequired;
    case 'format':
      return t.home.newsletterInvalid;
    case 'invalid':
      return t.auth.resetLinkInvalid;
    case 'mismatch':
      return t.auth.passwordMismatch;
    case 'policy':
      return t.auth.passwordPolicy;
    default:
      return t.common.checkDetails;
  }
}

export function localizeResetPasswordError(
  error: ResetPasswordErrorJson,
  t: Dictionary,
): string {
  const fields = error.fields;
  if (fields) {
    const order: ResetPasswordField[] = [
      'token',
      'email',
      'password',
      'password_confirmation',
    ];
    for (const key of order) {
      const code = fields[key];
      if (code) return localizeResetPasswordField(code, t);
    }
  }
  switch (error.code) {
    case 'invalid_input':
      return t.common.fillRequired;
    case 'validation':
      return t.common.checkDetails;
    case 'rate_limited':
      return t.common.tooManyAttempts;
    case 'unavailable':
    default:
      return t.common.serviceUnavailable;
  }
}

export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 255) return false;
  // Practical client check; Laravel still validates on the server.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
