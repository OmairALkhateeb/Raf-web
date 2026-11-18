import type {
  PasswordChangeErrorJson,
  PasswordChangeField,
  PasswordChangeFieldCode,
} from '@/types/api/auth';
import type { Dictionary } from '@/utils/translations';

function fieldMessage(code: PasswordChangeFieldCode, t: Dictionary): string {
  switch (code) {
    case 'incorrect':
      return t.auth.currentPasswordIncorrect;
    case 'required':
      return t.auth.fillPasswordFields;
    case 'mismatch':
      return t.auth.newPasswordMismatch;
    case 'policy':
      return t.auth.passwordPolicy;
    default:
      return t.auth.checkPasswordDetails;
  }
}

export function localizePasswordChangeField(
  code: PasswordChangeFieldCode,
  t: Dictionary,
): string {
  return fieldMessage(code, t);
}

export function localizePasswordChangeError(
  error: PasswordChangeErrorJson,
  t: Dictionary,
): string {
  const fields = error.fields;
  if (fields) {
    const order: PasswordChangeField[] = [
      'current_password',
      'password',
      'password_confirmation',
    ];
    for (const key of order) {
      const code = fields[key];
      if (code) return localizePasswordChangeField(code, t);
    }
  }
  switch (error.code) {
    case 'invalid_input':
      return t.auth.fillPasswordFields;
    case 'validation':
      return t.auth.checkPasswordDetails;
    case 'unauthenticated':
      return t.common.pleaseSignIn;
    case 'unavailable':
    default:
      return t.common.serviceUnavailable;
  }
}
