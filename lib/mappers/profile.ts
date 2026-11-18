import type { ProfileUpdateFields } from '@/types/api/account';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.trim() !== '',
  );
}

/**
 * Map Laravel 422 profile-update errors onto field codes.
 * Does not return or log submitted profile values.
 */
export function parseProfileUpdateFields(body: unknown): ProfileUpdateFields {
  const record = asRecord(body);
  const errors = record ? asRecord(record.errors) : null;
  if (!errors) return {};

  const fields: ProfileUpdateFields = {};

  const name = stringArray(errors.name).join(' ').toLowerCase();
  if (name) {
    fields.name =
      name.includes('greater than') || name.includes('255') ? 'too_long' : 'required';
  }

  const phone = stringArray(errors.phone).join(' ').toLowerCase();
  if (phone) {
    fields.phone = phone.includes('taken')
      ? 'taken'
      : phone.includes('greater than')
        ? 'too_long'
        : 'invalid';
  }

  if (stringArray(errors.date_of_birth).length > 0) fields.date_of_birth = 'invalid';
  if (stringArray(errors.gender).length > 0) fields.gender = 'invalid';

  const avatar = stringArray(errors.avatar).join(' ').toLowerCase();
  if (avatar) {
    fields.avatar = avatar.includes('greater than') || avatar.includes('kilobytes')
      ? 'too_large'
      : 'wrong_type';
  }

  return fields;
}
