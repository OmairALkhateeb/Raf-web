import type {
  ProfileUpdateErrorJson,
  ProfileUpdateField,
  ProfileUpdateFieldCode,
} from '@/types/api/account';
import type { Dictionary } from '@/utils/translations';

export function localizeProfileUpdateField(
  code: ProfileUpdateFieldCode,
  t: Dictionary,
  field: ProfileUpdateField = 'name',
): string {
  switch (field) {
    case 'phone':
      if (code === 'taken') return t.account.phoneTaken;
      if (code === 'too_long') return t.account.addressPhoneTooLong;
      return t.account.addressPhoneInvalid;
    case 'date_of_birth':
      return t.account.dateOfBirthInvalid;
    case 'gender':
      return t.account.genderInvalid;
    case 'avatar':
      if (code === 'too_large') return t.account.photoTooLarge;
      return t.account.photoInvalidType;
    case 'name':
    default:
      switch (code) {
        case 'required':
          return t.auth.enterName;
        case 'too_long':
          return t.auth.nameTooLong;
        default:
          return t.auth.checkProfileDetails;
      }
  }
}

const FIELD_ORDER: ProfileUpdateField[] = [
  'name',
  'phone',
  'date_of_birth',
  'gender',
  'avatar',
];

export function localizeProfileUpdateError(
  error: ProfileUpdateErrorJson,
  t: Dictionary,
): string {
  for (const field of FIELD_ORDER) {
    const code = error.fields?.[field];
    if (code) return localizeProfileUpdateField(code, t, field);
  }
  switch (error.code) {
    case 'invalid_input':
    case 'validation':
      return t.auth.checkProfileDetails;
    case 'unauthenticated':
      return t.common.pleaseSignIn;
    case 'unavailable':
    default:
      return t.common.serviceUnavailable;
  }
}
