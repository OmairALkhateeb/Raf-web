import type { Dictionary } from '@/utils/translations';
import {
  isSafeUserFacingError,
  RATE_LIMITED_MESSAGE,
} from '@/lib/auth/error-body';

const KNOWN: Record<string, (t: Dictionary) => string> = {
  'Invalid credentials.': (t) => t.auth.invalidCredentials,
  'This account is not active.': (t) => t.auth.accountInactive,
  'This storefront is for customer accounts only.': (t) => t.auth.customerOnly,
  'The service is temporarily unavailable. Please try again.': (t) =>
    t.common.serviceUnavailable,
  'Password confirmation does not match.': (t) => t.auth.passwordMismatch,
  'Password must be at least 8 characters and include uppercase, lowercase, and a number.':
    (t) => t.auth.passwordPolicy,
  'Current password is incorrect.': (t) => t.auth.currentPasswordIncorrect,
  'Please fill in all password fields.': (t) => t.auth.fillPasswordFields,
  [RATE_LIMITED_MESSAGE]: (t) => t.common.tooManyAttempts,
  // Raw Laravel throttle body, in case a route passes it through.
  'Too Many Attempts.': (t) => t.common.tooManyAttempts,
  'Email and password are required.': (t) => t.common.fillRequired,
};

export function localizeAuthError(
  message: string,
  t: Dictionary,
  unknownMode: 'unavailable' | 'passthrough' = 'unavailable',
): string {
  const known = KNOWN[message];
  if (known) return known(t);
  if (unknownMode === 'passthrough' && isSafeUserFacingError(message)) {
    return message.trim();
  }
  return t.common.serviceUnavailable;
}
