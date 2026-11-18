import {
  getCountryCallingCode,
  isPossiblePhoneNumber,
  isSupportedCountry,
  parsePhoneNumber,
  type CountryCode,
} from 'libphonenumber-js/min';

export type PhoneCountry = CountryCode;

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export function isPossibleInternationalPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!E164_PATTERN.test(trimmed)) return false;
  try {
    return isPossiblePhoneNumber(trimmed);
  } catch {
    return false;
  }
}

export function isLegacyPhoneValue(value: string): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed) && !isPossibleInternationalPhone(trimmed);
}

export function toPhoneCountry(
  code: string | null | undefined,
): PhoneCountry | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  if (!isSupportedCountry(upper)) return undefined;
  try {
    getCountryCallingCode(upper);
    return upper;
  } catch {
    return undefined;
  }
}

export function parseStoredPhoneCountry(
  phone: string,
): PhoneCountry | undefined {
  const trimmed = phone.trim();
  if (!trimmed || isLegacyPhoneValue(trimmed)) return undefined;
  try {
    return parsePhoneNumber(trimmed)?.country;
  } catch {
    return undefined;
  }
}

export function isCallingCodePrefixOnly(
  display: string,
  country?: PhoneCountry,
): boolean {
  const compact = display.replace(/[\s-()]/g, '');
  if (!compact || compact === '+') return true;
  if (!country) return false;
  try {
    return compact === `+${getCountryCallingCode(country)}`;
  } catch {
    return false;
  }
}
