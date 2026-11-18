import { isPossibleInternationalPhone } from '@/lib/phone/international';
import type {
  ProfileUpdateField,
  ProfileUpdateFieldCode,
  ProfileUpdateFields,
} from '@/types/api/account';

/**
 * Profile rules, matching the backend's UpdateProfileRequest: name ≤ 255;
 * phone ≤ 30, unique, may be cleared; date_of_birth a date or null; gender
 * `male` / `female` / `unspecified` (never null).
 */
export const PROFILE_GENDERS = ['unspecified', 'male', 'female'] as const;
export type ProfileGender = (typeof PROFILE_GENDERS)[number];

export type ProfilePatch = {
  name?: string;
  phone?: string | null;
  /** `YYYY-MM-DD` */
  dateOfBirth?: string | null;
  gender?: ProfileGender;
};

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date, not in the future, from 1900 on. */
export function isValidBirthDate(value: string, today = new Date()): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  return year >= 1900 && value <= today.toISOString().slice(0, 10);
}

export function validateProfilePatch(patch: ProfilePatch): ProfileUpdateFields {
  const fields: ProfileUpdateFields = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) fields.name = 'required';
    else if (name.length > 255) fields.name = 'too_long';
  }
  if (patch.phone !== undefined && patch.phone !== null) {
    const phone = patch.phone.trim();
    if (phone.length > 30) fields.phone = 'too_long';
    else if (!isPossibleInternationalPhone(phone)) fields.phone = 'invalid';
  }
  if (patch.dateOfBirth !== undefined && patch.dateOfBirth !== null) {
    if (!isValidBirthDate(patch.dateOfBirth)) fields.date_of_birth = 'invalid';
  }
  if (
    patch.gender !== undefined &&
    !(PROFILE_GENDERS as readonly string[]).includes(patch.gender)
  ) {
    fields.gender = 'invalid';
  }
  return fields;
}

/** Untrusted JSON from the client → a patch of only the known fields. */
export function readProfilePatch(body: unknown): ProfilePatch | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const patch: ProfilePatch = {};
  if ('name' in record) {
    if (typeof record.name !== 'string') return null;
    patch.name = record.name.trim();
  }
  if ('phone' in record) {
    if (record.phone !== null && typeof record.phone !== 'string') return null;
    const phone = typeof record.phone === 'string' ? record.phone.trim() : '';
    patch.phone = phone || null;
  }
  if ('dateOfBirth' in record) {
    if (record.dateOfBirth !== null && typeof record.dateOfBirth !== 'string') return null;
    patch.dateOfBirth = record.dateOfBirth ? String(record.dateOfBirth) : null;
  }
  if ('gender' in record) {
    if (typeof record.gender !== 'string') return null;
    patch.gender = record.gender as ProfileGender;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function toLaravelProfileBody(patch: ProfilePatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.phone !== undefined) body.phone = patch.phone;
  if (patch.dateOfBirth !== undefined) body.date_of_birth = patch.dateOfBirth;
  if (patch.gender !== undefined) body.gender = patch.gender;
  return body;
}

export type { ProfileUpdateField, ProfileUpdateFieldCode };
