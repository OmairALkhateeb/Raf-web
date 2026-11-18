import { parsePositiveIntString } from '@/lib/cart/ids';
import { readAddressLocation, type AddressLocation } from './location';
import { isPossibleInternationalPhone } from '@/lib/phone/international';
import { findDeliveryCity, type DeliveryZone } from '@/lib/account/delivery-cities';

export const DEFAULT_ADDRESS_COUNTRY = 'OM';

export const ADDRESS_LIMITS = {
  label: 100,
  name: 255,
  phone: 30,
  country: 2,
  city: 100,
  area: 100,
  addressLine1: 255,
  addressLine2: 255,
  postalCode: 20,
} as const;

const CREATE_KEYS = new Set([
  'label',
  'fullName',
  'phone',
  'street',
  'addressLine2',
  'city',
  'area',
  'postalCode',
  'country',
  'isDefault',
  'location',
]);

const UPDATE_KEYS = CREATE_KEYS;

export type AddressWriteInput = {
  label: string | null;
  fullName: string;
  phone: string;
  street: string;
  addressLine2: string | null;
  city: string;
  area: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
  location: AddressLocation | null;
};

export type AddressFormValues = {
  label: string;
  fullName: string;
  phone: string;
  street: string;
  addressLine2: string;
  city: string;
  area: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  location: AddressLocation | null;
};

export type AddressFormErrorKey =
  | 'addressNameRequired'
  | 'addressNameTooLong'
  | 'addressPhoneRequired'
  | 'addressPhoneInvalid'
  | 'addressPhoneTooLong'
  | 'addressStreetRequired'
  | 'addressStreetTooLong'
  | 'addressCityRequired'
  | 'addressCityTooLong'
  | 'addressCityInvalid'
  | 'addressCountryRequired'
  | 'addressCountryInvalid'
  | 'addressLabelTooLong'
  | 'addressAreaTooLong'
  | 'addressLine2TooLong'
  | 'addressPostalTooLong';

export type AddressPatchInput = {
  label?: string | null;
  fullName?: string;
  phone?: string;
  street?: string;
  addressLine2?: string | null;
  city?: string;
  area?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isDefault?: boolean;
  /** `null` removes the pin. */
  location?: AddressLocation | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function hasOnlyAllowedKeys(
  body: Record<string, unknown>,
  allowed: Set<string>,
): boolean {
  return Object.keys(body).every((key) => allowed.has(key));
}

function readRequiredName(
  value: unknown,
  max: number,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return undefined;
  return trimmed;
}

function readOptionalText(
  value: unknown,
  max: number,
): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return undefined;
  return trimmed;
}

/**
 * The address form only offers the backend's zone cities (H3), which change
 * when an admin adds a zone, so the server accepts any city name of a sane
 * length. The old fixed cities are still normalised to their zone spelling.
 */
function readDeliveryCity(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > ADDRESS_LIMITS.city) return undefined;
  return findDeliveryCity(trimmed) ?? trimmed;
}

/** Null, empty, or a 2-character ISO code. Invalid types/lengths return undefined. */
export function readCountryCode(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const code = value.trim().toUpperCase();
  if (!code) return null;
  if (code.length !== ADDRESS_LIMITS.country) return undefined;
  return code;
}

export function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function tooLong(value: string, max: number): boolean {
  return value.trim().length > max;
}

export type AddressFormValidationOptions = {
  allowUnchangedLegacyPhone?: boolean;
  phoneIncomplete?: boolean;
  /** The backend's delivery cities; the old fixed list when absent. */
  zones?: DeliveryZone[];
};

function readInternationalPhone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > ADDRESS_LIMITS.phone) return undefined;
  if (!isPossibleInternationalPhone(trimmed)) return undefined;
  return trimmed;
}

export function getAddressFormErrorKey(
  form: AddressFormValues,
  options?: AddressFormValidationOptions,
): AddressFormErrorKey | null {
  if (!form.fullName.trim()) return 'addressNameRequired';
  if (tooLong(form.fullName, ADDRESS_LIMITS.name)) return 'addressNameTooLong';
  if (!options?.allowUnchangedLegacyPhone) {
    if (!form.phone.trim()) {
      return options?.phoneIncomplete
        ? 'addressPhoneInvalid'
        : 'addressPhoneRequired';
    }
    if (tooLong(form.phone, ADDRESS_LIMITS.phone)) return 'addressPhoneTooLong';
    if (!isPossibleInternationalPhone(form.phone)) return 'addressPhoneInvalid';
  }
  if (!form.street.trim()) return 'addressStreetRequired';
  if (tooLong(form.street, ADDRESS_LIMITS.addressLine1))
    return 'addressStreetTooLong';
  if (!form.city.trim()) return 'addressCityRequired';
  if (tooLong(form.city, ADDRESS_LIMITS.city)) return 'addressCityTooLong';
  if (!findDeliveryCity(form.city, options?.zones)) return 'addressCityInvalid';

  const country = form.country.trim().toUpperCase();
  if (!country) return 'addressCountryRequired';
  if (country.length !== ADDRESS_LIMITS.country) return 'addressCountryInvalid';

  if (tooLong(form.label, ADDRESS_LIMITS.label)) return 'addressLabelTooLong';
  if (tooLong(form.area, ADDRESS_LIMITS.area)) return 'addressAreaTooLong';
  if (tooLong(form.addressLine2, ADDRESS_LIMITS.addressLine2))
    return 'addressLine2TooLong';
  if (tooLong(form.postalCode, ADDRESS_LIMITS.postalCode))
    return 'addressPostalTooLong';

  return null;
}

export function parseCreateAddressBody(
  value: unknown,
): AddressWriteInput | null {
  const body = asObject(value);
  if (!body || !hasOnlyAllowedKeys(body, CREATE_KEYS)) return null;

  const fullName = readRequiredName(body.fullName, ADDRESS_LIMITS.name);
  const phone = readInternationalPhone(body.phone);
  const street = readRequiredName(body.street, ADDRESS_LIMITS.addressLine1);
  const city = readDeliveryCity(body.city);
  if (!fullName || !phone || !street || !city) return null;

  const label =
    'label' in body
      ? readOptionalText(body.label, ADDRESS_LIMITS.label)
      : null;
  const addressLine2 =
    'addressLine2' in body
      ? readOptionalText(body.addressLine2, ADDRESS_LIMITS.addressLine2)
      : null;
  const area =
    'area' in body ? readOptionalText(body.area, ADDRESS_LIMITS.area) : null;
  const postalCode =
    'postalCode' in body
      ? readOptionalText(body.postalCode, ADDRESS_LIMITS.postalCode)
      : null;
  if (
    label === undefined ||
    addressLine2 === undefined ||
    area === undefined ||
    postalCode === undefined
  ) {
    return null;
  }

  const country = readCountryCode(body.country);
  if (!country) return null;

  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean')
    return null;

  const location = 'location' in body ? readAddressLocation(body.location) : null;
  if (location === undefined) return null;

  return {
    label,
    fullName,
    phone,
    street,
    addressLine2,
    city,
    area,
    postalCode,
    country,
    isDefault: body.isDefault === true,
    location,
  };
}

export function parseUpdateAddressBody(
  value: unknown,
): AddressPatchInput | null {
  const body = asObject(value);
  if (!body || !hasOnlyAllowedKeys(body, UPDATE_KEYS)) return null;

  const patch: AddressPatchInput = {};

  if ('label' in body) {
    const label = readOptionalText(body.label, ADDRESS_LIMITS.label);
    if (label === undefined) return null;
    patch.label = label;
  }
  if ('fullName' in body) {
    const fullName = readRequiredName(body.fullName, ADDRESS_LIMITS.name);
    if (!fullName) return null;
    patch.fullName = fullName;
  }
  if ('phone' in body) {
    const phone = readInternationalPhone(body.phone);
    if (!phone) return null;
    patch.phone = phone;
  }
  if ('street' in body) {
    const street = readRequiredName(body.street, ADDRESS_LIMITS.addressLine1);
    if (!street) return null;
    patch.street = street;
  }
  if ('addressLine2' in body) {
    const addressLine2 = readOptionalText(
      body.addressLine2,
      ADDRESS_LIMITS.addressLine2,
    );
    if (addressLine2 === undefined) return null;
    patch.addressLine2 = addressLine2;
  }
  if ('city' in body) {
    const city = readDeliveryCity(body.city);
    if (!city) return null;
    patch.city = city;
  }
  if ('area' in body) {
    const area = readOptionalText(body.area, ADDRESS_LIMITS.area);
    if (area === undefined) return null;
    patch.area = area;
  }
  if ('postalCode' in body) {
    const postalCode = readOptionalText(
      body.postalCode,
      ADDRESS_LIMITS.postalCode,
    );
    if (postalCode === undefined) return null;
    patch.postalCode = postalCode;
  }
  if ('country' in body) {
    const country = readCountryCode(body.country);
    if (country === undefined) return null;
    patch.country = country;
  }
  if ('isDefault' in body) {
    if (typeof body.isDefault !== 'boolean') return null;
    patch.isDefault = body.isDefault;
  }
  if ('location' in body) {
    const location = readAddressLocation(body.location);
    if (location === undefined) return null;
    patch.location = location;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}

export function parseAddressIdParam(raw: string): number | null {
  return parsePositiveIntString(raw);
}

export function parseOrderIdParam(raw: string): number | null {
  return parsePositiveIntString(raw);
}
