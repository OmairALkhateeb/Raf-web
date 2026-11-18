import type {
  EmailVerifyErrorJson,
  EmailVerifyFieldCode,
} from '@/types/api/auth';
import type { Dictionary } from '@/utils/translations';

/** UI-only pause between send clicks. Laravel does not define a send-code throttle. */
export const EMAIL_VERIFY_RESEND_COOLDOWN_MS = 30_000;

export function localizeEmailVerifyField(
  code: EmailVerifyFieldCode,
  t: Dictionary,
): string {
  switch (code) {
    case 'required':
      return t.auth.enterVerificationCode;
    case 'format':
      return t.auth.verificationCodeLength;
    case 'invalid':
      return t.auth.codeInvalidOrExpired;
    default:
      return t.auth.checkVerificationCode;
  }
}

export function localizeEmailVerifyError(
  error: EmailVerifyErrorJson,
  t: Dictionary,
): string {
  const field = error.fields?.code;
  if (field) return localizeEmailVerifyField(field, t);
  switch (error.code) {
    case 'invalid_input':
      return t.auth.enterVerificationCode;
    case 'validation':
      return t.auth.checkVerificationCode;
    case 'unauthenticated':
      return t.common.pleaseSignIn;
    case 'unavailable':
    default:
      return t.common.serviceUnavailable;
  }
}
