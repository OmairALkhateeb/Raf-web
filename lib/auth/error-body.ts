const UNAVAILABLE_MESSAGE =
  'The service is temporarily unavailable. Please try again.';

/**
 * Sent by the auth BFF routes for Laravel `429 Too Many Attempts`.
 * `lib/auth/messages.ts` translates it; pages must not show it raw.
 */
export const RATE_LIMITED_MESSAGE =
  'Too many attempts. Please wait a minute and try again.';

const UNSAFE_ERROR =
  /<html|<!doctype|<body|<script|<\/[a-z]|stack trace|sqlstate|bearer\s|access_token|refresh_token|\bjwt\b|\[object object\]/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function isSafeUserFacingError(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 400) return false;
  if (UNSAFE_ERROR.test(trimmed)) return false;
  return true;
}

function pushSafeMessage(messages: string[], value: unknown): void {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (!isSafeUserFacingError(trimmed)) return;
  if (messages.includes(trimmed)) return;
  messages.push(trimmed);
}

/**
 * Collect user-facing auth error strings from BFF `{ error }` and Laravel
 * `{ message, errors }` bodies. Never stringifies objects.
 */
export function collectSafeAuthErrorMessages(data: unknown): string[] {
  const record = asRecord(data);
  if (!record) return [];

  const fromFields: string[] = [];
  const errors = asRecord(record.errors);
  if (errors) {
    for (const value of Object.values(errors)) {
      if (Array.isArray(value)) {
        for (const entry of value) pushSafeMessage(fromFields, entry);
      } else {
        pushSafeMessage(fromFields, value);
      }
    }
  }
  if (fromFields.length > 0) return fromFields;

  const fromError: string[] = [];
  pushSafeMessage(fromError, record.error);
  if (fromError.length > 0) return fromError;

  const fromMessage: string[] = [];
  pushSafeMessage(fromMessage, record.message);
  return fromMessage;
}

export function joinSafeAuthErrorMessages(data: unknown): string | undefined {
  const messages = collectSafeAuthErrorMessages(data);
  if (messages.length === 0) return undefined;
  return messages.join(' ');
}

export function unavailableAuthMessage(): string {
  return UNAVAILABLE_MESSAGE;
}
