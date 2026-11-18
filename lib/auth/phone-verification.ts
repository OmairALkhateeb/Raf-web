import type {
  PhoneVerifyErrorJson,
  PhoneVerifyFieldCode,
} from '@/types/api/auth';
import type { Dictionary } from '@/utils/translations';

/** UI-only pause between send clicks. Laravel does not define a send-code throttle. */
export const PHONE_VERIFY_RESEND_COOLDOWN_MS = 30_000;

export function localizePhoneVerifyField(
  code: PhoneVerifyFieldCode,
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

export function localizePhoneVerifyError(
  error: PhoneVerifyErrorJson,
  t: Dictionary,
): string {
  const field = error.fields?.code;
  if (field) return localizePhoneVerifyField(field, t);
  switch (error.code) {
    case 'phone_missing':
      return t.account.phoneMissingFirst;
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
