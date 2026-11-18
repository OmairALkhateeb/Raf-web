import 'server-only';

import { laravelErrorCode } from '@/lib/api/server/error-code';

import type { User } from '@/types';
import type {
  LaravelAuthTokensDto,
  LaravelUserDto,
  EmailVerifyFields,
  PasswordChangeFields,
  PhoneVerifyFields,
  ResetPasswordFields,
} from '@/types/api/auth';

export const CUSTOMER_TYPE = 'customer';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function isCustomerUser(dto: LaravelUserDto): boolean {
  return dto.type === CUSTOMER_TYPE;
}

export function unwrapLaravelUser(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) return payload;
  if (asRecord(record.data)) return record.data;
  if (asRecord(record.user)) return record.user;
  return payload;
}

export function parseLaravelUser(raw: unknown): LaravelUserDto {
  const dto = asRecord(unwrapLaravelUser(raw));
  if (!dto) {
    throw new Error('Auth user payload is missing');
  }

  const id =
    typeof dto.id === 'number' && Number.isFinite(dto.id) ? dto.id : undefined;
  const name = asNonEmptyString(dto.name);
  const email = asNonEmptyString(dto.email);
  const type = asNonEmptyString(dto.type);

  if (id === undefined || !name || !email || !type) {
    throw new Error('Auth user payload is incomplete');
  }

  const phone =
    dto.phone === null || dto.phone === undefined
      ? null
      : (asNonEmptyString(dto.phone) ?? null);

  return {
    id,
    name,
    email,
    phone,
    type,
    status: asNonEmptyString(dto.status) ?? '',
    email_verified: dto.email_verified === true,
    phone_verified: dto.phone_verified === true,
    two_factor_enabled: dto.two_factor_enabled === true,
    gender:
      dto.gender === 'male' || dto.gender === 'female' || dto.gender === 'unspecified'
        ? dto.gender
        : null,
    date_of_birth: typeof dto.date_of_birth === 'string' ? dto.date_of_birth : null,
    avatar_url: asNonEmptyString(dto.avatar_url) ?? null,
    created_at: typeof dto.created_at === 'string' ? dto.created_at : '',
  };
}

export function parseLaravelTokens(raw: unknown): LaravelAuthTokensDto {
  const dto = asRecord(raw);
  if (!dto) {
    throw new Error('Auth token payload is missing');
  }

  const access = asNonEmptyString(dto.access_token);
  const refresh = asNonEmptyString(dto.refresh_token);
  const tokenType = asNonEmptyString(dto.token_type) ?? 'bearer';
  const expiresIn = finitePositiveInt(dto.expires_in);

  if (!access || !refresh || expiresIn === undefined) {
    throw new Error('Auth token payload is incomplete');
  }

  return {
    access_token: access,
    token_type: tokenType,
    expires_in: expiresIn,
    refresh_token: refresh,
  };
}

function finitePositiveInt(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/**
 * Storefront user. Addresses and orders are empty UI defaults — this mapper
 * does not invent account history.
 */
export function toUser(dto: LaravelUserDto): User {
  return {
    id: String(dto.id),
    name: dto.name,
    email: dto.email,
    phone: dto.phone ?? '',
    emailVerified: dto.email_verified === true,
    phoneVerified: dto.phone_verified === true,
    avatar: dto.avatar_url ?? undefined,
    gender: dto.gender ?? 'unspecified',
    // Keep the date part only: `new Date()` on the timestamp can shift a day.
    dateOfBirth: dto.date_of_birth ? dto.date_of_birth.slice(0, 10) : null,
    addresses: [],
    orders: [],
  };
}

export function firstValidationMessage(body: unknown): string | undefined {
  const record = asRecord(body);
  if (!record) return undefined;

  const errors = asRecord(record.errors);
  if (errors) {
    const messages: string[] = [];
    for (const value of Object.values(errors)) {
      if (!Array.isArray(value)) continue;
      for (const entry of value) {
        if (typeof entry === 'string' && entry.trim()) {
          messages.push(entry.trim());
        }
      }
    }
    if (messages.length > 0) return messages.join(' ');
  }

  return asNonEmptyString(record.message);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.trim() !== '',
  );
}

/**
 * Map Laravel 422 password-change errors onto field codes.
 * Does not return or log the submitted passwords.
 */
export function parsePasswordChangeFields(body: unknown): PasswordChangeFields {
  const record = asRecord(body);
  const errors = record ? asRecord(record.errors) : null;
  if (!errors) return {};

  const fields: PasswordChangeFields = {};
  const current = stringArray(errors.current_password);
  const password = stringArray(errors.password);
  const confirmation = stringArray(errors.password_confirmation);

  if (current.length > 0) fields.current_password = 'incorrect';
  if (confirmation.length > 0) fields.password_confirmation = 'mismatch';

  if (password.length > 0) {
    const joined = password.join(' ').toLowerCase();
    if (joined.includes('confirm')) {
      fields.password_confirmation = 'mismatch';
    } else {
      fields.password = 'policy';
    }
  }

  return fields;
}

/**
 * Map Laravel 422 email-verify errors onto field codes.
 * Does not return or log the submitted code.
 */
export function parseEmailVerifyFields(body: unknown): EmailVerifyFields {
  const record = asRecord(body);
  const errors = record ? asRecord(record.errors) : null;
  if (!errors) return {};

  const messages = stringArray(errors.code);
  if (messages.length === 0) return {};

  const joined = messages.join(' ').toLowerCase();
  if (joined.includes('invalid') || joined.includes('expired')) {
    return { code: 'invalid' };
  }
  if (
    joined.includes('size') ||
    joined.includes('characters') ||
    joined.includes('digits')
  ) {
    return { code: 'format' };
  }
  if (joined.includes('required')) {
    return { code: 'required' };
  }
  return { code: 'invalid' };
}

/**
 * Map Laravel 422 phone-verify errors onto field codes.
 * Does not return or log the submitted code.
 */
export function parsePhoneVerifyFields(body: unknown): PhoneVerifyFields {
  return parseEmailVerifyFields(body);
}

/**
 * Map Laravel 422 password-reset errors onto field codes.
 * Does not return or log passwords or the reset token.
 */
export function parseResetPasswordFields(body: unknown): ResetPasswordFields {
  const record = asRecord(body);
  const errors = record ? asRecord(record.errors) : null;
  if (!errors) return {};

  const fields: ResetPasswordFields = {};
  const email = stringArray(errors.email);
  const token = stringArray(errors.token);
  const password = stringArray(errors.password);
  const confirmation = stringArray(errors.password_confirmation);

  if (token.length > 0) {
    fields.token = 'invalid';
  }

  if (email.length > 0 && laravelErrorCode(body) === 'invalid_code') {
    // Since 14/10 every failed reset (bad or expired link, unknown e-mail)
    // answers this one code on `email`, in any language.
    fields.token = 'invalid';
  } else if (email.length > 0) {
    // Older backends: the broker's own sentences.
    const joined = email.join(' ').toLowerCase();
    if (
      joined.includes('token') ||
      joined.includes('invalid') ||
      joined.includes('expired') ||
      joined.includes("can't find") ||
      joined.includes('cannot find') ||
      joined.includes('user')
    ) {
      // Broker statuses are returned on `email` (invalid token / unknown user).
      fields.token = 'invalid';
    } else if (
      joined.includes('valid email') ||
      joined.includes('must be a valid')
    ) {
      fields.email = 'format';
    } else {
      fields.token = 'invalid';
    }
  }

  if (confirmation.length > 0) {
    fields.password_confirmation = 'mismatch';
  }

  if (password.length > 0) {
    const joined = password.join(' ').toLowerCase();
    if (joined.includes('confirm')) {
      fields.password_confirmation = 'mismatch';
    } else {
      fields.password = 'policy';
    }
  }

  return fields;
}
